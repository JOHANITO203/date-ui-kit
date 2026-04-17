# Discover Closure Handoff (2026-04-17)

## Scope
- Subject 1: `discover_settings_query_timeout_900ms`
- Subject 2: `discover.public_bucket_disabled_fallback_to_signed`

## Runtime Dataset Proof
- Endpoint: `GET /discover/feed?quickFilters=all`
- Token subject used for validation: `11111111-1111-4111-8111-111111111111` (UUID)
- Non-empty feed across validation window: `10/10 runs`
- Candidates per run: `36`

## Metrics (10 runs)
- Latency ms by run: `140, 387, 145, 592, 141, 135, 128, 121, 139, 123`
- p50: `139 ms`
- p95: `387 ms`

## Subject 1 Validation
- `discover_settings_query_timeout_900ms`: `0`
- `discover.settings_query_failed_continue_with_defaults`: `0`
- Verdict: `VALIDATED`

## Subject 2 Validation
- `discover.public_bucket_disabled_fallback_to_signed`: `0`
- URL counts (payloads):
- `public`: `290`
- `signed`: `0`
- Verdict: `VALIDATED`

## Evidence Artifacts
- Runtime summary: `test-results/discover-validation-summary-run2.json`
- Runtime logs: `test-results/discover-runtime.log`
- Feed payload samples: `test-results/discover-feed-run2-1.json` ... `test-results/discover-feed-run2-10.json`

## Notes
- Earlier failed attempts used non-UUID token subject (`local-test-user`) and produced `22P02`.
- These lines are outside the validated window/scope for the two Discover incidents.
