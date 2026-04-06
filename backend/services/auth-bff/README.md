# auth-bff

Auth BFF microservice for this project.

## Features

- Email/password signup and login
- Magic-link OTP login
- Google OAuth login
- Supabase session refresh handling
- Internal session token cookie
- Profile/settings bootstrap endpoints (`/profiles/me`)
- Dedicated onboarding finalize endpoint (`POST /onboarding/complete`)

## Setup

1. Copy `.env.example` to `.env`.
2. Fill project-specific credentials:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE`
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `GOOGLE_REDIRECT_URI`
   - `INTERNAL_JWT_SECRET`
3. Install deps:
   - `npm --prefix backend/services/auth-bff install`
4. Run:
   - `npm run backend:auth:dev`

Detailed Supabase + Google OAuth setup:
- `backend/supabase/AUTH_BFF_SUPABASE_SETUP.md`

## Health

- `GET /health`

## Lock for Wave A

- Onboarding finish persistence is now server-owned through `POST /onboarding/complete`.
- Frontend should not bypass this endpoint for final onboarding completion.
