-- Wave A extension: real profile photo storage pipeline.
-- Creates storage bucket + metadata table.

insert into storage.buckets (id, name, public)
values ('profile-photos', 'profile-photos', false)
on conflict (id) do nothing;

create table if not exists public.profile_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null unique,
  sort_order integer not null default 1,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_profile_photos_user_order
  on public.profile_photos (user_id, sort_order asc);

alter table public.profile_photos enable row level security;

drop policy if exists "profile_photos_select_own" on public.profile_photos;
create policy "profile_photos_select_own"
  on public.profile_photos
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "profile_photos_insert_own" on public.profile_photos;
create policy "profile_photos_insert_own"
  on public.profile_photos
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "profile_photos_update_own" on public.profile_photos;
create policy "profile_photos_update_own"
  on public.profile_photos
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "profile_photos_delete_own" on public.profile_photos;
create policy "profile_photos_delete_own"
  on public.profile_photos
  for delete
  to authenticated
  using (auth.uid() = user_id);

drop trigger if exists trg_profile_photos_updated_at on public.profile_photos;
create trigger trg_profile_photos_updated_at
before update on public.profile_photos
for each row
execute procedure public.set_updated_at();

-- Keep object access private and scoped per-user folder.
drop policy if exists "profile_photos_object_select_own" on storage.objects;
create policy "profile_photos_object_select_own"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "profile_photos_object_insert_own" on storage.objects;
create policy "profile_photos_object_insert_own"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "profile_photos_object_update_own" on storage.objects;
create policy "profile_photos_object_update_own"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "profile_photos_object_delete_own" on storage.objects;
create policy "profile_photos_object_delete_own"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
