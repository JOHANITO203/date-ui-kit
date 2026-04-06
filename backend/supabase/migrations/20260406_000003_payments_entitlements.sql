-- Payments persistence for YooKassa integration.
-- Stores checkout lifecycle and attributed entitlements per user.

create table if not exists public.payments_checkouts (
  checkout_id text primary key,
  yookassa_payment_id text unique,
  order_number text not null unique,
  user_id text not null,
  offer_id text not null,
  mode text not null check (mode in ('mock', 'yookassa')),
  status text not null check (status in ('pending', 'paid', 'failed')),
  attributed boolean not null default false,
  entitlement_snapshot jsonb,
  provider_raw jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_payments_checkouts_user_id on public.payments_checkouts (user_id);
create index if not exists idx_payments_checkouts_status on public.payments_checkouts (status);

create table if not exists public.user_entitlements (
  user_id text primary key,
  entitlement_snapshot jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.payments_checkouts enable row level security;
alter table public.user_entitlements enable row level security;

drop policy if exists "payments_checkouts_select_own" on public.payments_checkouts;
create policy "payments_checkouts_select_own"
  on public.payments_checkouts
  for select
  using (auth.uid()::text = user_id);

drop policy if exists "user_entitlements_select_own" on public.user_entitlements;
create policy "user_entitlements_select_own"
  on public.user_entitlements
  for select
  using (auth.uid()::text = user_id);

drop trigger if exists trg_payments_checkouts_updated_at on public.payments_checkouts;
create trigger trg_payments_checkouts_updated_at
before update on public.payments_checkouts
for each row
execute procedure public.set_updated_at();
