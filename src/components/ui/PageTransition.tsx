// src/components/ui/PageTransition.tsx
import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { springs, prefersReducedMotion } from '../../design/motion';

export default function PageTransition({ children }: { children: ReactNode; key?: string }) {
  const reduced = prefersReducedMotion();
  return (
    <motion.div
      initial={{ opacity: 0, y: reduced ? 0 : 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={springs.smooth}
      className="h-full"
    >
      {children}
    </motion.div>
  );
}
