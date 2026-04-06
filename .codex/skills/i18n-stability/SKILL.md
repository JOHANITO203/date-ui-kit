# Skill: i18n-stability

## 1. Purpose
Prevent translation regressions, fallback bugs, and encoding corruption.

## 2. When to use
- Any change in translation keys or localized UI copy.
- Any issue where locale switches unexpectedly or text appears corrupted.

## 3. Inputs to inspect before changing code
- `src/i18n/translations.ts`
- `src/i18n/I18nProvider.tsx`
- `scripts/i18n-check.ts`
- `scripts/i18n-utf8-check.ts`

## 4. Rules to follow
- Keep key structure aligned between EN and RU.
- Preserve placeholder parity for every locale.
- Keep fallback behavior: locale -> EN -> key.
- Run i18n scripts after translation changes.

## 5. Existing repository patterns to preserve
- localStorage locale persistence key `exotic.locale`.
- strict validation mode via `VITE_STRICT_I18N`.
- mojibake detection and UTF-8 script checks.

## 6. Anti-patterns to avoid
- hardcoding localized strings directly in components.
- adding locale keys in one language only.
- introducing non-UTF-8 text literals in source files.

## 7. Regression checklist
- run `npm run i18n:utf8`.
- run `npm run i18n:check`.
- manually switch EN/RU and open Settings + Boost + Messages.
- verify no unintended fallback to EN on valid RU keys.

## 8. Definition of done
- i18n scripts pass.
- locale persistence and fallback behave as expected.
- no mojibake or placeholder mismatch introduced.
