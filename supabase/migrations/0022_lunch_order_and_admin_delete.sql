-- ============================================================
-- LoveTrack — Migration 0022: lunch verifies in the middle, and admins can
-- undo a wrong entry
-- ============================================================
-- Two changes.
--
-- 1. THE LUNCH SEQUENCE MOVES.
--
--    It used to run: lunch start -> lunch end -> record the clip. The clip
--    therefore arrived after the meal was already marked complete, which is
--    the wrong way round — it proved nothing about the stretch it was meant
--    to cover, and a day could sit in 'lunch_verified' with no clip at all.
--
--    It now runs: lunch start -> clip -> lunch end. The clip is recorded
--    during the meal, and lunch cannot be ended until it exists. Lunch in
--    and lunch out no longer carry a photo of their own; the clip between
--    them is the evidence for the whole period.
--
-- 2. ADMINS CAN DELETE AN ENTRY.
--
--    A mistimed check-in currently cannot be undone by anyone, which pushes
--    people toward working around the record rather than correcting it. An
--    admin can now remove a single event or a whole day, with a reason,
--    and every deletion is written to the audit log first.
-- ============================================================

-- ---------- 1. the clip may be recorded while lunch is running ----------

create or replace function public.record_lunch_proof(
  p_video_path text,
  p_duration_s numeric default null,
  p_size_bytes integer default null,
  p_challenge_phrase text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  prof public.profiles;
  att public.attendance;
  today date;
  proof_id uuid;
begin
  if me is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  select * into prof from public.profiles where id = me;

  if prof.status <> 'active' then
    return jsonb_build_object('ok', false, 'error', 'account_suspended');
  end if;

  today := (now() at time zone coalesce(prof.timezone, 'Asia/Kolkata'))::date;

  select * into att
  from public.attendance
  where user_id = me and attendance_date = today
  for update;

  if att.id is null then
    return jsonb_build_object('ok', false, 'error', 'lunch_needs_check_in');
  end if;

  -- 'lunch_active' is the new case and the normal one: the clip is recorded
  -- during the meal. The later states stay accepted so days recorded under
  -- the old order, and any day being corrected afterwards, still work.
  if att.status not in ('lunch_active', 'lunch_verified', 'checked_out') then
    return jsonb_build_object('ok', false, 'error', 'lunch_not_started');
  end if;

  insert into public.lunch_proofs (
    attendance_id, user_id, video_path, duration_s, size_bytes, challenge_phrase
  )
  values (
    att.id, me, p_video_path, p_duration_s, p_size_bytes, p_challenge_phrase
  )
  on conflict (attendance_id) do nothing
  returning id into proof_id;

  if proof_id is null then
    return jsonb_build_object('ok', false, 'error', 'lunch_proof_exists');
  end if;

  return jsonb_build_object('ok', true, 'proof_id', proof_id);
end;
$$;

revoke all on function public.record_lunch_proof(text, numeric, integer, text) from public;
grant execute on function public.record_lunch_proof(text, numeric, integer, text) to authenticated;

-- ---------- lunch cannot end before the clip exists ----------
-- Enforced here rather than only in the UI. The client decides which screen
-- to show; the database decides what actually counts.

create or replace function public.lunch_proof_exists(p_attendance_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.lunch_proofs where attendance_id = p_attendance_id
  );
$$;

revoke all on function public.lunch_proof_exists(uuid) from public;
grant execute on function public.lunch_proof_exists(uuid) to authenticated;

-- ---------- 2. deleting an entry ----------
-- Hard delete, not a soft flag. A wrong entry is not history worth keeping,
-- and leaving tombstones in attendance_events would mean every read path
-- has to remember to filter them — one forgotten filter and a deleted
-- capture is back on somebody's partner feed.
--
-- What is kept is the audit record: who deleted what, when, and why. The
-- log is written before the row goes, so a deletion that fails to be
-- recorded does not happen at all.
--
-- The stored media is deliberately NOT removed here. Storage lives outside
-- the transaction, so a delete that half-succeeded would leave the row gone
-- and the file orphaned with no way to find it again. /admin/storage
-- already sweeps unreferenced media, and that is where it belongs.

create or replace function public.admin_delete_attendance_event(
  p_event_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.attendance_events;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if not public.is_admin() then
    return jsonb_build_object('ok', false, 'error', 'not_admin');
  end if;

  -- A reason is required. "Deleted by admin" with no explanation is the
  -- kind of record that makes an audit log worthless six months later.
  if v_reason is null or length(v_reason) < 3 then
    return jsonb_build_object('ok', false, 'error', 'reason_required');
  end if;

  select * into v_event
  from public.attendance_events
  where id = p_event_id;

  if v_event.id is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  insert into public.audit_logs (actor_id, action, target_user_id, detail)
  values (
    auth.uid(),
    'attendance_event_deleted',
    v_event.user_id,
    jsonb_build_object(
      'event_id', v_event.id,
      'attendance_id', v_event.attendance_id,
      'event_type', v_event.event_type,
      'server_timestamp', v_event.server_timestamp,
      'photo_path', v_event.photo_path,
      'reason', v_reason
    )
  );

  delete from public.attendance_events where id = p_event_id;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.admin_delete_attendance_event(uuid, text) from public;
grant execute on function public.admin_delete_attendance_event(uuid, text) to authenticated;

-- ---------- deleting a whole day ----------
-- Cascades to its events and its lunch clip through existing foreign keys.

create or replace function public.admin_delete_attendance_day(
  p_attendance_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day public.attendance;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_event_count integer;
begin
  if not public.is_admin() then
    return jsonb_build_object('ok', false, 'error', 'not_admin');
  end if;

  if v_reason is null or length(v_reason) < 3 then
    return jsonb_build_object('ok', false, 'error', 'reason_required');
  end if;

  select * into v_day from public.attendance where id = p_attendance_id;

  if v_day.id is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  select count(*) into v_event_count
  from public.attendance_events
  where attendance_id = p_attendance_id;

  insert into public.audit_logs (actor_id, action, target_user_id, detail)
  values (
    auth.uid(),
    'attendance_day_deleted',
    v_day.user_id,
    jsonb_build_object(
      'attendance_id', v_day.id,
      'attendance_date', v_day.attendance_date,
      'status', v_day.status,
      'events_removed', v_event_count,
      'reason', v_reason
    )
  );

  delete from public.attendance where id = p_attendance_id;

  return jsonb_build_object('ok', true, 'events_removed', v_event_count);
end;
$$;

revoke all on function public.admin_delete_attendance_day(uuid, text) from public;
grant execute on function public.admin_delete_attendance_day(uuid, text) to authenticated;

-- ---------- lunch_end now requires the clip ----------
-- Copied forward from 0008 (the most recent definition) with one guard
-- added, because a state machine this size cannot be patched in place.
-- The only difference from 0008 is the lunch_proof_exists check below.

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
    -- The clip is now recorded during the meal rather than after it, so
    -- lunch cannot be ended until it exists. Checked here and not only in
    -- the UI: the client picks which screen to show, the database decides
    -- what actually counts.
    if not public.lunch_proof_exists(att.id) then
      return jsonb_build_object('ok', false, 'error', 'lunch_proof_missing');
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
