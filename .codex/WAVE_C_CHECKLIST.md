# WAVE C (J7-J10) - PRODUCTION HARDENING

## Goal
- Stabilize real usage quality before MVP release candidate.

## 1) Chat Realtime
- [ ] Realtime messages enabled (send/receive live updates).
- [ ] Unread counters updated in realtime.
- [ ] Conversation ordering updates on new activity.
- [ ] Presence is explicitly postponed (out of immediate critical path).

## 2) Monitoring
- [ ] Sentry integrated (frontend + backend minimal setup).
- [ ] Runtime logs centralized and readable for incident triage.
- [ ] Simple analytics events added for key MVP flows.

## 3) Responsive Final Pass
- [ ] Safe areas validated on small mobile devices.
- [ ] `Edit Profile` responsive issues closed.
- [ ] Bottom navigation responsive behavior validated across target breakpoints.

## 4) Staging + Real Testing
- [ ] Staging deploy completed.
- [ ] Real user-path testing completed (auth/onboarding/discover/chat/boost).
- [ ] Bugfix loop completed for blocking issues.

## 5) Post-MVP (Not Critical Path)
- [ ] Dockerization prepared after MVP lock.
- [ ] VPS Russia migration prepared after MVP lock.

## Done Criteria
- Wave C is done when staging validation is green and no blocking regression remains on MVP core flows.
