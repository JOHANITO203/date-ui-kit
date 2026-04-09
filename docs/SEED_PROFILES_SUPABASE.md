# Seed Profiles Supabase (Launch Servers)

This script seeds realistic test users into Supabase for onboarding/profile/settings/photo flows.

## What it does

- Creates users in `auth.users` via admin API.
- Upserts `public.profiles`.
- Upserts `public.settings`.
- Uploads one primary photo per user into Supabase Storage bucket `profile-photos` (or `STORAGE_PROFILE_PHOTOS_BUCKET`).
- Inserts `public.profile_photos`.

Default volume:
- `13` profiles per launch server:
  - `moscow`
  - `saint-petersburg`
  - `voronezh`
  - `sochi`

## Prerequisites

- Root `.env` must include:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE`
- Migrations already applied for:
  - `profiles`
  - `settings`
  - `profile_photos`
  - storage bucket policies

## Image folders

Create this structure:

```txt
seed-assets/
  launch-servers/
    moscow/
      01.jpg
      02.jpg
      ...
    saint-petersburg/
      01.jpg
      ...
    voronezh/
      01.jpg
      ...
    sochi/
      01.jpg
      ...
```

Rules:
- at least `13` images in each folder
- supported formats: `.jpg`, `.jpeg`, `.png`, `.webp`

## Run

From repo root:

```bash
npm run seed:profiles
```

Photo retry-only pass:

```bash
npm run seed:photos:retry
```

Seed interactions (chat/block/report) targeting real anchor accounts:

```bash
npm run seed:interactions
```

Default anchor emails:
- `johaneoyaraht@gmail.com`
- `johanito203@gmail.com`

Override with:
- `SEED_INTERACTIONS_ANCHOR_EMAILS=email1,email2`

Optional env:

- `SEED_PER_SERVER=13`
- `SEED_RESET=1` (delete existing seed users first, then recreate)
- `SEED_PROFILE_PASSWORD=ExoticSeed!2026`
- `SEED_ASSETS_DIR=<custom absolute path>`
- `STORAGE_PROFILE_PHOTOS_BUCKET=profile-photos`

## Important current limitation

- Discover now supports Supabase-backed candidate loading when these env vars are set in `backend/services/discover-service/.env`:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE`
  - `STORAGE_PROFILE_PHOTOS_BUCKET`
  - `STORAGE_SIGNED_URL_TTL_SEC`
- If these vars are missing or Supabase is unreachable, Discover falls back to runtime seed candidates.
