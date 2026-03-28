import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Locale, translations } from './translations';

const STORAGE_KEY = 'swipe.locale';

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

