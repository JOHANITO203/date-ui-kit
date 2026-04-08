# discover-service

Domain ownership:
- candidate feed
- swipe decisions
- ranking algorithm v1 hooks

Implemented endpoints:
- `GET /discover/feed`
- `POST /discover/swipe`
- `POST /discover/rewind`
- `GET /health`

Security:
- internal service JWT required on Discover endpoints (`Authorization: Bearer <token>`)

Runtime:
- `API_PORT` default `8788`
- CORS allows app URL from `.env` (`APP_URL`)
