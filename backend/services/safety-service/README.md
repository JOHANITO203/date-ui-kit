# safety-service

Domain ownership:
- user blocking/unblocking
- reports/moderation intake

Implemented endpoints:
- `GET /safety/blocks`
- `POST /safety/blocks`
- `DELETE /safety/blocks/:userId`
- `POST /safety/reports`
- `GET /health`

Runtime:
- `PORT` default `4024`
- CORS allows app URL from `.env` (`APP_URL`)
- Optional Supabase persistence via `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE`
- Automatic memory fallback when Supabase credentials are absent

Security baseline:
- rate limiting on block/report actions
- payload validation with `zod`
- self-block and self-report requests rejected server-side
