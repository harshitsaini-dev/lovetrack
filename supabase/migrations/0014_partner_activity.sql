-- ============================================================
-- LoveTrack — Migration 0014: partner activity, with location gated
-- ============================================================
-- There is a gap in what RLS alone can do here, and it matters.
--
-- `attendance_events` is readable by a partner when share_attendance is on.
-- But latitude and longitude are COLUMNS ON THAT SAME ROW. A row policy is
-- all-or-nothing: grant the row and you have granted the coordinates with
-- it. So a partner who was only ever meant to see "checked in at 9:12"
-- could read exactly where from — even with share_location switched off.
--
-- Column-level privileges cannot express it either, because the answer
-- depends on a per-pair setting rather than on the role.
--
-- So partner reads go through these functions, which null the location
-- fields unless can_view_shared(owner, 'location') says otherwise. The
-- decision stays in the database rather than in a component someone might
-- later forget to guard.
-- ============================================================

-- ---------- days ----------

create or replace function public.get_partner_days(
  p_partner_id uuid,
  p_limit integer default 30
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
  select
    a.id,
    a.attendance_date,
    a.status,
    a.check_in_at,
    a.lunch_started_at,
    a.lunch_verified_at,
    a.check_out_at
  from public.attendance a
  where a.user_id = p_partner_id
    and public.can_view_shared(p_partner_id, 'attendance')
  order by a.attendance_date desc
  limit least(coalesce(p_limit, 30), 90);
$$;

revoke all on function public.get_partner_days(uuid, integer) from public;
grant execute on function public.get_partner_days(uuid, integer) to authenticated;

-- ---------- events ----------

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
  location_shared boolean
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
    -- Every location field is gated on the same check. The place name is
    -- included: "Janakpuri, Delhi" is a location, just a friendlier one.
    case when public.can_view_shared(p_partner_id, 'location')
         then e.place_label end,
    case when public.can_view_shared(p_partner_id, 'location')
         then e.latitude end,
    case when public.can_view_shared(p_partner_id, 'location')
         then e.longitude end,
    case when public.can_view_shared(p_partner_id, 'location')
         then e.accuracy_m end,
    public.can_view_shared(p_partner_id, 'location')
  from public.attendance_events e
  join public.attendance a on a.id = e.attendance_id
  where e.user_id = p_partner_id
    and public.can_view_shared(p_partner_id, 'attendance')
    -- A rejected submission never counted, so it is not activity. It stays
    -- between its author and an admin.
    and e.status <> 'rejected'
    and (p_from_date is null or a.attendance_date >= p_from_date)
  order by e.server_timestamp desc;
$$;

revoke all on function public.get_partner_events(uuid, date) from public;
grant execute on function public.get_partner_events(uuid, date) to authenticated;

-- ---------- what a partner is allowed to see at all ----------
-- One round trip so the UI can render honest empty states: "they don't
-- share this" reads very differently from "there is nothing here".

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
    'leave', public.can_view_shared(p_partner_id, 'leave')
  );
$$;

revoke all on function public.get_partner_permissions(uuid) from public;
grant execute on function public.get_partner_permissions(uuid) to authenticated;
