import React from 'react';
import type { PlanTier } from '../../contracts';

type NameSize = 'xl' | 'lg' | 'md';

interface NameWithBadgeProps {
  name: string;
  age?: number;
  verified?: boolean;
  premiumTier?: PlanTier;
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

const premiumClassMap: Record<Exclude<PlanTier, 'free'>, string> = {
  essential: 'bg-slate-200 text-black border-slate-50/60',
  gold: 'bg-amber-300 text-black border-amber-100/60',
  platinum: 'bg-cyan-300 text-black border-cyan-100/60',
  elite: 'bg-fuchsia-300 text-black border-fuchsia-100/60',
};

const NameWithBadge: React.FC<NameWithBadgeProps> = ({
  name,
  age,
  verified = false,
  premiumTier = 'free',
  ageMasked = false,
  size = 'lg',
  className = '',
  textClassName = '',
  badgeClassName = '',
}) => {
  const label = age !== undefined && !ageMasked ? `${name}, ${age}` : name;
  const showPremiumBadge = premiumTier !== 'free';

  return (
    <div className={`inline-flex items-center gap-[var(--name-badge-gap)] ${className}`}>
      <span className={`${sizeClassMap[size]} font-black tracking-tight leading-none whitespace-nowrap ${textClassName}`}>
        {label}
      </span>
      <div className="inline-flex items-center gap-1">
        {verified && (
          <div
            className={`w-[var(--verified-badge-size)] h-[var(--verified-badge-size)] rounded-full bg-[#1D9BF0] border border-white/35 flex items-center justify-center shadow-[0_6px_16px_rgba(29,155,240,0.35)] shrink-0 ${badgeClassName}`}
            aria-label="Verified identity"
            title="Verified identity"
          >
            <span className="text-white font-black leading-none text-[9px]">V</span>
          </div>
        )}
        {showPremiumBadge && (
          <div
            className={`h-[var(--verified-badge-size)] rounded-full border px-2 inline-flex items-center justify-center text-[9px] font-black uppercase tracking-[0.12em] ${premiumClassMap[premiumTier as Exclude<PlanTier, 'free'>]}`}
            aria-label={`Premium tier ${premiumTier}`}
            title={`Premium tier ${premiumTier}`}
          >
            {premiumTier}
          </div>
        )}
      </div>
    </div>
  );
};

export default NameWithBadge;
