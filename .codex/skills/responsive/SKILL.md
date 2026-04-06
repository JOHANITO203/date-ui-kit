# Skill: responsive

## 1. Purpose
Preserve current token-driven responsive behavior and prevent layout regressions.

## 2. When to use
- Any change in screen layout classes or `src/index.css` tokens.
- Any issue involving clipping, overlap, safe-area, or mobile keyboard behavior.

## 3. Inputs to inspect before changing code
- `src/index.css` relevant token block (`--discover-*`, `--messages-*`, `--boost-*`, layout tokens).
- target `*Screen.tsx` class usage.
- `src/hooks/useDevice.ts`
- `src/hooks/useKeyboardInset.ts` if text input behavior is affected.

## 4. Rules to follow
- Adjust page-specific tokens before introducing ad-hoc one-off values.
- Preserve safe-area classes and bottom-nav spacing behavior.
- Keep desktop/tablet/mobile branching aligned with existing `useDevice` thresholds.
- Prefer small token updates over broad layout rewrites.

## 5. Existing repository patterns to preserve
- centralized CSS variables in `src/index.css`.
- app-shell + page container split (`screen-safe`, `content-safe`, `pb-nav`).
- card and spacing systems controlled by variables, not hardcoded inline dimensions.

## 6. Anti-patterns to avoid
- hardcoding pixel values directly in many components.
- removing safe-area logic to fix one viewport issue.
- editing unrelated token families while solving one screen issue.

## 7. Regression checklist
- check mobile small, mobile, tablet, desktop.
- verify no clipping in Boost tier titles and message items.
- verify time/unread/badge alignment in conversation rows.
- verify discover actions remain reachable and non-overlapping.

## 8. Definition of done
- Target layout issue fixed across breakpoints.
- No new overflow/clipping introduced in adjacent screen states.
