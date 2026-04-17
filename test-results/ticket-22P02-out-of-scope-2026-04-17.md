# Ticket: 22P02 on Discover with Non-UUID Internal Token Subject

## Status
- Open
- Out of scope for Discover closure (settings timeout + public bucket fallback)

## Observed
- Error in discover logs:
- `invalid input syntax for type uuid: "local-test-user"`
- Postgres code: `22P02`
- Trigger point: queries that expect UUID user ids (example: matched profile lookup)

## Impact
- Test tokens with non-UUID `sub` can produce noisy errors and empty feed behavior.
- Production risk depends on whether upstream token issuer can emit non-UUID `sub`.

## Repro
- Call `/discover/feed` using internal JWT where `sub=local-test-user`.
- Observe `discover.load_matched_profile_ids_failed` / UUID parse errors in logs.

## Proposed Follow-up (separate scope)
- Decide and enforce contract for internal token `sub`:
- Either strict UUID-only in token issuance
- Or defensive validation/rejection at auth boundary before DB queries
- Add a targeted runtime test for non-UUID `sub`.

## Evidence
- `test-results/discover-runtime.log` (earlier lines before validated UUID run window)
