# TODO WORKFLOW (REGRESSION-FIRST)

Use this for every future task in this repository.

## Step 1: Impact scan
- Identify target screen/feature and touched files.
- Read related route wrapper + screen + contracts + domain helper.
- Read relevant token slice in `src/index.css`.

## Step 2: Dependency map
- List state/service dependencies (`appApi`, runtime store selectors, domain resolvers).
- List translation keys and locales affected.
- List shared components impacted (badge/name, shell, nav, etc.).

## Step 3: Risk list before coding
- UI clipping/overflow risk.
- state persistence risk.
- i18n fallback/mojibake risk.
- route/navigation risk.

## Step 4: Small-scope implementation
- Apply minimal edits in-place.
- Preserve existing patterns and naming.
- Avoid broad refactors unless explicitly requested.

## Step 5: Validation gates
- Always run nearest checks:
  - `npm run lint`
  - `npm run test:runtime` when state/business logic changed
  - `npm run quality:translations` when copy/i18n changed
- Manually smoke key flows for affected screens.

## Step 6: Handoff
- changed files
- behavior changes
- checks run + outcomes
- residual risk
- docs updates in `.codex` if convention changed

## Step 7: Proposal handling
- If adding a new rule not already in code:
  - mark as `PROPOSAL`
  - do not enforce as project truth without acceptance
