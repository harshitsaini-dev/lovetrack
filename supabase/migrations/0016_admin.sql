-- ============================================================
-- LoveTrack — Migration 0016: admin operations
-- ============================================================
-- Admins already have SELECT policies on every table, so listing things
-- needs no new machinery. What needs care is the other half: the actions
-- that change somebody's account, and the reads that open somebody's
-- evidence.
--
-- Those go through functions here for one reason — every one of them
-- writes an audit entry in the same transaction. An admin action that
-- succeeds but leaves no trace is the failure mode worth designing against,
-- because it is invisible afterwards.
-- ============================================================

-- ---------- dashboard counts ----------
-- One round trip. Each figure is "today" in each user's own timezone,
-- not the server's, so someone in another zone is counted on their day.

create or replace function public.admin_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not public.is_admin() then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  select jsonb_build_object(
    'ok', true,
    'users', (select count(*) from public.profiles),
    'suspended', (select count(*) from public.profiles where status = 'suspended'),
    'pairs', (select count(*) from public.pairs where status = 'accepted'),

    'checked_in_today', (
      select count(*) from public.profiles p
      join public.attendance a on a.user_id = p.id
       and a.attendance_date = (now() at time zone p.timezone)::date
      where a.status <> 'not_started'
    ),
    'completed_today', (
      select count(*) from public.profiles p
      join public.attendance a on a.user_id = p.id
       and a.attendance_date = (now() at time zone p.timezone)::date
      where a.status = 'checked_out'
    ),
    'on_leave_today', (
      select count(*) from public.profiles p
      join public.leave_requests l on l.user_id = p.id
       and l.leave_date = (now() at time zone p.timezone)::date
      where l.status = 'recorded'
    ),

    -- The number that actually needs looking at.
    'needs_review', (
      select count(*) from public.attendance_events
      where status <> 'passed'
        and server_timestamp > now() - interval '30 days'
    ),
    'emails_failed_7d', (
      select count(*) from public.email_logs
      where status = 'failed' and created_at > now() - interval '7 days'
    )
  ) into result;

  return result;
end;
$$;

revoke all on function public.admin_stats() from public;
grant execute on function public.admin_stats() to authenticated;

-- ---------- user list ----------
-- Joined with today's state so the list answers the question an admin
-- actually has, rather than needing a second query per row.

create or replace function public.admin_list_users(
  p_search text default null,
  p_limit integer default 50
)
returns table (
  id uuid,
  email text,
  full_name text,
  avatar_url text,
  role public.user_role,
  status public.account_status,
  timezone text,
  created_at timestamptz,
  today_status public.attendance_status,
  flagged_30d bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id, p.email, p.full_name, p.avatar_url, p.role, p.status, p.timezone,
    p.created_at,
    coalesce(a.status, 'not_started'::public.attendance_status),
    (
      select count(*) from public.attendance_events e
      where e.user_id = p.id
        and e.status <> 'passed'
        and e.server_timestamp > now() - interval '30 days'
    )
  from public.profiles p
  left join public.attendance a
    on a.user_id = p.id
   and a.attendance_date = (now() at time zone p.timezone)::date
  where public.is_admin()
    and (
      p_search is null
      or p.email ilike '%' || p_search || '%'
      or coalesce(p.full_name, '') ilike '%' || p_search || '%'
    )
  order by p.created_at desc
  limit least(coalesce(p_limit, 50), 200);
$$;

revoke all on function public.admin_list_users(text, integer) from public;
grant execute on function public.admin_list_users(text, integer) to authenticated;

-- ---------- suspend / restore ----------

create or replace function public.admin_set_user_status(
  p_user_id uuid,
  p_status public.account_status,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  target public.profiles%rowtype;
begin
  if not public.is_admin() then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  -- An admin locking themselves out helps nobody, and there may be only
  -- one of them.
  if p_user_id = me then
    return jsonb_build_object('ok', false, 'error', 'cannot_suspend_self');
  end if;

  select * into target from public.profiles where id = p_user_id;
  if target.id is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  -- Suspending another admin would be one admin overruling another with no
  -- way back if they are the last two. Demote first, deliberately.
  if target.role = 'admin' and p_status = 'suspended' then
    return jsonb_build_object('ok', false, 'error', 'cannot_suspend_admin');
  end if;

  update public.profiles set status = p_status where id = p_user_id;

  insert into public.audit_logs (actor_id, action, target_user_id, detail)
  values (
    me,
    case when p_status = 'suspended' then 'user_suspended' else 'user_restored' end,
    p_user_id,
    jsonb_build_object('reason', nullif(trim(coalesce(p_reason, '')), ''))
  );

  return jsonb_build_object('ok', true, 'status', p_status);
end;
$$;

revoke all on function public.admin_set_user_status(uuid, public.account_status, text) from public;
grant execute on function public.admin_set_user_status(uuid, public.account_status, text) to authenticated;

-- ---------- submissions that need a look ----------

create or replace function public.admin_flagged_events(p_limit integer default 50)
returns table (
  id uuid,
  user_id uuid,
  email text,
  full_name text,
  event_type public.attendance_event_type,
  server_timestamp timestamptz,
  place_label text,
  latitude double precision,
  longitude double precision,
  accuracy_m double precision,
  photo_path text,
  device_label text,
  risk_score integer,
  status public.verification_status,
  failure_reason text,
  signals jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select
    e.id, e.user_id, p.email, p.full_name,
    e.event_type, e.server_timestamp,
    e.place_label, e.latitude, e.longitude, e.accuracy_m,
    e.photo_path, e.device_label,
    e.risk_score, e.status, e.failure_reason,
    -- The signals travel with the event, so a score is never presented as
    -- a bare number an admin has to take on faith.
    coalesce(
      (
        select jsonb_agg(jsonb_build_object(
          'signal', r.signal, 'points', r.points, 'detail', r.detail
        ) order by r.points desc)
        from public.risk_events r
        where r.attendance_event_id = e.id
      ),
      '[]'::jsonb
    )
  from public.attendance_events e
  join public.profiles p on p.id = e.user_id
  where public.is_admin()
    and e.status <> 'passed'
  order by e.server_timestamp desc
  limit least(coalesce(p_limit, 50), 200);
$$;

revoke all on function public.admin_flagged_events(integer) from public;
grant execute on function public.admin_flagged_events(integer) to authenticated;

-- ---------- looking at somebody's evidence is itself an event ----------

create or replace function public.admin_log_media_view(
  p_target_user_id uuid,
  p_kind text,
  p_path text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  insert into public.audit_logs (actor_id, action, target_user_id, detail)
  values (
    auth.uid(),
    'media_viewed',
    p_target_user_id,
    jsonb_build_object('kind', p_kind, 'path', p_path)
  );

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.admin_log_media_view(uuid, text, text) from public;
grant execute on function public.admin_log_media_view(uuid, text, text) to authenticated;

-- ---------- audit trail for settings changes ----------
-- system_settings is updatable directly by an admin via RLS, which is fine,
-- but a change to the risk thresholds should not be silent.

create or replace function public.log_settings_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_logs (actor_id, action, detail)
  values (
    auth.uid(),
    'settings_changed',
    jsonb_build_object(
      'before', to_jsonb(old) - 'updated_at',
      'after', to_jsonb(new) - 'updated_at'
    )
  );

  return new;
end;
$$;

drop trigger if exists system_settings_audited on public.system_settings;
create trigger system_settings_audited
  after update on public.system_settings
  for each row
  execute function public.log_settings_change();
