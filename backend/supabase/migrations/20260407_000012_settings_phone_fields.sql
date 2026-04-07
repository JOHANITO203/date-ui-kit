-- Wave Settings Pass 4: phone fields with regional prefix + national number.
-- Idempotent migration.

alter table if exists public.settings
  add column if not exists phone_country_code text,
  add column if not exists phone_national_number text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'settings_phone_country_code_check'
      and conrelid = 'public.settings'::regclass
  ) then
    alter table public.settings
      add constraint settings_phone_country_code_check
      check (
        phone_country_code is null
        or phone_country_code ~ '^\+[0-9]{1,5}$'
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'settings_phone_national_number_check'
      and conrelid = 'public.settings'::regclass
  ) then
    alter table public.settings
      add constraint settings_phone_national_number_check
      check (
        phone_national_number is null
        or phone_national_number ~ '^[0-9]{4,15}$'
      );
  end if;
end $$;

