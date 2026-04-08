# DEBT - WAVE C LEFT

This file tracks remaining debt for Wave C (production hardening).

## 1) Monitoring debt
- Sentry SDK is not integrated yet (frontend + backend).
- DSN/env-based production wiring is still pending.
- Alerting/issue routing policy is not documented yet.

## 2) Realtime/chat debt
- Current realtime behavior is polling-based (MVP-safe), not websocket/event-stream.
- Presence remains postponed by design and still not implemented.
- Realtime load/interval tuning per environment is not finalized.

## 3) Responsive debt
- Final manual QA pass on real devices completed (validated by in-field device tests).
- Safe-area / small-device responsive behavior considered locked for MVP scope.
- Remaining work is documentation-only: optional validation matrix formalization (non-blocking).

## 4) Staging/release debt
- Staging deployment verification loop not completed end-to-end.
- Real-user path validation (auth -> onboarding -> discover -> chat -> boost) on staging still pending.
- Blocking bug triage and closure report for Wave C not yet produced.

## 5) Post-MVP explicitly deferred
- Dockerization is post-MVP.
- VPS Russia migration is post-MVP.
