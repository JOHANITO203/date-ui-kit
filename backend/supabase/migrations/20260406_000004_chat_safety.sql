-- Chat + safety persistence for Wave A.
-- Compatible with current frontend payloads and fallback userId="me".

create table if not exists public.chat_conversations (
  user_id text not null,
  conversation_id text not null,
  peer_profile_id text not null,
  unread_count integer not null default 0,
  last_message_preview text not null default '',
  last_message_at timestamptz not null default now(),
  relation_state text not null default 'active',
  relation_state_updated_at timestamptz,
  received_superlike_trace_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, conversation_id)
);

create index if not exists idx_chat_conversations_user_id
  on public.chat_conversations (user_id);

create index if not exists idx_chat_conversations_last_message_at
  on public.chat_conversations (last_message_at desc);

create table if not exists public.chat_messages (
  user_id text not null,
  message_id text not null,
  conversation_id text not null,
  sender_user_id text not null,
  direction text not null check (direction in ('incoming', 'outgoing')),
  original_text text not null,
  translated_text text,
  translated boolean not null default false,
  target_locale text,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  primary key (user_id, message_id),
  foreign key (user_id, conversation_id)
    references public.chat_conversations (user_id, conversation_id)
    on delete cascade
);

create index if not exists idx_chat_messages_conversation_created_at
  on public.chat_messages (user_id, conversation_id, created_at asc);

create table if not exists public.safety_blocks (
  user_id text not null,
  blocked_user_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, blocked_user_id)
);

create table if not exists public.safety_reports (
  user_id text not null,
  report_id text not null,
  reported_user_id text not null,
  reason text not null,
  note text,
  created_at timestamptz not null default now(),
  primary key (user_id, report_id)
);

create index if not exists idx_safety_reports_user_id
  on public.safety_reports (user_id, created_at desc);

alter table public.chat_conversations enable row level security;
alter table public.chat_messages enable row level security;
alter table public.safety_blocks enable row level security;
alter table public.safety_reports enable row level security;

drop policy if exists "chat_conversations_select_own" on public.chat_conversations;
create policy "chat_conversations_select_own"
  on public.chat_conversations
  for select
  using (auth.uid()::text = user_id);

drop policy if exists "chat_messages_select_own" on public.chat_messages;
create policy "chat_messages_select_own"
  on public.chat_messages
  for select
  using (auth.uid()::text = user_id);

drop policy if exists "safety_blocks_select_own" on public.safety_blocks;
create policy "safety_blocks_select_own"
  on public.safety_blocks
  for select
  using (auth.uid()::text = user_id);

drop policy if exists "safety_reports_select_own" on public.safety_reports;
create policy "safety_reports_select_own"
  on public.safety_reports
  for select
  using (auth.uid()::text = user_id);

drop trigger if exists trg_chat_conversations_updated_at on public.chat_conversations;
create trigger trg_chat_conversations_updated_at
before update on public.chat_conversations
for each row
execute procedure public.set_updated_at();
