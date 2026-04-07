# chat-service

Domain ownership:
- conversations
- messages
- unread counters
- relation state propagation (active/blocked_by_me/blocked_me)

Implemented endpoints:
- `GET /chat/conversations`
- `POST /chat/open`
- `GET /chat/conversations/:conversationId/messages`
- `POST /chat/messages`
- `PATCH /chat/relation-state`
- `GET /health`

Runtime:
- `PORT` default `4023`
- CORS allows app URL from `.env` (`APP_URL`)
- Optional Supabase persistence via `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE`
- Automatic memory fallback when Supabase credentials are absent
