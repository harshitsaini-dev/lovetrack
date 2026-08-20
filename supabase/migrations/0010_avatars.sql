-- ============================================================
-- LoveTrack — Migration 0010: profile pictures
-- ============================================================
-- Avatars are the one piece of media that is meant to be seen. A paired
-- partner needs to recognise who they are looking at, and an admin needs it
-- in the user list — so unlike check-in photos and lunch clips, this bucket
-- is public-read.
--
-- Nothing sensitive belongs here. The bucket is small, image-only, and the
-- write policy still keys off the owner's path, so nobody can overwrite
-- somebody else's face.
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  2 * 1024 * 1024,
  array['image/webp', 'image/jpeg', 'image/png']
)
on conflict (id) do update
set public = true,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists avatars_read_all on storage.objects;
create policy avatars_read_all
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists avatars_insert_own on storage.objects;
create policy avatars_insert_own
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Replacing your own picture is a normal thing to do, so unlike evidence
-- media these objects are updatable and deletable — by their owner only.
drop policy if exists avatars_update_own on storage.objects;
create policy avatars_update_own
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists avatars_delete_own on storage.objects;
create policy avatars_delete_own
  on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
