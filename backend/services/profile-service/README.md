# profile-service

Domain ownership:
- profile read/write
- onboarding profile persistence support
- profile completion signals

Implemented endpoints:
- `GET /profiles/me?userId=<id>`
- `PATCH /profiles/me?userId=<id>`
- `GET /health`

Runtime:
- `PORT` default `4022`
- Supabase persistence when credentials are set
- Memory fallback when credentials are missing
