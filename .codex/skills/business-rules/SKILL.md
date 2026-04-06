# Skill: business-rules

## 1. Purpose
Protect monetization, entitlement, badge, and trust-safety logic from silent regressions.

## 2. When to use
- Any change to boost/items/passes/bundles.
- Any change to badge/status display logic.
- Any change to relation states (block/unblock/unmatched) or travel/shadowghost access.

## 3. Inputs to inspect before changing code
- `src/state/appRuntimeStore.ts`
- `src/domain/travelPass.ts`
- `src/domain/shadowGhost.ts`
- `src/contracts/*.contract.ts`
- `docs/sources_of_truth/*.md`
- `scripts/runtime-spec-check.ts`

## 4. Rules to follow
- Preserve entitlement-source precedence and expiration behavior.
- Keep verified status distinct from paid/premium status.
- Keep relation state semantics consistent between Messages and Chat.
- Keep item/pass naming and durations aligned with current source-of-truth docs.

## 5. Existing repository patterns to preserve
- runtime-based token consumption (`boost`, `superlike`, `rewind`).
- derived access helpers for travel pass and shadowghost.
- relation state gating for message sending.
- short-pass and premium display mapping logic in conversation rows.

## 6. Anti-patterns to avoid
- encoding business rules only in UI components.
- changing badge logic without updating state/contracts/docs together.
- introducing new monetization states without runtime test coverage.

## 7. Regression checklist
- run `npm run test:runtime`.
- verify boost activation and token consumption.
- verify relation state send restrictions.
- verify travel/shadowghost entitlement behavior before and after expiry.
- verify badge/status behavior on Discover/Messages/Profile.

## 8. Definition of done
- business behavior remains coherent across state, UI, and docs.
- runtime checks confirm no regression in core monetization and trust flows.
