-- Wave Settings Pass 2: persist advanced privacy toggles in settings table.
-- Idempotent migration.

alter table if exists public.settings
  add column if not exists visibility text,
  add column if not exists hide_age boolean,
  add column if not exists hide_distance boolean,
  add column if not exists incognito boolean,
  add column if not exists read_receipts boolean,
  add column if not exists shadow_ghost boolean;

update public.settings
set
  visibility = coalesce(visibility, 'public'),
  hide_age = coalesce(hide_age, false),
  hide_distance = coalesce(hide_distance, false),
  incognito = coalesce(incognito, false),
  read_receipts = coalesce(read_receipts, true),
  shadow_ghost = coalesce(shadow_ghost, false);

alter table if exists public.settings
  alter column visibility set default 'public',
  alter column hide_age set default false,
  alter column hide_distance set default false,
  alter column incognito set default false,
  alter column read_receipts set default true,
  alter column shadow_ghost set default false;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'settings_visibility_check'
      and conrelid = 'public.settings'::regclass
  ) then
    alter table public.settings
      add constraint settings_visibility_check
      check (visibility in ('public', 'limited', 'hidden'));
  end if;
end $$;
