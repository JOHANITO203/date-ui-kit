# DEBT - WAVE A/B LEFT

This file captures remaining debt from Wave A and Wave B.
It is a tracking list, not a blocker for Wave C execution.
Status refreshed on 2026-04-08.

## Recently closed
- `user_id` alignment (`uuid`) executed and verified on key tables.
- Foreign keys to `auth.users(id)` restored and validated.
- Several responsive/tablet regressions fixed (including desktop-only rails policy where required).
- Multiple i18n corruption fixes on critical screens.

## Wave A debt left
- Real credentials injection pending:
  - Supabase URL/keys/service-role
  - Google OAuth client credentials for final domain setup
  - YooKassa shop/secret/webhook secret
- Validate migration chain consistency in target release environment (staging/prod-like).
- End-to-end payment in real mode (not mock): webhook, attribution, expiration.
- Full protected routes verification (`from` redirect and session-expiry behavior).
- Full E2E QA pass for auth/onboarding/profile/settings/safety/boost.
- Minimum observability still pending (Sentry + production runtime traces).
- Final go/no-go release checklist not fully validated in real environment.

## Database debt (priority)
- Validate RLS policies per table in release target (`auth.uid()` ownership checks).
- Validate grants: server-owned tables must not allow direct writes from `anon/authenticated` in release target.
- Keep `user_id` strategy locked to `uuid` for all current service tables.
- Add a migration execution log (env/date/version/operator) for production traceability.
- Operational blocker for automated push from this environment:
  - Supabase CLI non-interactive login requires `SUPABASE_ACCESS_TOKEN`
  - migration push/link remains pending until token is provided to the CLI session

## Wave B debt left
- Frontend automatic entitlement refresh is partially improved but still requires final UX validation pass.
- UI verification pass for block/report states across all Messages/Chat edge states still pending.
- Critical automated tests still missing:
  - auth flow test
  - onboarding completion test
- RLS/role baseline added, but needs real-env validation after credentials activation.

## Cross-wave debt
- Existing docs with mojibake/encoding drift should be normalized to UTF-8 clean text.
- `npm run` path execution can fail in constrained local environments; keep direct `node ...` fallback commands documented.
