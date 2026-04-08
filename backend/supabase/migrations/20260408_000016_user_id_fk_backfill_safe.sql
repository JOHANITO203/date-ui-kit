-- Wave Data Patch: backfill missing actor user_id -> auth.users(id) FKs
-- Safe/idempotent version:
-- - detects existing FK by target table/column (not constraint name)
-- - uses NOT VALID to avoid hard-fail on legacy orphan rows

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'payments_checkouts'
      and column_name = 'user_id'
      and data_type = 'uuid'
  ) and not exists (
    select 1
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on kcu.constraint_schema = tc.constraint_schema
     and kcu.constraint_name = tc.constraint_name
    join information_schema.constraint_column_usage ccu
      on ccu.constraint_schema = tc.constraint_schema
     and ccu.constraint_name = tc.constraint_name
    where tc.table_schema = 'public'
      and tc.table_name = 'payments_checkouts'
      and tc.constraint_type = 'FOREIGN KEY'
      and kcu.column_name = 'user_id'
      and ccu.table_schema = 'auth'
      and ccu.table_name = 'users'
      and ccu.column_name = 'id'
  ) then
    alter table public.payments_checkouts
      add constraint payments_checkouts_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete cascade not valid;
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
      and data_type = 'uuid'
  ) and not exists (
    select 1
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on kcu.constraint_schema = tc.constraint_schema
     and kcu.constraint_name = tc.constraint_name
    join information_schema.constraint_column_usage ccu
      on ccu.constraint_schema = tc.constraint_schema
     and ccu.constraint_name = tc.constraint_name
    where tc.table_schema = 'public'
      and tc.table_name = 'user_entitlements'
      and tc.constraint_type = 'FOREIGN KEY'
      and kcu.column_name = 'user_id'
      and ccu.table_schema = 'auth'
      and ccu.table_name = 'users'
      and ccu.column_name = 'id'
  ) then
    alter table public.user_entitlements
      add constraint user_entitlements_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete cascade not valid;
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
      and data_type = 'uuid'
  ) and not exists (
    select 1
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on kcu.constraint_schema = tc.constraint_schema
     and kcu.constraint_name = tc.constraint_name
    join information_schema.constraint_column_usage ccu
      on ccu.constraint_schema = tc.constraint_schema
     and ccu.constraint_name = tc.constraint_name
    where tc.table_schema = 'public'
      and tc.table_name = 'chat_conversations'
      and tc.constraint_type = 'FOREIGN KEY'
      and kcu.column_name = 'user_id'
      and ccu.table_schema = 'auth'
      and ccu.table_name = 'users'
      and ccu.column_name = 'id'
  ) then
    alter table public.chat_conversations
      add constraint chat_conversations_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete cascade not valid;
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
      and data_type = 'uuid'
  ) and not exists (
    select 1
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on kcu.constraint_schema = tc.constraint_schema
     and kcu.constraint_name = tc.constraint_name
    join information_schema.constraint_column_usage ccu
      on ccu.constraint_schema = tc.constraint_schema
     and ccu.constraint_name = tc.constraint_name
    where tc.table_schema = 'public'
      and tc.table_name = 'chat_messages'
      and tc.constraint_type = 'FOREIGN KEY'
      and kcu.column_name = 'user_id'
      and ccu.table_schema = 'auth'
      and ccu.table_name = 'users'
      and ccu.column_name = 'id'
  ) then
    alter table public.chat_messages
      add constraint chat_messages_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete cascade not valid;
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
      and data_type = 'uuid'
  ) and not exists (
    select 1
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on kcu.constraint_schema = tc.constraint_schema
     and kcu.constraint_name = tc.constraint_name
    join information_schema.constraint_column_usage ccu
      on ccu.constraint_schema = tc.constraint_schema
     and ccu.constraint_name = tc.constraint_name
    where tc.table_schema = 'public'
      and tc.table_name = 'safety_blocks'
      and tc.constraint_type = 'FOREIGN KEY'
      and kcu.column_name = 'user_id'
      and ccu.table_schema = 'auth'
      and ccu.table_name = 'users'
      and ccu.column_name = 'id'
  ) then
    alter table public.safety_blocks
      add constraint safety_blocks_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete cascade not valid;
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
      and data_type = 'uuid'
  ) and not exists (
    select 1
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on kcu.constraint_schema = tc.constraint_schema
     and kcu.constraint_name = tc.constraint_name
    join information_schema.constraint_column_usage ccu
      on ccu.constraint_schema = tc.constraint_schema
     and ccu.constraint_name = tc.constraint_name
    where tc.table_schema = 'public'
      and tc.table_name = 'safety_reports'
      and tc.constraint_type = 'FOREIGN KEY'
      and kcu.column_name = 'user_id'
      and ccu.table_schema = 'auth'
      and ccu.table_name = 'users'
      and ccu.column_name = 'id'
  ) then
    alter table public.safety_reports
      add constraint safety_reports_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete cascade not valid;
  end if;
end $$;

