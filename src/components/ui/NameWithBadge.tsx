import React from 'react';

type NameSize = 'xl' | 'lg' | 'md';

interface NameWithBadgeProps {
  name: string;
  age?: number;
  verified?: boolean;
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

const NameWithBadge: React.FC<NameWithBadgeProps> = ({
  name,
  age,
  verified = false,
  size = 'lg',
  className = '',
  textClassName = '',
  badgeClassName = '',
}) => {
  const label = age !== undefined ? `${name}, ${age}` : name;

  return (
    <div className={`inline-flex items-center gap-[var(--name-badge-gap)] ${className}`}>
      <span className={`${sizeClassMap[size]} font-black tracking-tight leading-none whitespace-nowrap ${textClassName}`}>
        {label}
      </span>
      {verified && (
        <div
          className={`w-[var(--verified-badge-size)] h-[var(--verified-badge-size)] rounded-full bg-[#1D9BF0] border border-white/35 flex items-center justify-center shadow-[0_6px_16px_rgba(29,155,240,0.35)] shrink-0 ${badgeClassName}`}
        >
          <span className="text-white font-black leading-none text-[10px]">✓</span>
        </div>
      )}
    </div>
  );
};

export default NameWithBadge;
