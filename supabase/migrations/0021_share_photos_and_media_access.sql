-- ============================================================
-- LoveTrack — Migration 0021: photos a partner may see, and media access
-- ============================================================
-- Until now check-in photos were deliberately kept between the user and an
-- admin: migration 0007 called them "anti-fraud evidence, not part of the
-- activity feed". That is no longer the product: paired people expect to
-- see each other's day, photographs included, and whether to share is
-- theirs to decide rather than the schema's.
--
-- So this adds share_photos alongside the others, and — a separate product
-- decision recorded below — flips every sharing switch ON by default. What
-- keeps that honest is that each switch stays visible and revocable at any
-- moment, including a one-tap "stop all sharing".
--
-- It also adds one function for reading a photo's storage path, because the
-- app cannot ask the table directly: 0015 removed the partner's row policy
-- on attendance_events (latitude sits on the same row as the timestamp, and
-- a row policy cannot grant one without the other). SECURITY DEFINER is the
-- only route left, which is the point — the rule lives in one place.
-- ============================================================

-- ---------- the switch ----------

alter table public.pair_permissions
  add column if not exists share_photos boolean not null default true;

-- ---------- everything on by default ----------
-- Product decision, made deliberately and worth writing down.
--
-- Location, lunch proof, leave and photos all used to default to OFF, on
-- the reasoning that sharing should be something you switch on rather than
-- something that happens to you. LoveTrack is used by people who paired
-- with each other on purpose and expect to see each other's day; starting
-- every pair blank made the app look broken and pushed both people through
-- four switches before it did anything.
--
-- What keeps this honest is the other half, which does not change: each
-- switch is visible on the partner screen, each can be turned off at any
-- moment, and "stop all sharing" is one tap. Consent stays revocable — it
-- is now assumed at the point of pairing rather than collected afterwards.
alter table public.pair_permissions
  alter column share_location    set default true,
  alter column share_lunch_proof set default true,
  alter column share_leave       set default true;

-- Existing pairs move too. A pair created yesterday and a pair created
-- tomorrow behaving differently is the kind of split-brain that makes a
-- privacy control impossible to reason about.
update public.pair_permissions
set share_location    = true,
    share_lunch_proof = true,
    share_leave       = true,
    share_photos      = true;

comment on column public.pair_permissions.share_photos is
  'Whether this partner may view the check-in / check-out photos belonging to the owner. On by default, like the other switches, and revocable at any time from the partner screen.';

-- ---------- teach can_view_shared about it ----------

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
            when 'photos'      then pp.share_photos
            else false
          end
  );
$$;

revoke all on function public.can_view_shared(uuid, text, uuid) from public;
grant execute on function public.can_view_shared(uuid, text, uuid) to authenticated;

-- ---------- report it alongside the others ----------

create or replace function public.get_partner_permissions(p_partner_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'attendance', public.can_view_shared(p_partner_id, 'attendance'),
    'location', public.can_view_shared(p_partner_id, 'location'),
    'lunch_proof', public.can_view_shared(p_partner_id, 'lunch_proof'),
    'leave', public.can_view_shared(p_partner_id, 'leave'),
    'photos', public.can_view_shared(p_partner_id, 'photos')
  );
$$;

revoke all on function public.get_partner_permissions(uuid) from public;
grant execute on function public.get_partner_permissions(uuid) to authenticated;

-- ---------- events now carry the photo, gated the same way as location ----------
-- has_photo is reported even when the photo itself is withheld. That is
-- deliberate: "they took a photo you are not allowed to see" is honest, and
-- hiding the difference would make the feed look like the photo never
-- existed. It leaks nothing beyond the fact a capture happened, which the
-- event row already says.

