-- Enforce supported conversation states and normalize legacy unmatched values.
-- Idempotent migration.

update public.chat_conversations
set relation_state = 'blocked_me'
where relation_state = 'unmatched';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'chat_conversations_relation_state_check'
      and conrelid = 'public.chat_conversations'::regclass
  ) then
    alter table public.chat_conversations
      add constraint chat_conversations_relation_state_check
      check (relation_state in ('active', 'blocked_by_me', 'blocked_me'));
  end if;
end
$$;
