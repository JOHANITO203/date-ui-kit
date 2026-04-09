# DEBT - WAVE C LEFT

This file tracks remaining debt for Wave C (production hardening).
Status refreshed on 2026-04-08.

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
- Desktop-only rails policy reinforced on screens that showed tablet instability.
- Remaining work is mostly documentation-only: optional validation matrix formalization (non-blocking).

## 4) Staging/release debt
- Staging deployment verification loop not completed end-to-end.
- Real-user path validation (auth -> onboarding -> discover -> chat -> boost) on staging still pending.
- Blocking bug triage and closure report for Wave C not yet produced.

## 6) Global MVP readiness reminder
- Current estimated readiness:
  - MVP functional (local/dev): ~88-90%
  - MVP release-ready (staging/prod-like): ~75-80%
- Main remaining gap is release validation (staging + E2E + observability), not core feature coding.

## 5) Post-MVP explicitly deferred
- Dockerization is post-MVP.
- VPS Russia migration is post-MVP.
