# Backend Microservices

This repository now follows a microservices backend structure under `backend/services`.

## Services

- `auth-bff` (implemented): authentication BFF for Supabase email/password, OTP, Google OAuth, session refresh, and profile/settings endpoints.
- `profile-service` (implemented minimal): profile read/write and onboarding profile/settings persistence.
- `discover-service` (implemented minimal): discovery feed and swipe domain APIs.
- `chat-service` (implemented minimal): conversations/messages/relation-state domain APIs.
- `payments-service` (implemented minimal): checkout + YooKassa status/webhook with Supabase persistence (mock fallback included).
- `safety-service` (implemented minimal): block/unblock/report domain APIs.

## Wave A focus

1. Finalize `auth-bff` and connect frontend auth/onboarding flow.
2. Define contracts and ownership boundaries for each stub service.
3. Move domain logic out of frontend runtime store into services incrementally.
