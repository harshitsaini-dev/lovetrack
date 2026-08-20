-- ============================================================
-- LoveTrack — Migration 0007: private storage for attendance photos
-- ============================================================
-- Check-in photos live in a PRIVATE bucket. There is no public URL: the app
-- mints a short-lived signed URL when a photo actually needs to be shown.
--
-- Note on who can see them: a partner sees times and (if shared) places,
-- but never the photo. The photo is anti-fraud evidence, not part of the
-- activity feed — so it stays between the user and an admin.
--
-- Phase 5 moves the larger lunch videos to Cloudflare R2. Photos are small
-- enough (~50KB of WebP) to stay here.
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'attendance-media',
  'attendance-media',
  false,
  2 * 1024 * 1024,               -- 2 MB is generous for a 720px WebP frame
  array['image/webp', 'image/jpeg']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Paths are users/<uid>/<yyyy>/<mm>/<type>-<uuid>.webp, so the second
-- segment is the owner and the policies key off it.

drop policy if exists attendance_media_insert_own on storage.objects;
create policy attendance_media_insert_own
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'attendance-media'
    and (storage.foldername(name))[1] = 'users'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

drop policy if exists attendance_media_select_own on storage.objects;
create policy attendance_media_select_own
  on storage.objects for select to authenticated
  using (
    bucket_id = 'attendance-media'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

drop policy if exists attendance_media_select_admin on storage.objects;
create policy attendance_media_select_admin
  on storage.objects for select to authenticated
  using (bucket_id = 'attendance-media' and public.is_admin());

-- No UPDATE or DELETE policy. Evidence is append-only for users; removing
-- it is an admin action carried out with the service role, and audited.
