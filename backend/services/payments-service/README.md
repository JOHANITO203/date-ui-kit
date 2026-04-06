# payments-service

Domain ownership:
- checkout session creation
- payment validation/webhooks
- subscription and entitlement lifecycle

Implemented endpoints:
- `GET /payments/catalog`
- `POST /payments/checkout`
- `POST /payments/checkout/status`
- `POST /payments/webhook/yookassa`
- `POST /payments/order-status`
- `GET /entitlements/me`
- `GET /health`

Runtime:
- `PORT` default `4025`
- CORS allows app URL from `.env` (`APP_URL`)
- persistence in Supabase tables (`payments_checkouts`, `user_entitlements`) when Supabase creds are set
- automatic memory fallback when Supabase creds are not set
- works in two modes:
  - `mock` when YooKassa credentials are not set
  - `yookassa` when credentials are set

YooKassa setup:
- fill `YOOKASSA_SHOP_ID` and `YOOKASSA_SECRET_KEY` in `backend/services/payments-service/.env`
- optional webhook hardening: set `YOOKASSA_WEBHOOK_SECRET` and send it in `x-yookassa-webhook-secret`
- set Supabase creds: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE`
- webhook endpoint: `/payments/webhook/yookassa`
- return/fail URLs default to `/boost`

Security baseline:
- minimal rate limiting for checkout/status/webhook
- server-side payload validation with `zod`
- entitlement expiration sanitization on read/merge
