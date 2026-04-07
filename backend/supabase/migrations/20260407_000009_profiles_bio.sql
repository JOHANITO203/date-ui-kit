-- Wave C / profile quality: add persistent profile bio field.
-- Idempotent migration to support Edit Profile + visibility scoring.

alter table public.profiles
  add column if not exists bio text;
