# Services Layout

Microservices are isolated by domain ownership.

## Current state

- `auth-bff`: active service imported from existing implementation and adapted for this project.
- `discover-service`: active minimal service for feed + swipe.
- `chat-service`: active minimal service for conversations/messages/relation state.
- `safety-service`: active minimal service for block/unblock/report workflows.
- `payments-service`: active minimal service for checkout and YooKassa + Supabase operations.
- `profile-service`: active minimal service for profile and settings persistence.

## Rule

No new backend feature should be added directly inside frontend runtime mocks when an owning service exists or is planned.
