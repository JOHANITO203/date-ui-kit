import React from 'react';
import { useI18n } from '../../i18n/I18nProvider';
import type { Locale } from '../../i18n/translations';

type Props = {
  className?: string;
};

const locales: Locale[] = ['en', 'ru'];

const LanguageSwitch: React.FC<Props> = ({ className = '' }) => {
  const { locale, setLocale, t } = useI18n();

  return (
    <div
      className={`inline-flex items-center rounded-full border border-white/15 bg-black/55 backdrop-blur-xl p-1 gap-1 ${className}`}
      role="group"
      aria-label="Language switch"
    >
      {locales.map((code) => {
        const active = locale === code;
        return (
          <button
            key={code}
            type="button"
            onClick={() => setLocale(code)}
            className={`h-7 min-w-[2.75rem] px-2 rounded-full text-[10px] font-black uppercase tracking-[0.16em] transition-all ${
              active
                ? 'bg-white text-black shadow-[0_8px_22px_rgba(255,255,255,0.22)]'
                : 'text-white/72 hover:text-white'
            }`}
            aria-pressed={active}
          >
            {t(`locale.${code}`)}
          </button>
        );
      })}
    </div>
  );
};

export default LanguageSwitch;

