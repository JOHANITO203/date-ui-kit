# profile-service

Domain ownership:
- profile read/write
- onboarding profile persistence support
- profile completion signals

Implemented endpoints:
- `GET /profiles/me` (requires `Authorization: Bearer <internal_jwt>`)
- `PATCH /profiles/me` (requires `Authorization: Bearer <internal_jwt>`)
- `GET /health`

Runtime:
- `PORT` default `4022`
- `INTERNAL_JWT_SECRET` shared with auth-bff/discover/chat/safety/payments
- Supabase persistence when credentials are set
- Memory fallback when credentials are missing
