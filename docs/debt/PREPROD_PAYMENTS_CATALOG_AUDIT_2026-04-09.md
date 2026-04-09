# Pre-Prod Payments Catalog Audit (2026-04-09)

Scope:
- Service: `backend/services/payments-service`
- Data source: `public.in_app_offers`
- Endpoint: `GET /payments/catalog`

## Result summary
- Required offers (SOT): `17`
- DB offers active/parseable: `17`
- Missing required offers: `0`
- Offers without entitlement handler: `0`
- Catalog mode: `db_strict`
- Degraded fallback used: `false`

## Root cause found for prior UNAVAILABLE regressions
- Some DB offers had `duration_hours = null`.
- Backend parser mapped raw DB `null` directly into Zod schema (`durationHours`), which rejects `null` for optional fields.
- Rejected rows were silently dropped from parsed DB catalog, causing specific products to appear unavailable.

## Fixes applied
- Normalize DB `duration_hours` with `null -> undefined` before schema parse.
- Add strict catalog source mode (`PAYMENTS_CATALOG_SOURCE=db_strict` by default).
- Add explicit emergency fallback mode (`db_with_emergency_fallback`) with error logs.
- Add explicit code mode (`code`) for local/dev only.
- Add audit endpoint: `GET /payments/catalog/audit`.
- Add regression checks:
  - `npm run test:payments-catalog-db`
  - `npm run test:payments-catalog-endpoint`
- Add idempotent DB realign migration:
  - `backend/supabase/migrations/20260409_000019_in_app_offers_catalog_realign.sql`

