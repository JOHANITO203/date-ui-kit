# I18N Language Tokens (EN / RU)

## Goal
Centralize UI text into reusable language tokens (`en` / `ru`) and remove hardcoded labels from components.

## Foundation
- `src/i18n/translations.ts`
  - Single source of truth for language tokens.
  - Structured by feature namespaces (`nav`, `splash`, `discover`, `likes`, `messages`, `chat`, `boost`, `profile`).
- `src/i18n/I18nProvider.tsx`
  - Global provider and `useI18n()` hook.
  - Locale persistence in `localStorage` (`swipe.locale`).
  - Browser locale fallback (`ru* -> ru`, otherwise `en`).
  - Runtime interpolation support with placeholders (`{count}`, `{name}`, `{timer}`, etc.).
- `src/components/ui/LanguageSwitch.tsx`
  - Reusable EN/RU switch component.
  - Active/inactive visual states with premium styling.

## App Integration
- `src/main.tsx`: app wrapped with `I18nProvider`.
- `src/pages/AppShell.tsx`: global `LanguageSwitch` shown in app shell.
- `src/components/SplashScreen.tsx`: `LanguageSwitch` + tokenized text.

## Tokenized Screens (completed)
- Navigation:
  - `src/components/Sidebar.tsx`
  - `src/components/BottomNav.tsx`
- Discover:
  - `src/components/SwipeScreen.tsx`
- Likes:
  - `src/components/MatchesScreen.tsx`
- Messages:
  - `src/components/MessagesScreen.tsx`
- Chat:
  - `src/components/ChatScreen.tsx`
- Boost (major UI tokens):
  - `src/components/BoostScreen.tsx`
- Profile (major UI tokens):
  - `src/components/ProfileScreen.tsx`
- Auth:
  - `src/components/LoginScreen.tsx`
  - `src/components/LoginMethodsScreen.tsx`
- Onboarding:
  - `src/components/OnboardingScreen.tsx`
- Settings:
  - `src/components/AccountSettingsScreen.tsx`
- Edit Profile:
  - `src/components/EditProfileScreen.tsx`

## Rules
- New visible text must be added to `translations.ts` first.
- Components should call `t('namespace.key')` (no hardcoded labels in JSX).
- Use interpolation for runtime values (`t('key', { value })`).

## Remaining Scope
- Optional: move remaining mock values (`182 cm`, `22 - 35`, `50 km`) into dedicated numeric format tokens if needed.
- Optional: add route-level locale prefixes if we later need shareable language-specific URLs.
