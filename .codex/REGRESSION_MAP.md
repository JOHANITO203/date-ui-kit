# REGRESSION MAP

## A. Highest risk zones

1) `src/state/appRuntimeStore.ts`
- Why risky: shared runtime source for feed, likes, boost, chat, settings.
- Typical regressions:
  - token balances drift,
  - relation state mismatches,
  - onboarding/settings persistence breaks.
- Mandatory checks:
  - `npm run test:runtime`
  - manual smoke for Discover -> Messages -> Profile transitions.

2) `src/index.css`
- Why risky: central token bed for multiple screens.
- Typical regressions:
  - clipping/overflow in cards,
  - mobile safe-area breaks,
  - cross-page spacing collapse.
- Mandatory checks:
  - desktop + mobile visual pass on Discover, Messages, Boost, Profile.

3) `src/i18n/translations.ts` and `src/i18n/I18nProvider.tsx`
- Why risky: global copy, fallback, placeholders, UTF-8.
- Typical regressions:
  - fallback switching unexpectedly,
  - mojibake in RU or item labels,
  - placeholder runtime leaks (`{count}` displayed raw).
- Mandatory checks:
  - `npm run quality:translations`
  - manual switch EN/RU across Settings + Boost + Messages.

4) `src/App.tsx` + `src/pages/AppShell.tsx`
- Why risky: route entry/exit and navigation shell ownership.
- Typical regressions:
  - wrong route context,
  - lost nav on mobile,
  - chat/edit routes inheriting wrong shell behavior.
- Mandatory checks:
  - route smoke traversal from `/` to app screens and back.

5) Badge/status presentation components and message item layouts
- Why risky: repeated identity rendering across screens.
- Typical regressions:
  - badge clipping,
  - time/unread overlap,
  - inconsistent premium/verified signal.
- Mandatory checks:
  - compare Discover + Messages + Profile visual consistency.

## B. Medium risk zones
- `src/components/BoostScreen.tsx`: monetization catalog, labels, layout density.
- `src/components/OnboardingScreen.tsx`: step persistence and resume UX.
- `src/components/AccountSettingsScreen.tsx`: privacy/travel pass server switch behavior.
- `src/domain/*.ts`: entitlement source precedence and expiration handling.

## C. Known active risk signals
- Mojibake literals in Boost instant-item emoji labels (source-level encoding issue).
- Build warning: large chunk size in Vite output.
- README mismatch with current runtime/product reality.

## D. Regression-first execution rules
1. Inspect impacted files before editing.
2. List direct dependencies before changing shared logic.
3. Preserve existing patterns unless there is a documented reason.
4. Avoid broad refactors without explicit request.
5. Run nearest quality scripts for changed area.
6. Update docs in `.codex` when conventions are changed.