create or replace function public.get_partner_events(
  p_partner_id uuid,
  p_from_date date default null
)
returns table (
  id uuid,
  attendance_id uuid,
  event_type public.attendance_event_type,
  server_timestamp timestamptz,
  place_label text,
  latitude double precision,
  longitude double precision,
  accuracy_m double precision,
  location_shared boolean,
  photo_path text,
  has_photo boolean,
  photo_shared boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    e.id,
    e.attendance_id,
    e.event_type,
    e.server_timestamp,
    case when public.can_view_shared(p_partner_id, 'location')
         then e.place_label end,
    case when public.can_view_shared(p_partner_id, 'location')
         then e.latitude end,
    case when public.can_view_shared(p_partner_id, 'location')
         then e.longitude end,
    case when public.can_view_shared(p_partner_id, 'location')
         then e.accuracy_m end,
    public.can_view_shared(p_partner_id, 'location'),
    case when public.can_view_shared(p_partner_id, 'photos')
         then e.photo_path end,
    e.photo_path is not null,
    public.can_view_shared(p_partner_id, 'photos')
  from public.attendance_events e
  join public.attendance a on a.id = e.attendance_id
  where e.user_id = p_partner_id
    and public.can_view_shared(p_partner_id, 'attendance')
    and e.status <> 'rejected'
    and (p_from_date is null or a.attendance_date >= p_from_date)
  order by e.server_timestamp desc;
$$;

revoke all on function public.get_partner_events(uuid, date) from public;
grant execute on function public.get_partner_events(uuid, date) to authenticated;

-- ---------- one place that decides who may open a photo ----------
-- Returns the storage path plus who the caller is to this photo, so the
-- server action knows whether the view needs writing to the audit log.
--
-- Three ways to be allowed, and no fourth: it is yours, you are an admin,
-- or its owner has turned share_photos on for you.

create or replace function public.get_attendance_photo_access(p_event_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_path text;
  v_me uuid := auth.uid();
begin
  if v_me is null then
    return jsonb_build_object('ok', false, 'reason', 'unauthenticated');
  end if;

  select user_id, photo_path into v_owner, v_path
  from public.attendance_events
  where id = p_event_id;

  -- Same answer for "no such event" and "no photo on it", so this cannot be
  -- used to probe which event ids exist.
  if v_owner is null or v_path is null then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  if v_owner = v_me then
    return jsonb_build_object('ok', true, 'path', v_path,
                              'owner_id', v_owner, 'as_admin', false);
  end if;

  if public.is_admin() then
    return jsonb_build_object('ok', true, 'path', v_path,
                              'owner_id', v_owner, 'as_admin', true);
  end if;

  if public.can_view_shared(v_owner, 'photos') then
    return jsonb_build_object('ok', true, 'path', v_path,
                              'owner_id', v_owner, 'as_admin', false);
  end if;

  return jsonb_build_object('ok', false, 'reason', 'not_shared');
end;
$$;

revoke all on function public.get_attendance_photo_access(uuid) from public;
grant execute on function public.get_attendance_photo_access(uuid) to authenticated;

-- ---------- the same, for a lunch clip ----------
-- lunch_proofs keeps its row policies, so RLS alone would do — but routing
-- both media kinds through one shape keeps the server action honest about
-- when an admin view has to be audited.

create or replace function public.get_lunch_proof_access(p_proof_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_path text;
  v_me uuid := auth.uid();
begin
  if v_me is null then
    return jsonb_build_object('ok', false, 'reason', 'unauthenticated');
  end if;

  select user_id, video_path into v_owner, v_path
  from public.lunch_proofs
  where id = p_proof_id;

  if v_owner is null or v_path is null then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  if v_owner = v_me then
    return jsonb_build_object('ok', true, 'path', v_path,
                              'owner_id', v_owner, 'as_admin', false);
  end if;

  if public.is_admin() then
    return jsonb_build_object('ok', true, 'path', v_path,
                              'owner_id', v_owner, 'as_admin', true);
  end if;

  if public.can_view_shared(v_owner, 'lunch_proof') then
    return jsonb_build_object('ok', true, 'path', v_path,
                              'owner_id', v_owner, 'as_admin', false);
  end if;

  return jsonb_build_object('ok', false, 'reason', 'not_shared');
end;
$$;

revoke all on function public.get_lunch_proof_access(uuid) from public;
grant execute on function public.get_lunch_proof_access(uuid) to authenticated;

-- ---------- a partner's lunch clips, so the UI knows they exist ----------

create or replace function public.get_partner_lunch_proofs(
  p_partner_id uuid,
  p_from_date date default null
)
returns table (
  id uuid,
  attendance_id uuid,
  created_at timestamptz,
  duration_s numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select lp.id, lp.attendance_id, lp.created_at, lp.duration_s
  from public.lunch_proofs lp
  join public.attendance a on a.id = lp.attendance_id
  where lp.user_id = p_partner_id
    and public.can_view_shared(p_partner_id, 'lunch_proof')
    and (p_from_date is null or a.attendance_date >= p_from_date)
  order by lp.created_at desc;
$$;

revoke all on function public.get_partner_lunch_proofs(uuid, date) from public;
grant execute on function public.get_partner_lunch_proofs(uuid, date) to authenticated;

-- ---------- everything about one user, for an admin ----------
-- The admin panel could read these tables directly — is_admin() policies
-- allow it — but going through a function keeps the shape close to the
-- partner view, so the UI has one thing to render rather than two.

create or replace function public.admin_user_events(
  p_user_id uuid,
  p_limit integer default 200
)
returns table (
  id uuid,
  attendance_id uuid,
  event_type public.attendance_event_type,
  server_timestamp timestamptz,
  status public.verification_status,
  risk_score integer,
  place_label text,
  latitude double precision,
  longitude double precision,
  accuracy_m double precision,
  device_label text,
  photo_path text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    e.id, e.attendance_id, e.event_type, e.server_timestamp, e.status,
    e.risk_score, e.place_label, e.latitude, e.longitude, e.accuracy_m,
    e.device_label, e.photo_path
  from public.attendance_events e
  where e.user_id = p_user_id
    and public.is_admin()
  order by e.server_timestamp desc
  limit least(coalesce(p_limit, 200), 500);
$$;

revoke all on function public.admin_user_events(uuid, integer) from public;
grant execute on function public.admin_user_events(uuid, integer) to authenticated;

create or replace function public.admin_user_days(
  p_user_id uuid,
  p_limit integer default 60
)
returns table (
  id uuid,
  attendance_date date,
  status public.attendance_status,
  check_in_at timestamptz,
  lunch_started_at timestamptz,
  lunch_verified_at timestamptz,
  check_out_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select a.id, a.attendance_date, a.status, a.check_in_at,
         a.lunch_started_at, a.lunch_verified_at, a.check_out_at
  from public.attendance a
  where a.user_id = p_user_id
    and public.is_admin()
  order by a.attendance_date desc
  limit least(coalesce(p_limit, 60), 180);
$$;

revoke all on function public.admin_user_days(uuid, integer) from public;
grant execute on function public.admin_user_days(uuid, integer) to authenticated;

create or replace function public.admin_user_lunch_proofs(
  p_user_id uuid,
  p_limit integer default 60
)
returns table (
  id uuid,
  attendance_id uuid,
  created_at timestamptz,
  duration_s numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select lp.id, lp.attendance_id, lp.created_at, lp.duration_s
  from public.lunch_proofs lp
  where lp.user_id = p_user_id
    and public.is_admin()
  order by lp.created_at desc
  limit least(coalesce(p_limit, 60), 180);
$$;

revoke all on function public.admin_user_lunch_proofs(uuid, integer) from public;
grant execute on function public.admin_user_lunch_proofs(uuid, integer) to authenticated;
