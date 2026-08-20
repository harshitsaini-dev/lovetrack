-- ============================================================
-- LoveTrack — Migration 0011: data retention
-- ============================================================
-- Media is what fills a free tier. A lunch clip is ~2MB, so two people
-- recording daily is roughly 1.5GB a year — past the free allowance well
-- before the app stops being useful.
--
-- The approach here is to age out the MEDIA while keeping the RECORD. An
-- attendance row is a few hundred bytes and is the thing people actually
-- want to look back on; the photograph that proved it was live matters for
-- weeks, not years. So the default policy blanks media paths after a while
-- and only removes whole rows much later, if at all.
--
-- Deleting the storage objects themselves cannot happen in SQL — Postgres
-- has no access to the object store. This returns the paths so the caller
-- can remove them, and only clears the rows once that has been done.
-- ============================================================

-- ---------- audit log ----------
-- Brought forward from the admin phase because retention is exactly the
-- kind of action that must leave a trace: it destroys other people's
-- evidence, and "who deleted it and when" has to be answerable afterwards.

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  target_user_id uuid references public.profiles (id) on delete set null,
  detail jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_created_idx
  on public.audit_logs (created_at desc);
create index if not exists audit_logs_actor_idx
  on public.audit_logs (actor_id, created_at desc);

alter table public.audit_logs enable row level security;
alter table public.audit_logs force row level security;

-- Admins read it; nobody writes it from a client. Entries are made by the
-- SECURITY DEFINER functions that perform the actions, so the log cannot
-- be edited by whoever is being logged.
drop policy if exists audit_logs_select_admin on public.audit_logs;
create policy audit_logs_select_admin
  on public.audit_logs for select to authenticated
  using (public.is_admin());

-- ---------- retention settings ----------

alter table public.system_settings
  -- Blank a photo/clip once it is this old. 0 disables media retention.
  add column if not exists media_retention_days integer not null default 90,
  -- Remove whole attendance rows this old. 0 keeps history forever, which
  -- is the default: the record is small and it is the user's own history.
  add column if not exists record_retention_days integer not null default 0;

comment on column public.system_settings.media_retention_days is
  'Age at which photos and lunch clips are purged. The attendance record itself survives.';
comment on column public.system_settings.record_retention_days is
  'Age at which whole attendance rows are deleted. 0 = never.';

-- ---------- what would be cleaned up ----------
-- Read-only, so an admin can see the effect before committing to it.
-- Deleting someone's evidence is not a thing to do behind a spinner.

create or replace function public.preview_retention_cleanup()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  cfg public.system_settings%rowtype;
  media_cutoff date;
  record_cutoff date;
  photo_count integer := 0;
  clip_count integer := 0;
  clip_bytes bigint := 0;
  row_count integer := 0;
begin
  if not public.is_admin() then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  select * into cfg from public.system_settings where id;

  if cfg.media_retention_days > 0 then
    media_cutoff := (current_date - cfg.media_retention_days);

    select count(*) into photo_count
    from public.attendance_events e
    join public.attendance a on a.id = e.attendance_id
    where e.photo_path is not null and a.attendance_date < media_cutoff;

    select count(*), coalesce(sum(p.size_bytes), 0)
    into clip_count, clip_bytes
    from public.lunch_proofs p
    join public.attendance a on a.id = p.attendance_id
    where a.attendance_date < media_cutoff;
  end if;

  if cfg.record_retention_days > 0 then
    record_cutoff := (current_date - cfg.record_retention_days);

    select count(*) into row_count
    from public.attendance
    where attendance_date < record_cutoff;
  end if;

  return jsonb_build_object(
    'ok', true,
    'media_retention_days', cfg.media_retention_days,
    'record_retention_days', cfg.record_retention_days,
    'media_cutoff', media_cutoff,
    'record_cutoff', record_cutoff,
    'photos', photo_count,
    'clips', clip_count,
    'clip_bytes', clip_bytes,
    'attendance_rows', row_count
  );
end;
$$;

revoke all on function public.preview_retention_cleanup() from public;
grant execute on function public.preview_retention_cleanup() to authenticated;

-- ---------- which objects to remove ----------

create or replace function public.list_expired_media()
returns table (bucket text, path text)
language plpgsql
security definer
set search_path = public
as $$
declare
  cfg public.system_settings%rowtype;
  cutoff date;
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;

  select * into cfg from public.system_settings where id;
  if cfg.media_retention_days <= 0 then
    return;
  end if;

  cutoff := (current_date - cfg.media_retention_days);

  return query
    select 'attendance-media'::text, e.photo_path
    from public.attendance_events e
    join public.attendance a on a.id = e.attendance_id
    where e.photo_path is not null and a.attendance_date < cutoff
  union all
    select 'lunch-proofs'::text, p.video_path
    from public.lunch_proofs p
    join public.attendance a on a.id = p.attendance_id
    where a.attendance_date < cutoff;
end;
$$;

revoke all on function public.list_expired_media() from public;
grant execute on function public.list_expired_media() to authenticated;

-- ---------- clear the references ----------
-- Called after the objects are gone, so a row never points at a file that
-- no longer exists.

create or replace function public.apply_retention_cleanup()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  cfg public.system_settings%rowtype;
  cutoff date;
  photos_cleared integer := 0;
  clips_cleared integer := 0;
  rows_deleted integer := 0;
begin
  if not public.is_admin() then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  select * into cfg from public.system_settings where id;

  if cfg.media_retention_days > 0 then
    cutoff := (current_date - cfg.media_retention_days);

    with expired as (
      select e.id
      from public.attendance_events e
      join public.attendance a on a.id = e.attendance_id
      where e.photo_path is not null and a.attendance_date < cutoff
    )
    update public.attendance_events e
    -- The event survives with its time, location and verdict intact. Only
    -- the image is gone, and the row says so rather than pretending there
    -- never was one.
    set photo_path = null, failure_reason = coalesce(e.failure_reason, 'media_expired')
    from expired
    where e.id = expired.id;

    get diagnostics photos_cleared = row_count;

    with expired as (
      select p.id
      from public.lunch_proofs p
      join public.attendance a on a.id = p.attendance_id
      where a.attendance_date < cutoff
    )
    delete from public.lunch_proofs p
    using expired
    where p.id = expired.id;

    get diagnostics clips_cleared = row_count;
  end if;

  if cfg.record_retention_days > 0 then
    delete from public.attendance
    where attendance_date < (current_date - cfg.record_retention_days);

    get diagnostics rows_deleted = row_count;
  end if;

  -- Used nonces are pure exhaust; nothing refers to them after a day.
  delete from public.attendance_nonces where expires_at < now() - interval '7 days';

  insert into public.audit_logs (actor_id, action, detail)
  values (
    auth.uid(),
    'retention_cleanup',
    jsonb_build_object(
      'photos_cleared', photos_cleared,
      'clips_deleted', clips_cleared,
      'attendance_rows_deleted', rows_deleted
    )
  );

  return jsonb_build_object(
    'ok', true,
    'photos_cleared', photos_cleared,
    'clips_deleted', clips_cleared,
    'attendance_rows_deleted', rows_deleted
  );
end;
$$;

revoke all on function public.apply_retention_cleanup() from public;
grant execute on function public.apply_retention_cleanup() to authenticated;
