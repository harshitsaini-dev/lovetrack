-- ============================================================
-- LoveTrack — Migration 0008: tune the risk scoring
-- ============================================================
-- Two changes, both prompted by watching the engine score real captures.
--
-- 1. Zero GPS drift was worth 30 points, which on its own crossed the flag
--    threshold. The reasoning was that real GPS always jitters — true on a
--    phone, but a laptop positioned from Wi-Fi or IP frequently returns
--    byte-identical coordinates for consecutive readings. Honest desktop
--    users were being flagged every single time.
--
--    It is now worth 15: still meaningful in combination with a weak
--    accuracy reading, no longer a verdict by itself.
--
-- 2. The point values are now columns rather than literals, so tuning the
--    engine is a settings change instead of a migration.
-- ============================================================

alter table public.system_settings
  add column if not exists points_accuracy_low integer not null default 25,
  add column if not exists points_zero_drift integer not null default 15,
  add column if not exists points_implausible_speed integer not null default 40;

comment on column public.system_settings.points_zero_drift is
  'Identical coordinates to the previous capture. Deliberately below the flag threshold: Wi-Fi positioning repeats exactly, so this is corroboration rather than proof.';

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
      score := score + cfg.points_accuracy_low;
      signals := signals || jsonb_build_object(
        'signal', 'accuracy_low_confidence', 'points', cfg.points_accuracy_low,
        'detail', round(p_accuracy_m) || 'm');
    end if;

    if p_fix_age_s is not null and p_fix_age_s > cfg.max_fix_age_s then
      score := score + 100;
      reason := coalesce(reason, 'location_stale');
      signals := signals || jsonb_build_object(
        'signal', 'location_stale', 'points', 100,
        'detail', round(p_fix_age_s) || 's old');
    end if;

    select * into prev
    from public.attendance_events
    where user_id = me and latitude is not null
    order by server_timestamp desc
    limit 1;

    if prev.id is not null then
      distance_m := 2 * 6371000 * asin(sqrt(
        power(sin(radians(p_latitude - prev.latitude) / 2), 2) +
        cos(radians(prev.latitude)) * cos(radians(p_latitude)) *
        power(sin(radians(p_longitude - prev.longitude) / 2), 2)
      ));
      elapsed_s := extract(epoch from (now() - prev.server_timestamp));

      if elapsed_s > 0 then
        speed_kmh := (distance_m / elapsed_s) * 3.6;

        if speed_kmh > cfg.max_speed_kmh then
          score := score + cfg.points_implausible_speed;
          signals := signals || jsonb_build_object(
            'signal', 'implausible_movement', 'points', cfg.points_implausible_speed,
            'detail', round(speed_kmh) || ' km/h implied');
        end if;
      end if;

      if distance_m = 0 then
        score := score + cfg.points_zero_drift;
        signals := signals || jsonb_build_object(
          'signal', 'zero_gps_drift', 'points', cfg.points_zero_drift,
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

  insert into public.risk_events (user_id, attendance_event_id, signal, detail, points)
  select me, event_id, s->>'signal', s->>'detail', (s->>'points')::integer
  from jsonb_array_elements(signals) s;

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
