-- ============================================================
-- LoveTrack — Migration 0006: attendance and the verification engine
-- ============================================================
-- The whole point of this migration is that a client cannot write an
-- attendance record. There is no INSERT policy on the event table; the only
-- way in is record_attendance_event(), which runs in one transaction and
-- decides for itself what the timestamp, the risk score and the verdict
-- are.
--
-- The client supplies raw signals it inherently owns — coordinates from the
-- device, a photo it just captured. It never supplies conclusions.
-- ============================================================

-- ---------- enums ----------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'attendance_event_type') then
    create type public.attendance_event_type as enum
      ('check_in', 'check_out', 'lunch_start', 'lunch_end');
  end if;

  if not exists (select 1 from pg_type where typname = 'verification_status') then
    create type public.verification_status as enum
      ('passed', 'flagged', 'rejected');
  end if;

  if not exists (select 1 from pg_type where typname = 'attendance_status') then
    create type public.attendance_status as enum
      ('not_started', 'checked_in', 'lunch_active', 'lunch_verified', 'checked_out');
  end if;
end
$$;

-- ---------- tunable thresholds ----------
-- A singleton row rather than environment variables, so an admin can change
-- them without a redeploy.

create table if not exists public.system_settings (
  id boolean primary key default true,

  -- Reject a fix worse than this. There is NO geofence in LoveTrack:
  -- check-in is allowed from anywhere, the reading just has to be real.
  max_accuracy_m integer not null default 100,
  -- Accept but treat as low confidence beyond this.
  warn_accuracy_m integer not null default 50,
  -- Reject a cached fix. Real captures are seconds old.
  max_fix_age_s integer not null default 30,
  -- Travel faster than this between two events is not physically plausible.
  max_speed_kmh integer not null default 900,

  risk_flag_threshold integer not null default 30,
  risk_reject_threshold integer not null default 80,

  -- Whether a check-out with no check-in is allowed at all.
  allow_checkout_without_checkin boolean not null default false,

  updated_at timestamptz not null default now(),

  constraint system_settings_singleton check (id)
);

insert into public.system_settings (id) values (true) on conflict (id) do nothing;

drop trigger if exists system_settings_set_updated_at on public.system_settings;
create trigger system_settings_set_updated_at
  before update on public.system_settings
  for each row
  execute function public.set_updated_at();

alter table public.system_settings enable row level security;
alter table public.system_settings force row level security;

-- Everyone may read the thresholds so the UI can explain the rules.
drop policy if exists system_settings_select on public.system_settings;
create policy system_settings_select
  on public.system_settings for select to authenticated using (true);

drop policy if exists system_settings_update_admin on public.system_settings;
create policy system_settings_update_admin
  on public.system_settings for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------- attendance: one row per user per day ----------

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  attendance_date date not null,
  status public.attendance_status not null default 'not_started',

  check_in_at timestamptz,
  check_out_at timestamptz,
  lunch_started_at timestamptz,
  lunch_verified_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint attendance_one_per_day unique (user_id, attendance_date)
);

create index if not exists attendance_user_date_idx
  on public.attendance (user_id, attendance_date desc);
create index if not exists attendance_date_idx
  on public.attendance (attendance_date desc);

drop trigger if exists attendance_set_updated_at on public.attendance;
create trigger attendance_set_updated_at
  before update on public.attendance
  for each row
  execute function public.set_updated_at();

-- ---------- single-use nonces ----------
-- Issued right before a capture and consumed by it, so an old photo cannot
-- be replayed with a fresh-looking request.

create table if not exists public.attendance_nonces (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  event_type public.attendance_event_type not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz
);

create index if not exists attendance_nonces_user_idx
  on public.attendance_nonces (user_id, used_at);

-- ---------- the events themselves ----------

