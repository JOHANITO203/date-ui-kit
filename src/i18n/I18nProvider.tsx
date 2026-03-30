import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Locale, translations } from './translations';

const STORAGE_KEY = 'exotic.locale';
const PLACEHOLDER_RE = /\{(\w+)\}/g;
const MOJIBAKE_RE = /[\u00D0\u00D1\u00C3\u00C2\uFFFD]/;

type Params = Record<string, string | number>;

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Params) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

const resolve = (obj: Record<string, any>, path: string): string | undefined => {
  return path.split('.').reduce<any>((acc, part) => {
    if (acc && typeof acc === 'object') return acc[part];
    return undefined;
  }, obj);
};

const interpolate = (template: string, params?: Params) => {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, key: string) => `${params[key] ?? `{${key}}`}`);
};

const flattenStrings = (obj: Record<string, any>, prefix = ''): Record<string, string> => {
  const out: Record<string, string> = {};
  Object.entries(obj).forEach(([key, value]) => {
    const next = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') {
      out[next] = value;
      return;
    }
    if (value && typeof value === 'object') {
      Object.assign(out, flattenStrings(value as Record<string, any>, next));
    }
  });
  return out;
};

const extractPlaceholders = (value: string) => {
  const set = new Set<string>();
  for (const match of value.matchAll(PLACEHOLDER_RE)) {
    set.add(match[1]);
  }
  return set;
};

const sameSet = (a: Set<string>, b: Set<string>) => {
  if (a.size !== b.size) return false;
  for (const item of a) {
    if (!b.has(item)) return false;
  }
  return true;
};

const validateTranslations = () => {
  const base = flattenStrings(translations.en as Record<string, any>);
  const locales = Object.keys(translations) as Locale[];
  const errors: string[] = [];

  locales.forEach((locale) => {
    const current = flattenStrings(translations[locale] as Record<string, any>);

    Object.entries(current).forEach(([key, value]) => {
      if (MOJIBAKE_RE.test(value)) {
        errors.push(`[${locale}] mojibake detected: ${key}`);
      }

      const baseValue = base[key];
      if (!baseValue) return;

      const basePH = extractPlaceholders(baseValue);
      const localePH = extractPlaceholders(value);
      if (!sameSet(basePH, localePH)) {
        errors.push(`[${locale}] placeholder mismatch: ${key}`);
      }
    });
  });

  if (errors.length > 0) {
    const summary = errors.slice(0, 20).join('\n');
    throw new Error(`i18n validation failed (${errors.length} issues)\n${summary}`);
  }
};

if (import.meta.env.DEV) {
  validateTranslations();
}

const detectInitialLocale = (): Locale => {
  if (typeof window === 'undefined') return 'en';
  const saved = window.localStorage.getItem(STORAGE_KEY) as Locale | null;
  if (saved === 'en' || saved === 'ru') return saved;
  const browser = window.navigator.language.toLowerCase();
  return browser.startsWith('ru') ? 'ru' : 'en';
};

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [locale, setLocaleState] = useState<Locale>(detectInitialLocale);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, locale);
    document.documentElement.lang = locale;
    const brandName =
      (resolve(translations[locale], 'brand.name') as string | undefined) ??
      (resolve(translations.en, 'brand.name') as string | undefined) ??
      'exotic';
    document.title = brandName;
  }, [locale]);

  const setLocale = (next: Locale) => {
    setLocaleState(next);
  };

  const t = (key: string, params?: Params) => {
    const raw = resolve(translations[locale], key) ?? resolve(translations.en, key) ?? key;
    if (typeof raw !== 'string') return key;
    return interpolate(raw, params);
  };

  const value = useMemo(() => ({ locale, setLocale, t }), [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useI18n = () => {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useI18n must be used inside I18nProvider');
  }
  return ctx;
};
