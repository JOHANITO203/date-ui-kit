# PROJECT AGENTS

These are practical execution agents for this repository only.

## 1) Repo Auditor
- Mission: verify current truth from code before any major task.
- Inspect first:
  - `package.json`
  - `src/App.tsx`
  - `src/state/appRuntimeStore.ts`
  - `src/index.css`
  - `src/i18n/I18nProvider.tsx`
- Must protect:
  - stack reality
  - route ownership
  - central state invariants
- Must never change blindly:
  - global token CSS
  - runtime state contracts
  - translation structures
- Handoff format:
  - Scope
  - Evidence
  - Risks
  - Safe action plan
- Risk reporting format:
  - Risk
  - Impact
  - Trigger files
  - Validation needed

## 2) Frontend Maintainer
- Mission: implement screen changes while preserving current architecture and patterns.
- Inspect first:
  - route page wrapper + target screen component
  - related token section in `src/index.css`
  - related contracts/domain helpers
- Must protect:
  - page/screen split pattern
  - app shell behavior
  - tokenized responsive layout
- Must never change blindly:
  - shared hooks (`useDevice`, `useKeyboardInset`)
  - global naming patterns
- Handoff format:
  - Changed files
  - User-visible behavior changes
  - Validation commands run
  - Remaining risk
- Risk reporting format:
  - Breakpoint risk
  - State risk
  - i18n risk

## 3) Responsive Guardian
- Mission: prevent clipping/overflow/safe-area regressions.
- Inspect first:
  - `src/index.css` token blocks
  - target screen layout classes
  - `useDevice` usage in screen
- Must protect:
  - token-based sizing conventions
  - mobile safe-area behavior
  - message/boost card readability
- Must never change blindly:
  - unrelated page tokens
  - global container widths
- Handoff format:
  - breakpoint matrix checked
  - before/after layout notes
  - unresolved edge cases
- Risk reporting format:
  - viewport
  - symptom
  - token/class likely responsible

## 4) i18n Guardian
- Mission: preserve locale stability and prevent fallback regressions.
- Inspect first:
  - `src/i18n/translations.ts`
  - `src/i18n/I18nProvider.tsx`
  - changed screen keys
- Must protect:
  - key parity EN/RU
  - placeholders
  - utf8 integrity
- Must never change blindly:
  - fallback logic
  - storage key behavior
- Handoff format:
  - keys added/updated
  - scripts run (`i18n:utf8`, `i18n:check`)
  - fallback behavior summary
- Risk reporting format:
  - key path
  - locale
  - failure type (missing, mojibake, placeholder)

## 5) UI Consistency Guardian
- Mission: keep premium/badge visual language coherent across screens.
- Inspect first:
  - `NameWithBadge`
  - Messages/Discover/Profile card patterns
  - Boost naming and badge tokens
- Must protect:
  - verified vs premium distinction
  - premium tier naming consistency
  - status readability under dense layouts
- Must never change blindly:
  - badge semantics
  - tier business naming without source update
- Handoff format:
  - components touched
  - consistency rules applied
  - screenshots/visual notes if available
- Risk reporting format:
  - inconsistency
  - affected screens
  - customer impact

## 6) Regression Checker
- Mission: validate each change against known fragile zones.
- Inspect first:
  - changed files list
  - `.codex/REGRESSION_MAP.md`
- Must protect:
  - no cross-screen silent breakage
  - no loss of persisted progress/settings
- Must never change blindly:
  - state migration/persistence keys
- Handoff format:
  - checks run
  - pass/fail
  - residual risk
- Risk reporting format:
  - check
  - result
  - confidence level

## 7) Release/Quality Checker
- Mission: prepare low-regression release candidate from current repo standards.
- Inspect first:
  - `package.json` scripts
  - build output warnings
  - i18n/runtime checks
- Must protect:
  - reproducible build
  - minimum quality gates
- Must never change blindly:
  - build config chunking strategy
  - env assumptions
- Handoff format:
  - command runbook
  - blockers
  - release readiness status
- Risk reporting format:
  - blocker
  - severity
  - workaround
