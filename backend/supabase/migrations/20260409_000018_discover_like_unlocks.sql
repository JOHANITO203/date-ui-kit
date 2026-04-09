-- IceBreaker unlock is unitary: one consumed item unlocks one like row.

create extension if not exists pgcrypto;

create table if not exists public.discover_like_unlocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  like_id uuid not null references public.discover_likes(id) on delete cascade,
  unlock_method text not null default 'icebreaker'
    check (unlock_method in ('icebreaker')),
  consumed_item_id text not null default 'instant-icebreaker',
  created_at timestamptz not null default now(),
  unique (user_id, like_id)
);

create index if not exists idx_discover_like_unlocks_user_created
  on public.discover_like_unlocks (user_id, created_at desc);

alter table public.discover_like_unlocks enable row level security;

drop policy if exists "discover_like_unlocks_select_own" on public.discover_like_unlocks;
create policy "discover_like_unlocks_select_own"
  on public.discover_like_unlocks
  for select
  using (auth.uid() = user_id);

drop policy if exists "discover_like_unlocks_insert_own" on public.discover_like_unlocks;
create policy "discover_like_unlocks_insert_own"
  on public.discover_like_unlocks
  for insert
  with check (auth.uid() = user_id);
