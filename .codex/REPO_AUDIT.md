# REPO AUDIT

Date: 2026-04-06
Scope: repository-first audit from code and docs currently in `d:\Dev\date-ui-kit`.

## 1. Stack observed
- Frontend: React 19 + TypeScript + Vite 6 (`package.json`, `src/main.tsx`).
- Router: `react-router-dom` (BrowserRouter + Routes in `src/App.tsx`).
- Motion: `motion` (Framer Motion API style usage in multiple screens).
- Styling: Tailwind v4 (`@tailwindcss/vite` + `@import "tailwindcss"` in `src/index.css`) plus large custom token CSS.
- Icons: `lucide-react`.
- Runtime/back-end mode in repo: local runtime store adapter, not real remote API (`src/services/appApi.ts` + `src/state/appRuntimeStore.ts`).
- Scripts: TypeScript check + runtime behavior check + i18n checks.

## 2. App structure observed
- Routing entry: `src/App.tsx`.
- Page wrappers: `src/pages/*Page.tsx` mostly thin wrappers around `src/components/*Screen.tsx`.
- Shell layout: `src/pages/AppShell.tsx` controls sidebar (desktop) and bottom nav (mobile/tablet).
- Domain logic modules exist: `src/domain/travelPass.ts`, `src/domain/shadowGhost.ts`.
- Contracts: explicit files in `src/contracts/*.contract.ts`.
- Runtime state source: `src/state/appRuntimeStore.ts`.

## 3. Routing model (actual)
- Public: `/`, `/login`, `/login/methods`, `/onboarding` (+ aliases/redirects).
- App shell routes: `/discover`, `/likes`, `/messages`, `/boost`, `/profile`, `/settings...`.
- Full-page child routes: `/chat/:userId`, `/profile/edit`.
- Fallback: `/404`.

## 4. Styling and responsive strategy (actual)
- Global token system in `src/index.css` with many page-scoped variables (`--discover-*`, `--messages-*`, `--boost-*`).
- Safe-area utilities and layout helpers are present (`screen-safe`, `content-safe`, `pb-nav` usage in screens/shell).
- `useDevice` hook controls mobile/tablet/desktop behavior by width and pointer.
- `useKeyboardInset` exists for mobile keyboard-aware layouts.

## 5. i18n strategy (actual)
- `I18nProvider` in `src/i18n/I18nProvider.tsx`.
- Locale persistence key: `exotic.locale`.
- Fallback strategy: locale key -> EN key -> raw key.
- Dev validation includes placeholder parity and mojibake detection.
- Strict validation can throw via `VITE_STRICT_I18N=true`.
- Quality scripts:
  - `npm run i18n:utf8`
  - `npm run i18n:check`
  - `npm run quality:translations`

## 6. Business/product vocabulary confirmed
- Plan tiers and premium status concepts across UI/data: `free`, `essential`, `gold`, `platinum`, `elite`.
- Badges and status language in docs and components:
  - premium / platinum / premium+
  - verified identity
- Monetization concepts in Boost/Profile/docs:
  - BOOST, SUPERLIKE, REWIND, ICEBREAKER, SHADOWGHOST, TRAVEL PASS, TRAVEL PASS+.
- Relation states in chat/messages:
  - active, blocked_by_me, blocked_me, unmatched.

## 7. Quality checks observed
- `npm run lint` -> `tsc --noEmit` (no ESLint currently configured in scripts).
- Runtime flow checks in `scripts/runtime-spec-check.ts`.
- i18n checks in `scripts/i18n-check.ts` and `scripts/i18n-utf8-check.ts`.

## 8. Inconsistencies / fragile areas found
- `src/README.md` is legacy AI Studio/Gemini oriented and does not reflect current runtime architecture.
- `tailwind.config.ts` includes `tailwindcss-animate` plugin pattern, but this package is not listed in current `dependencies/devDependencies` (risk of drift).
- `BoostScreen.tsx` contains mojibake for emoji literals (`âš¡`, `ðŸ...`), directly conflicting with i18n utf8 stability goals.
- Architecture is currently front-end heavy with runtime mocks; real backend/auth/payment integration remains pending.
- `strict` TypeScript mode is disabled in app tsconfig, so type regressions can hide.

## 9. Regression-sensitive zones
- `src/index.css` token edits affect many screens at once.
- `src/state/appRuntimeStore.ts` is central for feed/chat/settings/boost flows.
- `src/i18n/translations.ts` and `I18nProvider.tsx` impact every screen.
- `NameWithBadge` and message list item layout affect discover/messages/profile identity consistency.
- Route changes in `src/App.tsx` can break onboarding/auth/app-shell transitions quickly.

## 10. Missing docs (from code reality)
- No single engineering doc that maps:
  - route ownership,
  - token-to-screen boundaries,
  - runtime store invariants,
  - mandatory pre-merge checks.
- Existing source-of-truth docs in `docs/sources_of_truth` are useful product references but not an engineering execution playbook.
