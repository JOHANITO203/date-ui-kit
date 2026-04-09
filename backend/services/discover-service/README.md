# discover-service

Domain ownership:
- candidate feed
- swipe decisions
- ranking algorithm v1 hooks

Implemented endpoints:
- `GET /discover/feed`
- `POST /discover/swipe`
- `POST /discover/rewind`
- `GET /discover/likes/incoming`
- `POST /discover/likes/:likeId/decision`
- `GET /health`

Security:
- internal service JWT required on Discover endpoints (`Authorization: Bearer <token>`)

Runtime:
- `API_PORT` default `8788`
- CORS allows app URL from `.env` (`APP_URL`)
- Supabase-backed candidate source (optional but recommended for real seeded users):
  - static fallback disabled for production safety
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE`
  - `STORAGE_PROFILE_PHOTOS_BUCKET` (default `profile-photos`)
  - `STORAGE_SIGNED_URL_TTL_SEC` (default 7 days)
