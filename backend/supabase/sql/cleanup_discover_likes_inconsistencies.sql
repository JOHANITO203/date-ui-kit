-- Re-runnable cleanup script for legacy likes/chat inconsistencies.
-- Safe to execute after migration 20260409_000017_discover_likes_pipeline.sql.

-- 1) Ensure legacy pseudo-like chat rows are represented in discover_likes.
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

-- 2) Normalize malformed statuses.
update public.discover_likes
set status = 'pending',
    matched_at = null,
    passed_at = null,
    updated_at = now()
where status not in ('pending', 'matched', 'passed');

-- 3) If reciprocal likes exist and both are pending, promote both to matched.
with reciprocal_pending as (
  select a.liker_user_id as a_liker, a.liked_user_id as a_liked
  from public.discover_likes a
  join public.discover_likes b
    on b.liker_user_id = a.liked_user_id
   and b.liked_user_id = a.liker_user_id
  where a.status = 'pending'
    and b.status = 'pending'
)
update public.discover_likes dl
set status = 'matched',
    matched_at = coalesce(dl.matched_at, now()),
    passed_at = null,
    updated_at = now()
where exists (
  select 1
  from reciprocal_pending rp
  where (dl.liker_user_id = rp.a_liker and dl.liked_user_id = rp.a_liked)
     or (dl.liker_user_id = rp.a_liked and dl.liked_user_id = rp.a_liker)
);

-- 4) Remove legacy pseudo-like chat conversations with no message history.
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
