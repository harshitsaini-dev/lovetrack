-- ============================================================
-- LoveTrack — Migration 0017: move tunables out of the environment
-- ============================================================
-- Several knobs lived in .env: nonce lifetime, lunch clip limits, signed
-- URL lifetime. They are not secrets and they are not deployment facts —
-- they are product decisions, and changing one meant a redeploy.
--
-- They move here, where an admin can change them and the change lands in
-- the audit log alongside everything else.
--
-- What deliberately does NOT move:
--
--   RESEND_API_KEY, SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET, NONCE_SECRET,
--   R2 credentials
--
-- Those are secrets. Putting a secret in a table an admin can read turns
-- every admin session into a way to exfiltrate it, and puts it in database
-- backups. Secrets stay in the environment.
--
--   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_APP_URL
--
-- Those are deployment facts, needed before a database connection exists.
-- ============================================================

alter table public.system_settings
  -- How long a capture has to be submitted after its nonce is issued.
  -- Long enough to take a photo and grant a location prompt; short enough
  -- that a stolen nonce is worthless.
  add column if not exists nonce_ttl_seconds integer not null default 180,

  -- Lunch clip bounds. Shorter than the minimum proves nothing; longer
  -- than the maximum is storage nobody looks at.
  add column if not exists lunch_min_seconds integer not null default 5,
  add column if not exists lunch_max_seconds integer not null default 20,
  add column if not exists lunch_max_bytes integer not null default 8000000,

  -- Lifetime of a signed media URL. Short, because the link is the access.
  add column if not exists signed_url_ttl_seconds integer not null default 300,

  -- Nudge the user to record leave rather than ignore a reminder.
  add column if not exists reminder_grace_minutes integer not null default 0;

comment on column public.system_settings.nonce_ttl_seconds is
  'Seconds a capture nonce stays valid. Not a secret — the secret is the nonce itself.';
comment on column public.system_settings.signed_url_ttl_seconds is
  'Seconds a signed media URL lives. The link IS the access, so keep it short.';

-- Sanity bounds, so a mistyped value cannot quietly disable a protection.
alter table public.system_settings
  drop constraint if exists system_settings_sane_values;

alter table public.system_settings
  add constraint system_settings_sane_values check (
    nonce_ttl_seconds between 30 and 900
    and lunch_min_seconds between 1 and 60
    and lunch_max_seconds between lunch_min_seconds and 120
    and lunch_max_bytes between 100000 and 52428800
    and signed_url_ttl_seconds between 30 and 3600
    and warn_accuracy_m < max_accuracy_m
    and risk_flag_threshold < risk_reject_threshold
    and reminder_grace_minutes between 0 and 240
  );

-- ---------- the nonce function reads the setting ----------

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
  ttl integer;
  new_id uuid;
begin
  if me is null then
    raise exception 'Not authenticated';
  end if;

  select nonce_ttl_seconds into ttl from public.system_settings where id;

  delete from public.attendance_nonces
  where user_id = me and expires_at < now() - interval '1 day';

  insert into public.attendance_nonces (user_id, event_type, expires_at)
  values (me, p_event_type, now() + make_interval(secs => coalesce(ttl, 180)))
  returning id into new_id;

  return new_id;
end;
$$;

revoke all on function public.issue_attendance_nonce(public.attendance_event_type) from public;
grant execute on function public.issue_attendance_nonce(public.attendance_event_type) to authenticated;

-- ---------- settings the client legitimately needs ----------
-- The lunch recorder has to know its own limits before it starts. These
-- few values are safe to read: they are the rules being applied, not the
-- means of bypassing them.

create or replace function public.get_public_settings()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'lunch_min_seconds', lunch_min_seconds,
    'lunch_max_seconds', lunch_max_seconds,
    'lunch_max_bytes', lunch_max_bytes,
    'max_accuracy_m', max_accuracy_m,
    'warn_accuracy_m', warn_accuracy_m,
    'max_fix_age_s', max_fix_age_s
  )
  from public.system_settings where id;
$$;

revoke all on function public.get_public_settings() from public;
grant execute on function public.get_public_settings() to authenticated;
