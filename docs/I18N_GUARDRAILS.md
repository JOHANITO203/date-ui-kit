# I18N Guardrails (EN/RU)

## Part 1 - Source of truth
- Single source files: `src/i18n/translations.ts`
- Locales: `en`, `ru`
- Rule: no UI copy hardcoded in components/pages, always use `t('...')`

## Part 2 - Anti-regression checks
- Runtime dev checks in `src/i18n/I18nProvider.tsx`:
  - missing keys vs EN
  - placeholder mismatch (`{name}`, `{count}`, etc.)
  - mojibake detection
- Script check: `scripts/i18n-check.ts`
  - key parity
  - placeholder parity
  - mojibake detection
  - required RU business keys are really Cyrillic

## Part 3 - Delivery workflow
1. Update EN + RU together in `src/i18n/translations.ts`
2. Run: `npm run i18n:check`
3. Run: `npm run quality:translations`
4. Ship only if both checks pass

## Commands
- `npm run i18n:check`
- `npm run quality:translations`
