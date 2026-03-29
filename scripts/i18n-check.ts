import { translations, type Locale } from '../src/i18n/translations.ts';

type FlatMap = Record<string, string>;

const PLACEHOLDER_RE = /\{(\w+)\}/g;
const MOJIBAKE_RE = /[\u00D0\u00D1\u00C3\u00C2\uFFFD]/;
const CYRILLIC_RE = /[\u0400-\u04FF]/;

const requiredRuKeys: string[] = [
  'brand.slogan',
  'discover.eyebrow',
  'messages.title',
  'boost.badge',
  'boost.heroLead',
  'boost.heroAccent',
  'boost.heroSubtitle',
  'boost.activateBoost',
  'boost.catalog.instant',
  'boost.catalog.passes',
  'boost.catalog.bundles',
  'settings.title',
];

const flattenStrings = (obj: Record<string, unknown>, prefix = ''): FlatMap => {
  const out: FlatMap = {};
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') {
      out[path] = value;
      continue;
    }
    if (value && typeof value === 'object') {
      Object.assign(out, flattenStrings(value as Record<string, unknown>, path));
    }
  }
  return out;
};

const placeholders = (value: string) => {
  const set = new Set<string>();
  for (const match of value.matchAll(PLACEHOLDER_RE)) set.add(match[1]);
  return set;
};

const sameSet = (a: Set<string>, b: Set<string>) => {
  if (a.size !== b.size) return false;
  for (const item of a) if (!b.has(item)) return false;
  return true;
};

const errors: string[] = [];

const base = flattenStrings(translations.en as Record<string, unknown>);
const locales = Object.keys(translations) as Locale[];

for (const locale of locales) {
  const current = flattenStrings(translations[locale] as Record<string, unknown>);

  for (const key of Object.keys(base)) {
    if (!(key in current)) {
      errors.push(`[${locale}] missing key: ${key}`);
    }
  }

  for (const [key, value] of Object.entries(current)) {
    if (MOJIBAKE_RE.test(value)) {
      errors.push(`[${locale}] mojibake detected: ${key}`);
    }
    const baseValue = base[key];
    if (!baseValue) continue;
    if (!sameSet(placeholders(baseValue), placeholders(value))) {
      errors.push(`[${locale}] placeholder mismatch: ${key}`);
    }
  }
}

const ruFlat = flattenStrings(translations.ru as Record<string, unknown>);
for (const key of requiredRuKeys) {
  const value = ruFlat[key];
  if (!value) {
    errors.push(`[ru] required translation key missing: ${key}`);
    continue;
  }
  if (!CYRILLIC_RE.test(value)) {
    errors.push(`[ru] expected Cyrillic content for key: ${key}`);
  }
}

if (errors.length > 0) {
  console.error(`i18n check failed (${errors.length} issues):`);
  for (const err of errors) console.error(`- ${err}`);
  process.exit(1);
}

console.log('i18n check passed: keys, placeholders, mojibake, RU coverage.');
