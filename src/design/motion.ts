import type { Transition, Variants } from 'motion/react';

export const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const springs = {
  snappy: { type: 'spring', stiffness: 520, damping: 36, mass: 0.9 } as Transition,
  smooth: { type: 'spring', stiffness: 280, damping: 32 } as Transition,
  bouncy: { type: 'spring', stiffness: 420, damping: 18 } as Transition,
};

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: prefersReducedMotion() ? 0 : 12 },
  show: { opacity: 1, y: 0, transition: springs.smooth },
};

export const pressScale = {
  whileTap: prefersReducedMotion() ? {} : { scale: 0.96 },
  transition: springs.snappy,
};

export const sheetVariants: Variants = {
  hidden: { y: '100%' },
  show: { y: 0, transition: springs.smooth },
  exit: { y: '100%', transition: { duration: 0.2 } },
};

export const listStagger: Variants = {
  show: { transition: { staggerChildren: prefersReducedMotion() ? 0 : 0.04 } },
};
