-- KYC pipeline alignment:
-- enforce front-camera capture mode at data model level.

create extension if not exists pgcrypto;

-- Ensure table exists (safe if already created by previous migration)
create table if not exists public.kyc_selfie_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null unique,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  provider text not null default 'internal_v1',
  rejection_reason text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Add capture_mode column if missing
alter table public.kyc_selfie_submissions
  add column if not exists capture_mode text;

-- Backfill existing rows then enforce not-null/default/check
update public.kyc_selfie_submissions
set capture_mode = 'front_camera'
where capture_mode is null;

alter table public.kyc_selfie_submissions
  alter column capture_mode set default 'front_camera';

alter table public.kyc_selfie_submissions
  alter column capture_mode set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'kyc_selfie_submissions_capture_mode_check'
      and conrelid = 'public.kyc_selfie_submissions'::regclass
  ) then
    alter table public.kyc_selfie_submissions
      add constraint kyc_selfie_submissions_capture_mode_check
      check (capture_mode in ('front_camera'));
  end if;
end $$;

create index if not exists idx_kyc_selfie_submissions_status_created
  on public.kyc_selfie_submissions (status, created_at desc);

