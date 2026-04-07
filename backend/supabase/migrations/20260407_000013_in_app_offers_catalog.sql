-- Wave Boost Catalog: persistent in-app offers with prices + descriptions.
-- Idempotent migration.

create table if not exists public.in_app_offers (
  id text primary key,
  label text not null,
  description text not null,
  tag text,
  amount_minor integer not null check (amount_minor > 0),
  currency_numeric integer not null default 643 check (currency_numeric > 0),
  type text not null check (type in ('tier', 'instant', 'time_pack', 'bundle')),
  duration_hours integer check (duration_hours is null or duration_hours > 0),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_in_app_offers_active_sort
  on public.in_app_offers (is_active, sort_order);

insert into public.in_app_offers (id, label, description, tag, amount_minor, currency_numeric, type, duration_hours, is_active, sort_order)
values
  ('tier-essential-month', 'ESSENTIAL', 'Core premium access for 30 days.', 'ENTRY', 49900, 643, 'tier', 720, true, 10),
  ('tier-gold-month', 'GOLD', 'Advanced premium with boosted weekly visibility.', 'POPULAR', 89900, 643, 'tier', 720, true, 20),
  ('tier-platinum-month', 'PLATINUM', 'High-priority premium with stronger discovery tools.', 'PRO', 149000, 643, 'tier', 720, true, 30),
  ('tier-elite-month', 'ELITE', 'Top-tier premium with VIP positioning.', 'VIP', 299000, 643, 'tier', 720, true, 40),

  ('instant-boost', 'BOOST', 'Prioritize profile distribution for a short burst.', 'INSTANT', 9900, 643, 'instant', null, true, 100),
  ('instant-icebreaker', 'ICEBREAKER', 'Open hidden opportunities and faster starts.', 'INSTANT', 12900, 643, 'instant', null, true, 110),
  ('instant-travel-pass', 'TRAVEL PASS', 'Switch server city for 24 hours.', '24H', 14900, 643, 'instant', 24, true, 120),
  ('instant-superlike', 'SUPERLIKE', 'Send strong intent with priority signal.', 'TOKENS', 7900, 643, 'instant', null, true, 130),
  ('instant-rewind-x10', 'REWIND (X10)', 'Undo up to 10 skipped profiles.', 'TOKENS', 6900, 643, 'instant', null, true, 140),
  ('instant-shadowghost', 'SHADOWGHOST', 'Stealth visibility mode for 24 hours.', '24H', 9900, 643, 'instant', 24, true, 150),

  ('pass-day', 'DAY PASS', 'Short premium pass for 24 hours.', '24H', 19900, 643, 'time_pack', 24, true, 200),
  ('pass-week', 'WEEK PASS', 'Short premium pass for 7 days.', '7 DAYS', 59900, 643, 'time_pack', 168, true, 210),
  ('pass-month', 'MONTH PASS', 'Premium pass for 30 days.', '30 DAYS', 149900, 643, 'time_pack', 720, true, 220),
  ('pass-travel-pass-plus', 'TRAVEL PASS+', 'Extended Travel Pass access for 7 days.', '7 DAYS', 39900, 643, 'time_pack', 168, true, 230),

  ('bundle-starter', 'STARTER', 'Starter bundle with core engagement tools.', 'BUNDLE', 39900, 643, 'bundle', null, true, 300),
  ('bundle-dating-pro', 'DATING PRO', 'Advanced bundle with high activity tools.', 'BUNDLE', 129900, 643, 'bundle', 720, true, 310),
  ('bundle-premium-plus', 'PREMIUM+', 'Top bundle with premium tier and strong quotas.', 'BUNDLE', 199900, 643, 'bundle', 720, true, 320)
on conflict (id) do update
set
  label = excluded.label,
  description = excluded.description,
  tag = excluded.tag,
  amount_minor = excluded.amount_minor,
  currency_numeric = excluded.currency_numeric,
  type = excluded.type,
  duration_hours = excluded.duration_hours,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order,
  updated_at = now();

alter table public.in_app_offers enable row level security;
alter table public.in_app_offers force row level security;

revoke all on table public.in_app_offers from anon, authenticated;

drop trigger if exists trg_in_app_offers_updated_at on public.in_app_offers;
create trigger trg_in_app_offers_updated_at
before update on public.in_app_offers
for each row
execute procedure public.set_updated_at();

