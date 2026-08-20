-- ============================================================
-- LoveTrack — Migration 0003: consent-based pairing
-- ============================================================
-- A pair links exactly two users. Nothing is shared until BOTH sides have
-- agreed: the receiver must accept, and each user separately chooses what
-- they share via their own row in pair_permissions.
--
-- Sharing is per-direction on purpose. "Harshit shares his location with
-- Priya" and "Priya shares hers with Harshit" are two independent choices,
-- so one person can never enable sharing on the other's behalf.
-- ============================================================

-- ---------- enum ----------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'pair_status') then
    create type public.pair_status as enum
      ('pending', 'accepted', 'rejected', 'revoked');
  end if;
end
$$;

-- ---------- pairs ----------

create table if not exists public.pairs (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  receiver_id uuid not null references public.profiles (id) on delete cascade,
  status public.pair_status not null default 'pending',

  created_at timestamptz not null default now(),
  responded_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid references public.profiles (id) on delete set null,

  constraint pairs_no_self_pairing check (requester_id <> receiver_id)
);

comment on table public.pairs is
  'A consent-based link between two users. Nothing is shared until accepted.';

-- Only one live pair per couple, in either direction. Using least/greatest
-- makes (A,B) and (B,A) collide, so a second invite cannot be opened while
-- one is already pending or accepted. Rejected and revoked rows stay as
-- history and do not block a fresh request later.
create unique index if not exists pairs_one_active_per_couple_idx
  on public.pairs (
    least(requester_id, receiver_id),
    greatest(requester_id, receiver_id)
  )
  where status in ('pending', 'accepted');

create index if not exists pairs_requester_idx on public.pairs (requester_id);
create index if not exists pairs_receiver_idx on public.pairs (receiver_id);
create index if not exists pairs_status_idx on public.pairs (status);

-- ---------- pair_permissions ----------
-- One row per (pair, owner). `owner_id` is the person DOING the sharing;
-- the other member of the pair is the one who gets to see it.

create table if not exists public.pair_permissions (
  id uuid primary key default gen_random_uuid(),
  pair_id uuid not null references public.pairs (id) on delete cascade,
  owner_id uuid not null references public.profiles (id) on delete cascade,

  -- Check-in / check-out / lunch events and their timestamps.
  share_attendance boolean not null default true,
  -- The location captured at the moment of each of those events.
  -- (There is no continuous location in LoveTrack — see docs/03.)
  share_location boolean not null default false,
  -- The lunch proof video itself, via a short-lived signed URL.
  share_lunch_proof boolean not null default false,
  -- Leave requests and their status.
  share_leave boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint pair_permissions_unique_owner unique (pair_id, owner_id)
);

comment on column public.pair_permissions.owner_id is
  'The user who is sharing. Only this user may change the row.';
comment on column public.pair_permissions.share_location is
  'Defaults to false: location is the most sensitive field, so it is opt-in.';

create index if not exists pair_permissions_owner_idx
  on public.pair_permissions (owner_id);

drop trigger if exists pair_permissions_set_updated_at on public.pair_permissions;
create trigger pair_permissions_set_updated_at
  before update on public.pair_permissions
  for each row
  execute function public.set_updated_at();

-- ---------- create permission rows when a pair is accepted ----------

