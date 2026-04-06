# Skill: routing

## 1. Purpose
Protect route integrity and app-shell behavior while making navigation changes.

## 2. When to use
- Any edit to `src/App.tsx`, `src/pages/*Page.tsx`, `src/pages/AppShell.tsx`.
- Any feature that adds/modifies route paths or redirects.

## 3. Inputs to inspect before changing code
- `src/App.tsx`
- `src/pages/AppShell.tsx`
- impacted page wrapper + screen component
- navigation components (`BottomNav`, `Sidebar`)

## 4. Rules to follow
- Keep public/auth/onboarding route boundaries explicit.
- Keep app-shell ownership explicit for Discover/Likes/Messages/Boost/Profile/Settings.
- Keep full-screen routes (`/chat/:userId`, `/profile/edit`) outside shell unless explicitly required.
- Preserve existing aliases and redirects unless a product decision says otherwise.

## 5. Existing repository patterns to preserve
- Thin route pages calling `*Screen` components.
- App shell adaptive nav: sidebar desktop, bottom nav non-desktop.
- Explicit fallback to `/404`.

## 6. Anti-patterns to avoid
- Moving routes across shell boundaries without impact analysis.
- Adding deep nested route trees when current structure is flat and explicit.
- Silent redirect changes that alter onboarding/auth entry paths.

## 7. Regression checklist
- `/` renders splash/home.
- `/onboarding` and aliases still resolve correctly.
- App shell routes render with expected nav (desktop/mobile).
- `/chat/:userId` and `/profile/edit` render correctly.
- Unknown route lands on `/404`.

## 8. Definition of done
- Route map is coherent.
- Shell behavior remains correct on mobile + desktop.
- No broken navigation path in critical journey.
