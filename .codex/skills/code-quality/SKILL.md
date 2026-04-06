# Skill: code-quality

## 1. Purpose
Apply existing repository quality gates consistently with low regression risk.

## 2. When to use
- Any non-trivial change.
- Always before declaring a task complete.

## 3. Inputs to inspect before changing code
- `package.json` scripts.
- changed files and dependency fan-out.
- `.codex/REGRESSION_MAP.md`.

## 4. Rules to follow
- Run at least the nearest relevant checks:
  - `npm run lint`
  - `npm run test:runtime` when runtime/business/state changes
  - `npm run quality:translations` when i18n/copy changes
- Keep changes scoped and reversible.
- Update docs when a convention is intentionally changed.

## 5. Existing repository patterns to preserve
- script-based validation workflow.
- runtime behavior assertions for core flows.
- i18n utf8 and placeholder verification scripts.

## 6. Anti-patterns to avoid
- skipping checks due "small change" in shared files.
- mixing unrelated refactors with bug fixes.
- shipping with known warnings/regressions undocumented.

## 7. Regression checklist
- list changed files.
- map shared dependencies touched.
- execute relevant scripts.
- perform manual smoke on impacted screens.
- record residual risk.

## 8. Definition of done
- required checks are green or documented with reason.
- regression risk is explicitly communicated.
