// src/components/ui/Skeleton.tsx
export default function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-2xl ${className}`}
      style={{ background: 'linear-gradient(90deg,#14141a,#1c1c24,#14141a)', backgroundSize: '200% 100%' }}
      aria-hidden
    />
  );
}
