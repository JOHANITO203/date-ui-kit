-- Wave Settings Pass 3: persist selected server city for Travel Pass users.
-- Idempotent migration.

alter table if exists public.settings
  add column if not exists travel_pass_city text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'settings_travel_pass_city_check'
      and conrelid = 'public.settings'::regclass
  ) then
    alter table public.settings
      add constraint settings_travel_pass_city_check
      check (
        travel_pass_city is null
        or travel_pass_city in ('voronezh', 'moscow', 'saint-petersburg', 'sochi')
      );
  end if;
end $$;

