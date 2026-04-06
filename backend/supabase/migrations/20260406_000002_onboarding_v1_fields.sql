-- Wave A onboarding v1 extension fields for profiles/settings.

alter table public.profiles
  add column if not exists birth_date date,
  add column if not exists gender text,
  add column if not exists city text,
  add column if not exists origin_country text,
  add column if not exists languages text[] default '{}',
  add column if not exists intent text,
  add column if not exists interests text[] default '{}',
  add column if not exists photos_count integer default 0,
  add column if not exists verified_opt_in boolean default false,
  add column if not exists onboarding_version text default 'v1';

alter table public.settings
  add column if not exists target_lang text,
  add column if not exists auto_translate boolean default true,
  add column if not exists auto_detect_language boolean default true,
  add column if not exists notifications_enabled boolean default false,
  add column if not exists precise_location_enabled boolean default false;