create or replace function public.handle_pair_accepted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'accepted' and old.status is distinct from 'accepted' then
    insert into public.pair_permissions (pair_id, owner_id)
    values (new.id, new.requester_id), (new.id, new.receiver_id)
    on conflict (pair_id, owner_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_pair_accepted on public.pairs;
create trigger on_pair_accepted
  after update on public.pairs
  for each row
  execute function public.handle_pair_accepted();

-- ---------- helpers ----------

-- SECURITY DEFINER so policies can call it without recursing into the very
-- policies being evaluated.
create or replace function public.is_paired_with(other_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.pairs
    where status = 'accepted'
      and (
        (requester_id = auth.uid() and receiver_id = other_user_id)
        or (receiver_id = auth.uid() and requester_id = other_user_id)
      )
  );
$$;

revoke all on function public.is_paired_with(uuid) from public;
grant execute on function public.is_paired_with(uuid) to authenticated;

-- Does `viewer` currently have permission `permission` on `owner`'s data?
-- Later phases (attendance, lunch, leave) gate their RLS on this.
create or replace function public.can_view_shared(
  owner_user_id uuid,
  permission text,
  viewer_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.pairs p
    join public.pair_permissions pp
      on pp.pair_id = p.id and pp.owner_id = owner_user_id
    where p.status = 'accepted'
      and (
        (p.requester_id = owner_user_id and p.receiver_id = viewer_id)
        or (p.receiver_id = owner_user_id and p.requester_id = viewer_id)
      )
      and case permission
            when 'attendance'  then pp.share_attendance
            when 'location'    then pp.share_location
            when 'lunch_proof' then pp.share_lunch_proof
            when 'leave'       then pp.share_leave
            else false
          end
  );
$$;

revoke all on function public.can_view_shared(uuid, text, uuid) from public;
grant execute on function public.can_view_shared(uuid, text, uuid) to authenticated;

-- ---------- request pairing by email ----------
-- Done through a function so the client never gets to query profiles by
-- email. The result is deliberately the same whether or not the address is
-- registered, so this cannot be used to enumerate accounts.

create or replace function public.request_pairing(target_email text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  target_id uuid;
  me uuid := auth.uid();
begin
  if me is null then
    return 'unauthenticated';
  end if;

  select id into target_id
  from public.profiles
  where lower(email) = lower(trim(target_email))
    and status = 'active';

  -- Self-pairing is worth naming: the user knows their own address, so
  -- there is nothing to disclose and a vague reply would just confuse.
  if target_id = me then
    return 'self';
  end if;

  if target_id is null then
    return 'sent';
  end if;

  if exists (
    select 1 from public.pairs
    where status in ('pending', 'accepted')
      and (
        (requester_id = me and receiver_id = target_id)
        or (requester_id = target_id and receiver_id = me)
      )
  ) then
    return 'exists';
  end if;

  insert into public.pairs (requester_id, receiver_id)
  values (me, target_id);

  return 'sent';
end;
$$;

revoke all on function public.request_pairing(text) from public;
grant execute on function public.request_pairing(text) to authenticated;

-- ---------- RLS: pairs ----------

alter table public.pairs enable row level security;
alter table public.pairs force row level security;

drop policy if exists pairs_select_member on public.pairs;
create policy pairs_select_member
  on public.pairs
  for select
  to authenticated
  using (requester_id = auth.uid() or receiver_id = auth.uid());

drop policy if exists pairs_select_admin on public.pairs;
create policy pairs_select_admin
  on public.pairs
  for select
  to authenticated
  using (public.is_admin());

-- Rows are created by request_pairing(). No INSERT policy means a client
-- cannot forge a pair where it is not the requester, or start one already
-- marked accepted.

-- The receiver answers a pending invite; either side may end an accepted
-- one. The `with check` clause constrains what the new row may look like,
-- so a member cannot, say, flip a rejected pair back to accepted.
drop policy if exists pairs_update_member on public.pairs;
create policy pairs_update_member
  on public.pairs
  for update
  to authenticated
  using (
    (status = 'pending' and receiver_id = auth.uid())
    or (status = 'pending' and requester_id = auth.uid())
    or (status = 'accepted' and (requester_id = auth.uid() or receiver_id = auth.uid()))
  )
  with check (
    -- the two people involved can never change
    requester_id = (select p.requester_id from public.pairs p where p.id = id)
    and receiver_id = (select p.receiver_id from public.pairs p where p.id = id)
    and (
      -- receiver accepts or rejects a pending invite
      (status in ('accepted', 'rejected') and receiver_id = auth.uid())
      -- requester withdraws their own pending invite
      or (status = 'revoked' and requester_id = auth.uid())
      -- either side ends an accepted pair
      or (status = 'revoked' and (requester_id = auth.uid() or receiver_id = auth.uid()))
    )
  );

-- ---------- RLS: pair_permissions ----------

alter table public.pair_permissions enable row level security;
alter table public.pair_permissions force row level security;

-- Both members can read the row, so each side can see what the other has
-- chosen to share. Visibility of the setting is itself part of consent.
drop policy if exists pair_permissions_select_member on public.pair_permissions;
create policy pair_permissions_select_member
  on public.pair_permissions
  for select
  to authenticated
  using (
    exists (
      select 1 from public.pairs p
      where p.id = pair_id
        and (p.requester_id = auth.uid() or p.receiver_id = auth.uid())
    )
  );

drop policy if exists pair_permissions_select_admin on public.pair_permissions;
create policy pair_permissions_select_admin
  on public.pair_permissions
  for select
  to authenticated
  using (public.is_admin());

-- Only the person doing the sharing may change what they share.
drop policy if exists pair_permissions_update_own on public.pair_permissions;
create policy pair_permissions_update_own
  on public.pair_permissions
  for update
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- Rows are created by the accept trigger only.
