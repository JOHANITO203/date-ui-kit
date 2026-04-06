# WAVE C (J7-J10) - PRODUCTION HARDENING

## Goal
- Stabilize real usage quality before MVP release candidate.

## 1) Chat Realtime
- [x] Realtime messages enabled (polling-based live updates).
- [x] Unread counters updated in realtime.
- [x] Conversation ordering updates on new activity.
- [ ] Presence is explicitly postponed (out of immediate critical path).

## 2) Monitoring
- [ ] Sentry integrated (frontend + backend minimal setup).
- [x] Runtime logs centralized and readable for incident triage (frontend monitor hook + backend fastify logs).
- [x] Simple analytics events added for key MVP flows (with optional transport endpoint).

## 3) Responsive Final Pass
- [x] Safe areas validated on small mobile devices (layout-safe padding pass).
- [x] `Edit Profile` responsive issues closed (safe-area and keyboard offset pass).
- [x] Bottom navigation responsive behavior validated across target breakpoints (fixed-position/mobile interaction pass).

## 4) Staging + Real Testing
- [ ] Staging deploy completed.
- [ ] Real user-path testing completed (auth/onboarding/discover/chat/boost).
- [ ] Bugfix loop completed for blocking issues.

## 5) Post-MVP (Not Critical Path)
- [ ] Dockerization prepared after MVP lock.
- [ ] VPS Russia migration prepared after MVP lock.

## Done Criteria
- Wave C is done when staging validation is green and no blocking regression remains on MVP core flows.