create table if not exists public.attendance_events (
  id uuid primary key default gen_random_uuid(),
  attendance_id uuid not null references public.attendance (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  event_type public.attendance_event_type not null,

  -- Server clock only. The device's idea of the time is never recorded as
  -- fact; changing the phone's clock must not move an attendance record.
  server_timestamp timestamptz not null default now(),

  latitude double precision,
  longitude double precision,
  accuracy_m double precision,
  fix_age_s double precision,
  place_label text,

  photo_path text,
  nonce_id uuid references public.attendance_nonces (id) on delete set null,
  device_label text,
  ip_hash text,

  risk_score integer not null default 0,
  status public.verification_status not null default 'passed',
  failure_reason text,

  created_at timestamptz not null default now()
);

create index if not exists attendance_events_attendance_idx
  on public.attendance_events (attendance_id, server_timestamp);
create index if not exists attendance_events_user_time_idx
  on public.attendance_events (user_id, server_timestamp desc);
create index if not exists attendance_events_status_idx
  on public.attendance_events (status)
  where status <> 'passed';

-- ---------- why a submission scored what it scored ----------

create table if not exists public.risk_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  attendance_event_id uuid references public.attendance_events (id) on delete cascade,
  signal text not null,
  detail text,
  points integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists risk_events_user_idx
  on public.risk_events (user_id, created_at desc);

-- ============================================================
-- Issuing a nonce
-- ============================================================

create or replace function public.issue_attendance_nonce(
  p_event_type public.attendance_event_type
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  new_id uuid;
begin
  if me is null then
    raise exception 'Not authenticated';
  end if;

  -- Housekeeping: drop this user's stale nonces so the table cannot grow
  -- without bound from abandoned captures.
  delete from public.attendance_nonces
  where user_id = me and expires_at < now() - interval '1 day';

  insert into public.attendance_nonces (user_id, event_type, expires_at)
  values (me, p_event_type, now() + interval '3 minutes')
  returning id into new_id;

  return new_id;
end;
$$;

revoke all on function public.issue_attendance_nonce(public.attendance_event_type) from public;
grant execute on function public.issue_attendance_nonce(public.attendance_event_type) to authenticated;

-- ============================================================
-- Recording an event
-- ============================================================
-- Everything that decides whether a submission counts happens here, inside
-- one transaction: nonce consumption, the state machine, the risk score and
-- the verdict.

create or replace function public.record_attendance_event(
  p_nonce uuid,
  p_event_type public.attendance_event_type,
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy_m double precision,
  p_fix_age_s double precision,
  p_photo_path text default null,
  p_place_label text default null,
  p_device_label text default null,
  p_ip_hash text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  cfg public.system_settings%rowtype;
  prof public.profiles%rowtype;
  nonce public.attendance_nonces%rowtype;
  today date;
  att public.attendance%rowtype;
  prev public.attendance_events%rowtype;
  score integer := 0;
  verdict public.verification_status;
  reason text;
  event_id uuid;
  signals jsonb := '[]'::jsonb;
  distance_m double precision;
  elapsed_s double precision;
  speed_kmh double precision;
begin
  if me is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  select * into cfg from public.system_settings where id;
  select * into prof from public.profiles where id = me;

  if prof.status <> 'active' then
    return jsonb_build_object('ok', false, 'error', 'account_suspended');
  end if;

  -- ---------- nonce: must exist, be ours, match the action, be fresh ----------
  select * into nonce
  from public.attendance_nonces
  where id = p_nonce
  for update;

  if nonce.id is null or nonce.user_id <> me then
    return jsonb_build_object('ok', false, 'error', 'invalid_nonce');
  end if;
  if nonce.used_at is not null then
    return jsonb_build_object('ok', false, 'error', 'nonce_already_used');
  end if;
  if nonce.expires_at < now() then
    return jsonb_build_object('ok', false, 'error', 'nonce_expired');
  end if;
  if nonce.event_type <> p_event_type then
    return jsonb_build_object('ok', false, 'error', 'nonce_wrong_action');
  end if;

  update public.attendance_nonces set used_at = now() where id = nonce.id;

  -- ---------- which day is it, for this user ----------
  -- Their own timezone, taken from their profile. Not the server's, and
  -- certainly not the device's.
  today := (now() at time zone prof.timezone)::date;

  insert into public.attendance (user_id, attendance_date)
  values (me, today)
  on conflict (user_id, attendance_date) do nothing;

  select * into att
  from public.attendance
  where user_id = me and attendance_date = today
  for update;

  -- ---------- state machine ----------
  if p_event_type = 'check_in' then
    if att.status <> 'not_started' then
      return jsonb_build_object('ok', false, 'error', 'already_checked_in');
    end if;

  elsif p_event_type = 'lunch_start' then
    if att.status <> 'checked_in' then
      return jsonb_build_object('ok', false, 'error', 'lunch_needs_check_in');
    end if;

  elsif p_event_type = 'lunch_end' then
    if att.status <> 'lunch_active' then
      return jsonb_build_object('ok', false, 'error', 'lunch_not_started');
    end if;

  elsif p_event_type = 'check_out' then
    if att.status = 'checked_out' then
      return jsonb_build_object('ok', false, 'error', 'already_checked_out');
    end if;
    if att.status = 'not_started' and not cfg.allow_checkout_without_checkin then
      return jsonb_build_object('ok', false, 'error', 'check_out_needs_check_in');
    end if;
    if att.status = 'lunch_active' then
      return jsonb_build_object('ok', false, 'error', 'finish_lunch_first');
    end if;
  end if;

  -- ---------- is this location reading believable? ----------
  if p_accuracy_m is null or p_latitude is null or p_longitude is null then
    score := 100;
    reason := 'location_missing';
    signals := signals || jsonb_build_object('signal', 'location_missing', 'points', 100);

  else
    if p_accuracy_m > cfg.max_accuracy_m then
      score := score + 100;
      reason := 'accuracy_too_poor';
      signals := signals || jsonb_build_object(
        'signal', 'accuracy_too_poor', 'points', 100,
        'detail', round(p_accuracy_m) || 'm > ' || cfg.max_accuracy_m || 'm');
    elsif p_accuracy_m > cfg.warn_accuracy_m then
      score := score + 25;
      signals := signals || jsonb_build_object(
        'signal', 'accuracy_low_confidence', 'points', 25,
        'detail', round(p_accuracy_m) || 'm');
    end if;

    -- A cached fix is the easiest way to submit a location you are no
    -- longer at, so stale readings are rejected outright.
    if p_fix_age_s is not null and p_fix_age_s > cfg.max_fix_age_s then
      score := score + 100;
      reason := coalesce(reason, 'location_stale');
      signals := signals || jsonb_build_object(
        'signal', 'location_stale', 'points', 100,
        'detail', round(p_fix_age_s) || 's old');
    end if;

    -- Compare against this user's previous event.
    select * into prev
    from public.attendance_events
    where user_id = me and latitude is not null
    order by server_timestamp desc
    limit 1;

    if prev.id is not null then
      -- Haversine, in metres.
      distance_m := 2 * 6371000 * asin(sqrt(
        power(sin(radians(p_latitude - prev.latitude) / 2), 2) +
        cos(radians(prev.latitude)) * cos(radians(p_latitude)) *
        power(sin(radians(p_longitude - prev.longitude) / 2), 2)
      ));
      elapsed_s := extract(epoch from (now() - prev.server_timestamp));

      if elapsed_s > 0 then
        speed_kmh := (distance_m / elapsed_s) * 3.6;

        if speed_kmh > cfg.max_speed_kmh then
          score := score + 40;
          signals := signals || jsonb_build_object(
            'signal', 'implausible_movement', 'points', 40,
            'detail', round(speed_kmh) || ' km/h implied');
        end if;
      end if;

      -- Real GPS always jitters a little. Coordinates identical to the
      -- previous capture suggest a fixed, supplied value.
      if distance_m = 0 then
        score := score + 30;
        signals := signals || jsonb_build_object(
          'signal', 'zero_gps_drift', 'points', 30,
          'detail', 'identical to the previous reading');
      end if;
    end if;
  end if;

  -- ---------- verdict ----------
  if score >= cfg.risk_reject_threshold then
    verdict := 'rejected';
  elsif score >= cfg.risk_flag_threshold then
    verdict := 'flagged';
  else
    verdict := 'passed';
  end if;

  insert into public.attendance_events (
    attendance_id, user_id, event_type,
    latitude, longitude, accuracy_m, fix_age_s, place_label,
    photo_path, nonce_id, device_label, ip_hash,
    risk_score, status, failure_reason
  ) values (
    att.id, me, p_event_type,
    p_latitude, p_longitude, p_accuracy_m, p_fix_age_s, p_place_label,
    p_photo_path, nonce.id, p_device_label, p_ip_hash,
    least(score, 100), verdict, reason
  )
  returning id into event_id;

  -- Every contributing signal is recorded, so a score is always explainable
  -- to the user and to an admin reviewing it later.
  insert into public.risk_events (user_id, attendance_event_id, signal, detail, points)
  select me, event_id, s->>'signal', s->>'detail', (s->>'points')::integer
  from jsonb_array_elements(signals) s;

  -- A rejected submission is recorded as evidence but does not move the
  -- day forward.
  if verdict <> 'rejected' then
    if p_event_type = 'check_in' then
      update public.attendance
      set status = 'checked_in', check_in_at = now()
      where id = att.id;

    elsif p_event_type = 'lunch_start' then
      update public.attendance
      set status = 'lunch_active', lunch_started_at = now()
      where id = att.id;

    elsif p_event_type = 'lunch_end' then
      update public.attendance
      set status = 'lunch_verified', lunch_verified_at = now()
      where id = att.id;

    elsif p_event_type = 'check_out' then
      update public.attendance
      set status = 'checked_out', check_out_at = now()
      where id = att.id;
    end if;
  end if;

  return jsonb_build_object(
    'ok', verdict <> 'rejected',
    'event_id', event_id,
    'status', verdict,
    'risk_score', least(score, 100),
    'reason', reason,
    'server_time', now(),
    'signals', signals
  );
end;
$$;

revoke all on function public.record_attendance_event(
  uuid, public.attendance_event_type, double precision, double precision,
  double precision, double precision, text, text, text, text
) from public;
grant execute on function public.record_attendance_event(
  uuid, public.attendance_event_type, double precision, double precision,
  double precision, double precision, text, text, text, text
) to authenticated;

-- ============================================================
-- RLS
-- ============================================================

alter table public.attendance enable row level security;
alter table public.attendance force row level security;
alter table public.attendance_events enable row level security;
alter table public.attendance_events force row level security;
alter table public.attendance_nonces enable row level security;
alter table public.attendance_nonces force row level security;
alter table public.risk_events enable row level security;
alter table public.risk_events force row level security;

-- --- attendance ---

drop policy if exists attendance_select_own on public.attendance;
create policy attendance_select_own
  on public.attendance for select to authenticated
  using (user_id = auth.uid());

-- A partner sees the day only if this user shares attendance with them.
drop policy if exists attendance_select_partner on public.attendance;
create policy attendance_select_partner
  on public.attendance for select to authenticated
  using (public.can_view_shared(user_id, 'attendance'));

drop policy if exists attendance_select_admin on public.attendance;
create policy attendance_select_admin
  on public.attendance for select to authenticated
  using (public.is_admin());

-- No INSERT or UPDATE policy: only record_attendance_event() writes here.

-- --- attendance_events ---

drop policy if exists attendance_events_select_own on public.attendance_events;
create policy attendance_events_select_own
  on public.attendance_events for select to authenticated
  using (user_id = auth.uid());

drop policy if exists attendance_events_select_partner on public.attendance_events;
create policy attendance_events_select_partner
  on public.attendance_events for select to authenticated
  using (public.can_view_shared(user_id, 'attendance'));

drop policy if exists attendance_events_select_admin on public.attendance_events;
create policy attendance_events_select_admin
  on public.attendance_events for select to authenticated
  using (public.is_admin());

-- --- nonces ---
-- Readable so a client can confirm its own nonce; never writable.

drop policy if exists attendance_nonces_select_own on public.attendance_nonces;
create policy attendance_nonces_select_own
  on public.attendance_nonces for select to authenticated
  using (user_id = auth.uid());

-- --- risk events ---
-- Deliberately NOT shared with a partner: how someone scored on an
-- anti-fraud check is between them and an admin.

drop policy if exists risk_events_select_own on public.risk_events;
create policy risk_events_select_own
  on public.risk_events for select to authenticated
  using (user_id = auth.uid());

drop policy if exists risk_events_select_admin on public.risk_events;
create policy risk_events_select_admin
  on public.risk_events for select to authenticated
  using (public.is_admin());
