# WAVE B (J4-J6) - MONETIZATION + MINIMAL SECURITY

This checklist follows the current repository state and the product timeline.

## Goal
- Close MVP-critical monetization and safety/security behaviors before production hardening.

## 1) Payments
- [x] Purchase flow end-to-end wired (`catalog -> checkout -> status`).
- [x] Webhook validation in backend (shared secret + payload checks).
- [x] Entitlement creation on successful payment.
- [x] Entitlement expiration handling (time-based sanitization/revocation on read/merge).
- [x] Frontend state reflects entitlement change without manual refresh (AuthProvider background hydration + dedupe).

## 2) Block / Report
- [x] Block API + persistence (`blocks`) fully active.
- [x] Report API + persistence (`reports`) fully active.
- [ ] UI effects verified in `Messages` and `Chat`:
  - blocked by me
  - blocked me
  - unblock path
  - report feedback
  - local sync patch added between list/chat relation states (`exotic:conversation-relation-state`)

## 3) Supabase Security Baseline
- [x] RLS enabled on sensitive tables used in Wave B.
- [x] Role boundaries verified (`anon`, authenticated, service-role usage only server-side).
- [x] Server-side input validation for payment/safety endpoints.
- [x] Minimal rate limiting on auth/safety/payment critical endpoints.

## 4) Critical Tests
- [ ] Auth flow test (login/session/callback/protected route).
- [ ] Onboarding completion test (persist + recovery path).
- [x] Purchase -> entitlement attribution test.
- [x] Block flow test (state + persistence + UI effect).

## Done Criteria
- Wave B is done when all checks above pass in backend-connected mode (not runtime-only fallback).
