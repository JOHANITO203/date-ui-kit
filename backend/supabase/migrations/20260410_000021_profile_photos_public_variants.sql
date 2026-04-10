-- Public optimized variants bucket for profile photos.
-- Originals remain in private `profile-photos`, variants are served from a stable public bucket.

insert into storage.buckets (id, name, public)
values ('profile-photos-public', 'profile-photos-public', true)
on conflict (id) do update
set public = excluded.public;

-- Allow public read for optimized variants.
drop policy if exists "profile_photos_public_read" on storage.objects;
create policy "profile_photos_public_read"
  on storage.objects
  for select
  using (bucket_id = 'profile-photos-public');
