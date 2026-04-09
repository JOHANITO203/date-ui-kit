-- Discover likes source-of-truth + cleanup/backfill from legacy chat-like previews.

create extension if not exists pgcrypto;

create table if not exists public.discover_likes (
  id uuid primary key default gen_random_uuid(),
  liker_user_id uuid not null references auth.users(id) on delete cascade,
  liked_user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'matched', 'passed')),
  was_superlike boolean not null default false,
  hidden_by_shadowghost boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  matched_at timestamptz,
  passed_at timestamptz
);

create unique index if not exists uq_discover_likes_pair
  on public.discover_likes (liker_user_id, liked_user_id);

create index if not exists idx_discover_likes_liked_status_created
  on public.discover_likes (liked_user_id, status, created_at desc);

create index if not exists idx_discover_likes_liker_status_created
  on public.discover_likes (liker_user_id, status, created_at desc);

alter table public.discover_likes enable row level security;

drop policy if exists "discover_likes_select_own" on public.discover_likes;
create policy "discover_likes_select_own"
  on public.discover_likes
  for select
  using (auth.uid() = liker_user_id or auth.uid() = liked_user_id);

drop policy if exists "discover_likes_insert_liker" on public.discover_likes;
create policy "discover_likes_insert_liker"
  on public.discover_likes
  for insert
  with check (auth.uid() = liker_user_id);

drop policy if exists "discover_likes_update_own" on public.discover_likes;
create policy "discover_likes_update_own"
  on public.discover_likes
  for update
  using (auth.uid() = liker_user_id or auth.uid() = liked_user_id)
  with check (auth.uid() = liker_user_id or auth.uid() = liked_user_id);

drop trigger if exists trg_discover_likes_updated_at on public.discover_likes;
create trigger trg_discover_likes_updated_at
before update on public.discover_likes
for each row
execute procedure public.set_updated_at();

-- Backfill legacy "like-like" chat previews into discover_likes as pending incoming likes.
insert into public.discover_likes (
  liker_user_id,
  liked_user_id,
  status,
  was_superlike,
  hidden_by_shadowghost,
  created_at,
  updated_at
)
select
  cc.peer_profile_id::uuid as liker_user_id,
  cc.user_id::uuid as liked_user_id,
  'pending' as status,
  (cc.last_message_preview = 'This chat started from a SuperLike.') as was_superlike,
  false as hidden_by_shadowghost,
  coalesce(cc.last_message_at, now()) as created_at,
  now() as updated_at
from public.chat_conversations cc
where cc.relation_state = 'active'
  and cc.last_message_preview in ('Liked your profile.', 'This chat started from a SuperLike.')
on conflict (liker_user_id, liked_user_id)
do update
set
  was_superlike = excluded.was_superlike or public.discover_likes.was_superlike,
  updated_at = now();

-- Normalize timestamps/status consistency.
update public.discover_likes
set
  updated_at = coalesce(updated_at, now()),
  created_at = coalesce(created_at, now()),
  matched_at = case when status = 'matched' then coalesce(matched_at, now()) else null end,
  passed_at = case when status = 'passed' then coalesce(passed_at, now()) else null end
where true;

-- If both directions are still pending, mark both as matched.
with reciprocal_pending as (
  select
    a.liker_user_id as a_liker,
    a.liked_user_id as a_liked
  from public.discover_likes a
  join public.discover_likes b
    on b.liker_user_id = a.liked_user_id
   and b.liked_user_id = a.liker_user_id
  where a.status = 'pending'
    and b.status = 'pending'
)
update public.discover_likes dl
set
  status = 'matched',
  matched_at = coalesce(dl.matched_at, now()),
  passed_at = null,
  updated_at = now()
where exists (
  select 1
  from reciprocal_pending rp
  where (dl.liker_user_id = rp.a_liker and dl.liked_user_id = rp.a_liked)
     or (dl.liker_user_id = rp.a_liked and dl.liked_user_id = rp.a_liker)
);

-- Cleanup legacy pseudo-like chat rows (no real message history), now replaced by discover_likes.
delete from public.chat_conversations cc
where cc.relation_state = 'active'
  and cc.last_message_preview in ('Liked your profile.', 'This chat started from a SuperLike.')
  and cc.conversation_id not like 'match-%'
  and not exists (
    select 1
    from public.chat_messages cm
    where cm.user_id = cc.user_id
      and cm.conversation_id = cc.conversation_id
  );
