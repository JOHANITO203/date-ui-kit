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
- Final manual QA pass on real devices is still pending.
- Validation matrix for small devices and browser-safe-area variants is not yet documented.

## 4) Staging/release debt
- Staging deployment verification loop not completed end-to-end.
- Real-user path validation (auth -> onboarding -> discover -> chat -> boost) on staging still pending.
- Blocking bug triage and closure report for Wave C not yet produced.

## 5) Post-MVP explicitly deferred
- Dockerization is post-MVP.
- VPS Russia migration is post-MVP.
