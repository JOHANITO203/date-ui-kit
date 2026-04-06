# SKILLS INDEX

Only skills justified by repository evidence are included.

## 1) routing
- Why exists: centralized route ownership in `src/App.tsx` + shell split in `src/pages/AppShell.tsx`.
- Protects against: broken route transitions, wrong shell context, navigation regressions.

## 2) responsive
- Why exists: heavy token-driven responsive system in `src/index.css` and `useDevice` branching.
- Protects against: clipping, overlap, safe-area regressions.

## 3) ui-patterns
- Why exists: repeated premium/glass/status components and consistency expectations across screens.
- Protects against: badge inconsistency, mixed nomenclature, visual drift.

## 4) i18n-stability
- Why exists: provider fallback logic + strict placeholder/mojibake checks + dedicated scripts.
- Protects against: locale fallback breakage, mojibake, key mismatches.

## 5) animations
- Why exists: broad motion usage for key interactions and transitions.
- Protects against: janky transitions, conflicting motion states, accessibility/perf drift.

## 6) code-quality
- Why exists: explicit project scripts for tsc/runtime/i18n checks and regression-sensitive shared files.
- Protects against: unchecked regressions and release surprises.

## 7) business-rules
- Why exists: explicit monetization/status/trust states in runtime store + domain modules + source-of-truth docs.
- Protects against: entitlement bugs, badge/status misapplication, token logic regressions.
