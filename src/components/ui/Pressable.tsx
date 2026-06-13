// src/components/ui/Pressable.tsx — universal tap wrapper (scale + haptic)
import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { springs, prefersReducedMotion } from '../../design/motion';
import { hapticFor } from '../../utils/haptics';

type PressableProps = {
  children: ReactNode;
  onPress?: () => void;
  haptic?: keyof typeof hapticFor | null; // default 'tap'; null disables
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
  key?: string | number; // allow list usage (this project ships no @types/react to special-case `key`)
};

export default function Pressable({
  children, onPress, haptic = 'tap', disabled, className, ariaLabel,
}: PressableProps) {
  return (
    <motion.button
      type="button"
      aria-label={ariaLabel}
      disabled={disabled}
      className={className}
      whileTap={prefersReducedMotion() || disabled ? undefined : { scale: 0.96 }}
      transition={springs.snappy}
      onClick={() => {
        if (disabled) return;
        if (haptic) hapticFor[haptic]();
        onPress?.();
      }}
    >
      {children}
    </motion.button>
  );
}
