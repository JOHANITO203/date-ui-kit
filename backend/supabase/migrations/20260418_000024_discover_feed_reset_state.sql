-- Persist Discover feed interactions to support prod-ready reset/recycle logic.
create table if not exists public.discover_feed_events (
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_id uuid not null references auth.users(id) on delete cascade,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_swiped_at timestamptz,
  last_decision text,
  seen_count integer not null default 1,
  last_feed_cursor text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint discover_feed_events_pkey primary key (user_id, profile_id),
  constraint discover_feed_events_seen_count_check check (seen_count >= 1),
  constraint discover_feed_events_decision_check check (
    last_decision is null or last_decision in ('like', 'dislike', 'superlike')
  )
);

create index if not exists idx_discover_feed_events_user_decision_seen
  on public.discover_feed_events (user_id, last_decision, last_seen_at desc);

create index if not exists idx_discover_feed_events_profile
  on public.discover_feed_events (profile_id, updated_at desc);

alter table public.discover_feed_events enable row level security;

-- Keep policy names stable for idempotent re-run.
drop policy if exists "discover_feed_events_select_own" on public.discover_feed_events;
create policy "discover_feed_events_select_own"
  on public.discover_feed_events
  for select
  using (auth.uid() = user_id);

drop policy if exists "discover_feed_events_insert_own" on public.discover_feed_events;
create policy "discover_feed_events_insert_own"
  on public.discover_feed_events
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "discover_feed_events_update_own" on public.discover_feed_events;
create policy "discover_feed_events_update_own"
  on public.discover_feed_events
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists trg_discover_feed_events_updated_at on public.discover_feed_events;
create trigger trg_discover_feed_events_updated_at
before update on public.discover_feed_events
for each row
execute procedure public.set_updated_at();
