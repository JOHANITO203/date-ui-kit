-- Tracks entitlement consumption for idempotent balance decrements.

create table if not exists public.entitlement_consumptions (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  idempotency_key text not null,
  action text not null check (action in ('superlike', 'rewind', 'boost')),
  created_at timestamptz not null default now()
);

create unique index if not exists idx_entitlement_consumptions_user_key
  on public.entitlement_consumptions (user_id, idempotency_key);

alter table public.entitlement_consumptions enable row level security;
alter table public.entitlement_consumptions force row level security;

revoke all on table public.entitlement_consumptions from anon, authenticated;
