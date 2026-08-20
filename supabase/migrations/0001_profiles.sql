-- ============================================================
-- LoveTrack — Migration 0001: profiles, roles, RLS
-- ============================================================
-- Supabase already owns `auth.users`. We keep app-level user data
-- in `public.profiles`, linked 1:1 and created automatically on signup.
-- ============================================================

-- ---------- enums ----------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type public.user_role as enum ('user', 'admin');
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'account_status') then
    create type public.account_status as enum ('active', 'suspended');
  end if;
end
$$;

-- ---------- profiles ----------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  role public.user_role not null default 'user',
  status public.account_status not null default 'active',

  -- notification preferences (Phase 6 uses these; defaults are opt-in)
  notify_check_in boolean not null default true,
  notify_lunch boolean not null default true,
  notify_check_out boolean not null default true,
  notify_leave boolean not null default true,
  notify_reminder boolean not null default true,

  timezone text not null default 'Asia/Kolkata',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'App-level user profile. One row per auth.users row, created by trigger on signup.';
comment on column public.profiles.role is
  'Authorization role. NEVER settable by the user — see the RLS update policy.';

create index if not exists profiles_role_idx on public.profiles (role);
create index if not exists profiles_status_idx on public.profiles (status);
create index if not exists profiles_created_at_idx on public.profiles (created_at desc);

-- ---------- updated_at maintenance ----------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row
  execute function public.set_updated_at();

-- ---------- auto-create profile on signup ----------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- ---------- role helper ----------
-- SECURITY DEFINER so it can read profiles without tripping the very
-- policies that call it (avoids infinite recursion in RLS).

create or replace function public.is_admin(check_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = check_user_id
      and role = 'admin'
      and status = 'active'
  );
$$;

revoke all on function public.is_admin(uuid) from public;
grant execute on function public.is_admin(uuid) to authenticated;

-- ---------- RLS ----------

alter table public.profiles enable row level security;
alter table public.profiles force row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own
  on public.profiles
  for select
  to authenticated
  using (id = auth.uid());

drop policy if exists profiles_select_admin on public.profiles;
create policy profiles_select_admin
  on public.profiles
  for select
  to authenticated
  using (public.is_admin());

-- Users may edit their own profile, but MUST NOT be able to change their
-- own role or status. The `with check` clause pins both to their current
-- values, so a privilege-escalation update fails at the database level.
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
  on public.profiles
  for update
  to authenticated
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and role = (select p.role from public.profiles p where p.id = auth.uid())
    and status = (select p.status from public.profiles p where p.id = auth.uid())
  );

drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_update_admin
  on public.profiles
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- No INSERT policy: rows are created only by the signup trigger.
-- No DELETE policy: deletion cascades from auth.users.
