-- Persist active boost windows per user.

create table if not exists public.user_boosts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  active_until timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_boosts_active_until
  on public.user_boosts (active_until desc);

alter table public.user_boosts enable row level security;
alter table public.user_boosts force row level security;

revoke all on table public.user_boosts from anon, authenticated;

drop trigger if exists trg_user_boosts_updated_at on public.user_boosts;
create trigger trg_user_boosts_updated_at
before update on public.user_boosts
for each row
execute function public.set_updated_at();
