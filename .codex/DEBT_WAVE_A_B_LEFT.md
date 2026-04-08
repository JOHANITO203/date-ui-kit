# DEBT - WAVE A/B LEFT

This file captures remaining debt from Wave A and Wave B.
It is a tracking list, not a blocker for Wave C execution.

## Wave A debt left
- Real credentials injection pending:
  - Supabase URL/keys/service-role
  - Google OAuth client credentials
  - YooKassa shop/secret/webhook secret
- Run all SQL migrations on real Supabase and validate final schema.
- End-to-end payment in real mode (not mock): webhook, attribution, expiration.
- Full protected routes verification (`from` redirect and session-expiry behavior).
- Full E2E QA pass for auth/onboarding/profile/settings/safety/boost.
- Minimum observability still pending (Sentry + production runtime traces).
- Final go/no-go release checklist not fully validated in real environment.

## Database debt (priority)
- Apply migrations in order on real Supabase:
  - `20260406_000001_profiles_settings.sql`
  - `20260406_000002_onboarding_v1_fields.sql`
  - `20260406_000003_payments_entitlements.sql`
  - `20260406_000004_chat_safety.sql`
  - `20260406_000005_wave_b_security_baseline.sql`
- Validate RLS policies per table (`auth.uid()` ownership checks).
- Validate grants: server-owned tables must not allow direct writes from `anon/authenticated`.
- Normalize `user_id` typing strategy (`uuid` vs `text`) and prepare migration plan.
- `user_id` alignment migration now prepared:
  - `20260408_000015_user_id_uuid_alignment.sql`
  - pending execution on real Supabase + post-run verification
- Add a migration execution log (env/date/version/operator) for production traceability.
- Operational blocker for automated push from this environment:
  - Supabase CLI non-interactive login requires `SUPABASE_ACCESS_TOKEN`
  - migration push/link remains pending until token is provided to the CLI session

## Wave B debt left
- Frontend automatic entitlement refresh without manual user action is not fully finalized.
- UI verification pass for block/report states across all Messages/Chat edge states still pending.
- Critical automated tests still missing:
  - auth flow test
  - onboarding completion test
- RLS/role baseline added, but needs real-env validation after credentials activation.

## Cross-wave debt
- Existing docs with mojibake/encoding drift should be normalized to UTF-8 clean text.
- `npm run` path execution can fail in constrained local environments; keep direct `node ...` fallback commands documented.
