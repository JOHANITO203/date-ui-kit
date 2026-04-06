# WAVES B/C DELIVERY PLAN (J4-J10)

## Timeline
1. J4-J6: Wave B - Monetization + minimal security.
2. J7-J10: Wave C - Production hardening.

## Wave B priority order
1. Payments: purchase, webhook validation, entitlement creation/expiration.
2. Safety persistence: blocks/reports + UI state effects.
3. Supabase security baseline: RLS/roles/server validation/rate limit.
4. Critical tests for auth, onboarding, purchase->entitlement, block flow.

## Wave C priority order
1. Chat realtime: messages + unread (presence later).
2. Monitoring: Sentry + logs + simple analytics.
3. Responsive final pass: safe areas, edit profile, bottom nav.
4. Staging deploy + real tests + bugfix loop.

## Out of immediate critical path
- Docker and VPS Russia migration are post-MVP tasks.

## Linked checklists
- `./WAVE_B_CHECKLIST.md`
- `./WAVE_C_CHECKLIST.md`
- `./WAVE_A_LEFT.md`
