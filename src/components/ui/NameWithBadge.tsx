import React from 'react';
import type { PlanTier, ShortPassTier } from '../../contracts';
import { useI18n } from '../../i18n/I18nProvider';

type NameSize = 'xl' | 'lg' | 'md';

interface NameWithBadgeProps {
  name: string;
  age?: number;
  verified?: boolean;
  premiumTier?: PlanTier;
  shortPassTier?: ShortPassTier | null;
  ageMasked?: boolean;
  size?: NameSize;
  className?: string;
  textClassName?: string;
  badgeClassName?: string;
}

const sizeClassMap: Record<NameSize, string> = {
  xl: 'text-[length:var(--name-xl)]',
  lg: 'text-[length:var(--name-lg)]',
  md: 'text-[length:var(--name-md)]',
};

type StatusBadgeTone = 'premium' | 'platinum' | 'premium_plus';

const statusBadgeClassMap: Record<StatusBadgeTone, string> = {
  premium:
    'bg-gradient-to-r from-pink-400 to-sky-300 text-black border-white/55 shadow-[0_6px_16px_rgba(236,72,153,0.28)]',
  platinum:
    'bg-cyan-300 text-black border-cyan-100/65 shadow-[0_6px_16px_rgba(34,211,238,0.22)]',
  premium_plus:
    'bg-gradient-to-r from-fuchsia-500 via-pink-500 to-rose-500 text-white border-fuchsia-100/40 shadow-[0_8px_18px_rgba(217,70,239,0.35)]',
};

const shortPassBadgeClassMap: Record<ShortPassTier, string> = {
  day: 'bg-orange-500/18 text-orange-100 border-orange-200/40 shadow-[0_0_12px_rgba(249,115,22,0.24)]',
  week: 'bg-amber-500/18 text-amber-100 border-amber-200/40 shadow-[0_0_12px_rgba(245,158,11,0.24)]',
};

const resolveStatusBadgeTone = (
  premiumTier: PlanTier,
  shortPassTier?: ShortPassTier | null,
): StatusBadgeTone | null => {
  if (premiumTier === 'elite') return 'premium_plus';
  if (premiumTier === 'platinum') return 'platinum';
  if (premiumTier !== 'free' || shortPassTier) return 'premium';
  return null;
};

const NameWithBadge: React.FC<NameWithBadgeProps> = ({
  name,
  age,
  verified = false,
  premiumTier = 'free',
  shortPassTier,
  ageMasked = false,
  size = 'lg',
  className = '',
  textClassName = '',
  badgeClassName = '',
}) => {
  const { t } = useI18n();
  const label = age !== undefined && !ageMasked ? `${name}, ${age}` : name;
  const statusBadgeTone = resolveStatusBadgeTone(premiumTier as PlanTier, shortPassTier);
  const statusBadgeLabel =
    statusBadgeTone === 'premium_plus'
      ? t('badges.premiumPlus')
      : statusBadgeTone === 'platinum'
        ? t('badges.platinum')
        : statusBadgeTone === 'premium'
          ? t('badges.premium')
          : null;
  const shortPassLabel =
    shortPassTier === 'day'
      ? t('badges.dayPass')
      : shortPassTier === 'week'
        ? t('badges.weekPass')
        : null;

  return (
    <div className={`inline-flex max-w-full min-w-0 items-center gap-[var(--name-badge-gap)] ${className}`}>
      <span
        className={`${sizeClassMap[size]} min-w-0 font-black tracking-tight leading-none whitespace-nowrap ${textClassName}`}
      >
        {label}
      </span>
      <div className="inline-flex shrink-0 items-center gap-1.5">
        {verified && (
          <div
            className={`w-[var(--verified-badge-size)] h-[var(--verified-badge-size)] rounded-full bg-[#1D9BF0] border border-white/45 flex items-center justify-center shadow-[0_6px_16px_rgba(29,155,240,0.35)] shrink-0 ${badgeClassName}`}
            aria-label={t('badges.verified')}
            title={t('badges.verified')}
          >
            <svg viewBox="0 0 12 12" className="w-[9px] h-[9px] text-white" aria-hidden>
              <path
                d="M2.2 6.2 4.8 8.7 9.8 3.7"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        )}
        {statusBadgeTone && statusBadgeLabel && (
          <div
            className={`h-[var(--verified-badge-size)] rounded-full border px-2.5 inline-flex items-center justify-center text-[9px] font-black uppercase tracking-[0.12em] ${statusBadgeClassMap[statusBadgeTone]}`}
            aria-label={statusBadgeLabel}
            title={statusBadgeLabel}
          >
            {statusBadgeLabel}
          </div>
        )}
        {shortPassTier && shortPassLabel && (
          <div
            className={`h-[var(--verified-badge-size)] rounded-full border px-2 inline-flex items-center justify-center text-[9px] font-black uppercase tracking-[0.11em] ${shortPassBadgeClassMap[shortPassTier]}`}
            aria-label={shortPassLabel}
            title={shortPassLabel}
          >
            {shortPassLabel}
          </div>
        )}
      </div>
    </div>
  );
};

export default NameWithBadge;
