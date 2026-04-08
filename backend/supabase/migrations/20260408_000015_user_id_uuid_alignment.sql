-- Wave Data Pass: unify actor user_id columns to uuid and add missing FK coverage.
-- Scope intentionally excludes peer/profile ids that may carry non-auth identifiers
-- (e.g. blocked_user_id, reported_user_id, peer_profile_id, sender_user_id).

-- 1) Type alignment (text -> uuid) with explicit guardrails.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'payments_checkouts'
      and column_name = 'user_id'
      and data_type = 'text'
  ) then
    if exists (
      select 1
      from public.payments_checkouts
      where user_id is null
         or user_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    ) then
      raise exception 'payments_checkouts.user_id contains non-uuid values';
    end if;
    alter table public.payments_checkouts
      alter column user_id type uuid using user_id::uuid;
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'user_entitlements'
      and column_name = 'user_id'
      and data_type = 'text'
  ) then
    if exists (
      select 1
      from public.user_entitlements
      where user_id is null
         or user_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    ) then
      raise exception 'user_entitlements.user_id contains non-uuid values';
    end if;
    alter table public.user_entitlements
      alter column user_id type uuid using user_id::uuid;
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'chat_conversations'
      and column_name = 'user_id'
      and data_type = 'text'
  ) then
    if exists (
      select 1
      from public.chat_conversations
      where user_id is null
         or user_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    ) then
      raise exception 'chat_conversations.user_id contains non-uuid values';
    end if;
    alter table public.chat_conversations
      alter column user_id type uuid using user_id::uuid;
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'chat_messages'
      and column_name = 'user_id'
      and data_type = 'text'
  ) then
    if exists (
      select 1
      from public.chat_messages
      where user_id is null
         or user_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    ) then
      raise exception 'chat_messages.user_id contains non-uuid values';
    end if;
    alter table public.chat_messages
      alter column user_id type uuid using user_id::uuid;
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'safety_blocks'
      and column_name = 'user_id'
      and data_type = 'text'
  ) then
    if exists (
      select 1
      from public.safety_blocks
      where user_id is null
         or user_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    ) then
      raise exception 'safety_blocks.user_id contains non-uuid values';
    end if;
    alter table public.safety_blocks
      alter column user_id type uuid using user_id::uuid;
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'safety_reports'
      and column_name = 'user_id'
      and data_type = 'text'
  ) then
    if exists (
      select 1
      from public.safety_reports
      where user_id is null
         or user_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    ) then
      raise exception 'safety_reports.user_id contains non-uuid values';
    end if;
    alter table public.safety_reports
      alter column user_id type uuid using user_id::uuid;
  end if;
end $$;

-- 2) Referential integrity (missing FK coverage on actor user_id).
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'payments_checkouts_user_id_fkey'
      and conrelid = 'public.payments_checkouts'::regclass
  ) then
    alter table public.payments_checkouts
      add constraint payments_checkouts_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete cascade;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'user_entitlements_user_id_fkey'
      and conrelid = 'public.user_entitlements'::regclass
  ) then
    alter table public.user_entitlements
      add constraint user_entitlements_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete cascade;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'chat_conversations_user_id_fkey'
      and conrelid = 'public.chat_conversations'::regclass
  ) then
    alter table public.chat_conversations
      add constraint chat_conversations_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete cascade;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'chat_messages_user_id_fkey'
      and conrelid = 'public.chat_messages'::regclass
  ) then
    alter table public.chat_messages
      add constraint chat_messages_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete cascade;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'safety_blocks_user_id_fkey'
      and conrelid = 'public.safety_blocks'::regclass
  ) then
    alter table public.safety_blocks
      add constraint safety_blocks_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete cascade;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'safety_reports_user_id_fkey'
      and conrelid = 'public.safety_reports'::regclass
  ) then
    alter table public.safety_reports
      add constraint safety_reports_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete cascade;
  end if;
end $$;

-- 3) Policy alignment (auth.uid() cast no longer needed).
drop policy if exists "payments_checkouts_select_own" on public.payments_checkouts;
create policy "payments_checkouts_select_own"
  on public.payments_checkouts
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "user_entitlements_select_own" on public.user_entitlements;
create policy "user_entitlements_select_own"
  on public.user_entitlements
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "chat_conversations_select_own" on public.chat_conversations;
create policy "chat_conversations_select_own"
  on public.chat_conversations
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "chat_messages_select_own" on public.chat_messages;
create policy "chat_messages_select_own"
  on public.chat_messages
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "safety_blocks_select_own" on public.safety_blocks;
create policy "safety_blocks_select_own"
  on public.safety_blocks
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "safety_reports_select_own" on public.safety_reports;
create policy "safety_reports_select_own"
  on public.safety_reports
  for select
  to authenticated
  using (auth.uid() = user_id);
