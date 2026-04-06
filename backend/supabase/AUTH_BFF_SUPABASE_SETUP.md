# Auth BFF x Supabase - Setup (Exotic)

This guide configures Supabase and Google OAuth for `backend/services/auth-bff`.

## 1) Required local URIs (current project)
- Frontend: `http://localhost:3000`
- Auth BFF: `http://127.0.0.1:8787`
- Google callback: `http://127.0.0.1:8787/auth/google/callback`

## 2) Supabase Auth configuration
In Supabase Dashboard -> Authentication -> URL Configuration:
- Site URL: `http://localhost:3000`
- Additional Redirect URLs:
  - `http://localhost:3000/auth/callback`
  - `http://localhost:3000/login/methods`
  - `http://localhost:3000/onboarding`

In Supabase Dashboard -> Authentication -> Providers -> Google:
- Enable Google provider
- Add Google OAuth Client ID/Secret created for this project

## 3) Google OAuth app configuration
In Google Cloud Console -> OAuth Client (Web app):
- Authorized JavaScript origins:
  - `http://localhost:3000`
  - `http://127.0.0.1:3000`
- Authorized redirect URIs:
  - `http://127.0.0.1:8787/auth/google/callback`
  - `http://localhost:8787/auth/google/callback`

## 4) auth-bff .env variables
Create `backend/services/auth-bff/.env` from `.env.example` and set:
- `APP_URL=http://localhost:3000`
- `API_URL=http://127.0.0.1:8787`
- `INTERNAL_JWT_SECRET=<min 16 chars>`
- `SUPABASE_URL=<https://<project-ref>.supabase.co>`
- `SUPABASE_ANON_KEY=<supabase anon key>`
- `SUPABASE_SERVICE_ROLE=<supabase service role key>`
- `GOOGLE_CLIENT_ID=<google oauth client id>`
- `GOOGLE_CLIENT_SECRET=<google oauth client secret>`
- `GOOGLE_REDIRECT_URI=http://127.0.0.1:8787/auth/google/callback`

## 5) Apply SQL migrations (order is mandatory)
Run in Supabase SQL Editor:
1. `backend/supabase/migrations/20260406_000001_profiles_settings.sql`
2. `backend/supabase/migrations/20260406_000002_onboarding_v1_fields.sql`
3. `backend/supabase/migrations/20260406_000003_payments_entitlements.sql`
4. `backend/supabase/migrations/20260406_000004_chat_safety.sql`
5. `backend/supabase/migrations/20260406_000005_wave_b_security_baseline.sql`

## 6) Smoke checks
- `GET http://127.0.0.1:8787/health` returns healthy
- `GET http://127.0.0.1:8787/auth/session` returns JSON (guest or authenticated)
- Start Google login from app `/login` and verify callback to app without auth loop
- Onboarding step 3 accepts Google-only path

## 7) Security notes
- Never commit `.env` files
- `.env.example` must stay placeholder-only (no real credentials)
- If a secret was exposed, rotate it immediately (Google + Supabase service role)
