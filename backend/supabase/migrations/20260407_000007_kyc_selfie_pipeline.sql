-- Wave A extension: minimal KYC selfie pipeline.
-- Stores selfie submission metadata and tracks moderation status.

create extension if not exists pgcrypto;

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

create index if not exists idx_kyc_selfie_submissions_user_created
  on public.kyc_selfie_submissions (user_id, created_at desc);

alter table public.kyc_selfie_submissions enable row level security;

drop policy if exists "kyc_selfie_submissions_select_own" on public.kyc_selfie_submissions;
create policy "kyc_selfie_submissions_select_own"
  on public.kyc_selfie_submissions
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "kyc_selfie_submissions_insert_own" on public.kyc_selfie_submissions;
create policy "kyc_selfie_submissions_insert_own"
  on public.kyc_selfie_submissions
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "kyc_selfie_submissions_update_own" on public.kyc_selfie_submissions;
create policy "kyc_selfie_submissions_update_own"
  on public.kyc_selfie_submissions
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists trg_kyc_selfie_submissions_updated_at on public.kyc_selfie_submissions;
create trigger trg_kyc_selfie_submissions_updated_at
before update on public.kyc_selfie_submissions
for each row execute function public.set_updated_at();

