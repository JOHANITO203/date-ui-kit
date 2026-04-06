# PROJECT TRUTH

This document captures current repository truth only.  
Any non-current recommendation is explicitly marked `PROPOSAL`.

## 1. Actual stack
- React 19 + TypeScript + Vite 6.
- Routing via `react-router-dom`.
- Motion via `motion`.
- Tailwind v4 + custom CSS token system.
- Local runtime adapter as current API source (`appApi` -> `runtimeApi` in state).

## 2. Actual architecture
- `src/pages` = route-level wrappers.
- `src/components/*Screen.tsx` = feature screen composition and UI behavior.
- `src/state/appRuntimeStore.ts` = central app runtime state + local storage persistence.
- `src/contracts` = typed API/data contracts.
- `src/domain/*` = entitlement/business derivation helpers (travel pass, shadowghost).
- `src/services/appApi.ts` = latency-wrapped facade over runtime state.

## 3. Current routing model
- Public/auth/onboarding routes are explicitly separated from app shell routes.
- App shell uses adaptive navigation:
  - desktop: sidebar
  - mobile/tablet: bottom nav
- chat and edit profile run outside app shell.

## 4. Current responsive strategy
- Token-first responsive values in `src/index.css`.
- `useDevice()` for breakpoint/pointer branching.
- `useKeyboardInset()` for keyboard-aware mobile behavior.
- page-level token families exist for Discover/Messages/Boost and general containers.

## 5. Current UI/design patterns
- Glass/premium visual language is reused broadly (`glass`, `glass-panel`, gradients, glow tokens).
- Name + status rendering is centralized through reusable badge/name component usage.
- Premium plan cards and monetization cards are tokenized and animated.

## 6. Current animation patterns
- Framer Motion patterns:
  - route/screen transitions (`AnimatePresence`),
  - hover/tap micro interactions,
  - state transitions for counters, cards, and CTA feedback.
- CSS keyframes also exist in Tailwind config and global CSS.

## 7. Current translation strategy
- EN and RU translation structure with key-path lookup.
- fallback to EN is built in.
- placeholder consistency is validated in dev scripts.
- mojibake detection exists both at provider validation and dedicated UTF-8 script.

## 8. Current code-quality gates
- Type check: `npm run lint` (tsc no emit).
- Runtime behavior check: `npm run test:runtime`.
- i18n checks: `npm run i18n:utf8`, `npm run i18n:check`.
- Combined translation quality gate: `npm run quality:translations`.

## 9. Current naming conventions (observed)
- Components: `PascalCase`.
- Hooks: `useXxx`.
- Contracts: `*.contract.ts`.
- Route pages: `*Page.tsx`.
- Feature screens: `*Screen.tsx`.
- Plan/item business labels increasingly standardized in uppercase in UI copy.

## 10. Current business/domain concepts
- Plan and badges:
  - free, essential, gold, platinum, elite
  - premium, platinum, premium+ status language in product docs/flows
  - verified identity is distinct from paid status
- Monetization:
  - instant items, pass items, bundles
  - token consumption logic exists in runtime behavior checks
- Trust/safety relation states:
  - active, blocked_by_me, blocked_me, unmatched
- Travel pass and shadowghost access derived from entitlement source + expiry.

## 11. Current technical debt (evidence-backed)
- Runtime adapter still stands in place of real backend/auth/payment.
- i18n mojibake still appears in at least some source literals (`BoostScreen` emojis).
- TypeScript strictness is intentionally relaxed (`strict: false`).
- README context drift from current product architecture.
- Tailwind plugin/dependency coherence risk (`tailwindcss-animate` reference).

## 12. Proposal-only improvements
- `PROPOSAL`: add lightweight CI script that runs `lint + test:runtime + quality:translations`.
- `PROPOSAL`: add lint rule set only after baselining current code style to avoid high-noise regressions.
- `PROPOSAL`: progressively tighten TS options per folder (`contracts`, `domain`) before global strict mode.
