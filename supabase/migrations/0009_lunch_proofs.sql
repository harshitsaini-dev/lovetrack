-- ============================================================
-- LoveTrack — Migration 0009: lunch proof videos
-- ============================================================
-- Lunch already flows through the attendance engine (lunch_start and
-- lunch_end are event types on record_attendance_event). What this adds is
-- the proof itself: a short clip recorded at lunch_end.
--
-- Videos live in their own private bucket rather than alongside the check-in
-- photos, because they need a much larger size limit and a different mime
-- type — and because they are the one piece of media a user can choose to
-- share with a partner.
--
-- Storage note: at ~2MB a clip, a year of daily lunches is roughly 700MB per
-- user. Duration and size are capped here and retention is enforced by the
-- cron in Phase 6, otherwise this is the file that quietly eats a free tier.
-- ============================================================

create table if not exists public.lunch_proofs (
  id uuid primary key default gen_random_uuid(),
  attendance_id uuid not null references public.attendance (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- The lunch_end event this clip was recorded for.
  event_id uuid references public.attendance_events (id) on delete set null,

  video_path text not null,
  duration_s numeric(5, 2),
  size_bytes integer,
  -- Stored so a reviewer can tell what the person was asked to say.
  challenge_phrase text,

  created_at timestamptz not null default now(),

  constraint lunch_proofs_one_per_day unique (attendance_id)
);

create index if not exists lunch_proofs_user_idx
  on public.lunch_proofs (user_id, created_at desc);

alter table public.lunch_proofs enable row level security;
alter table public.lunch_proofs force row level security;

drop policy if exists lunch_proofs_select_own on public.lunch_proofs;
create policy lunch_proofs_select_own
  on public.lunch_proofs for select to authenticated
  using (user_id = auth.uid());

-- Unlike check-in photos, a partner CAN see this — but only if the user has
-- explicitly turned that switch on. It defaults to off.
drop policy if exists lunch_proofs_select_partner on public.lunch_proofs;
create policy lunch_proofs_select_partner
  on public.lunch_proofs for select to authenticated
  using (public.can_view_shared(user_id, 'lunch_proof'));

drop policy if exists lunch_proofs_select_admin on public.lunch_proofs;
create policy lunch_proofs_select_admin
  on public.lunch_proofs for select to authenticated
  using (public.is_admin());

-- ============================================================
-- Recording the proof
-- ============================================================
-- A separate function from record_attendance_event because the upload has
-- to finish first: the clip is written to storage, then this links it to
-- the day. It refuses to attach a clip to a day that did not have a lunch.

create or replace function public.record_lunch_proof(
  p_video_path text,
  p_duration_s numeric,
  p_size_bytes integer,
  p_challenge_phrase text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  prof public.profiles%rowtype;
  today date;
  att public.attendance%rowtype;
  last_event uuid;
  proof_id uuid;
begin
  if me is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  select * into prof from public.profiles where id = me;
  if prof.status <> 'active' then
    return jsonb_build_object('ok', false, 'error', 'account_suspended');
  end if;

  today := (now() at time zone prof.timezone)::date;

  select * into att
  from public.attendance
  where user_id = me and attendance_date = today
  for update;

  if att.id is null then
    return jsonb_build_object('ok', false, 'error', 'lunch_needs_check_in');
  end if;

  -- The clip belongs to a finished lunch. Attaching one to a day where
  -- lunch never happened would make the record say something untrue.
  if att.status not in ('lunch_verified', 'checked_out') then
    return jsonb_build_object('ok', false, 'error', 'lunch_not_finished');
  end if;

  if exists (select 1 from public.lunch_proofs where attendance_id = att.id) then
    return jsonb_build_object('ok', false, 'error', 'proof_already_recorded');
  end if;

  select id into last_event
  from public.attendance_events
  where attendance_id = att.id and event_type = 'lunch_end'
  order by server_timestamp desc
  limit 1;

  insert into public.lunch_proofs (
    attendance_id, user_id, event_id,
    video_path, duration_s, size_bytes, challenge_phrase
  ) values (
    att.id, me, last_event,
    p_video_path, p_duration_s, p_size_bytes, p_challenge_phrase
  )
  returning id into proof_id;

  return jsonb_build_object('ok', true, 'proof_id', proof_id);
end;
$$;

revoke all on function public.record_lunch_proof(text, numeric, integer, text) from public;
grant execute on function public.record_lunch_proof(text, numeric, integer, text) to authenticated;

-- ============================================================
-- Storage
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'lunch-proofs',
  'lunch-proofs',
  false,
  -- 20 seconds of 480p WebM lands well under this; the cap exists so a
  -- crafted upload cannot fill the bucket.
  20 * 1024 * 1024,
  array['video/webm', 'video/mp4']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists lunch_proofs_insert_own on storage.objects;
create policy lunch_proofs_insert_own
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'lunch-proofs'
    and (storage.foldername(name))[1] = 'users'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

drop policy if exists lunch_proofs_read_own on storage.objects;
create policy lunch_proofs_read_own
  on storage.objects for select to authenticated
  using (
    bucket_id = 'lunch-proofs'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

-- A partner reads the clip through a short-lived signed URL minted by the
-- server, which checks can_view_shared() first — not by querying storage
-- directly, so there is no policy for them here.

drop policy if exists lunch_proofs_read_admin on storage.objects;
create policy lunch_proofs_read_admin
  on storage.objects for select to authenticated
  using (bucket_id = 'lunch-proofs' and public.is_admin());
