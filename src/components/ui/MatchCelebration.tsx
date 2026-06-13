// src/components/ui/MatchCelebration.tsx — reward overlay shown on a new match
import { useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import Pressable from './Pressable';
import { springs, prefersReducedMotion } from '../../design/motion';
import { hapticFor } from '../../utils/haptics';
import { useI18n } from '../../i18n/I18nProvider';

type Props = { open: boolean; onClose: () => void; onMessage: () => void; peerName?: string };

export default function MatchCelebration({ open, onClose, onMessage, peerName }: Props) {
  const { t } = useI18n();
  useEffect(() => { if (open) hapticFor.match(); }, [open]);
  const reduced = prefersReducedMotion();
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[80] flex flex-col items-center justify-center px-8 text-center"
          style={{ background: 'rgba(0,0,0,0.82)' }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          {!reduced && Array.from({ length: 12 }).map((_, i) => (
            <motion.span key={i} className="absolute h-2 w-2 rounded-full" style={{ background: 'var(--c-accent)' }}
              initial={{ opacity: 1, x: 0, y: 0 }}
              animate={{ opacity: 0, x: Math.cos((i / 12) * 6.28) * 160, y: Math.sin((i / 12) * 6.28) * 160 }}
              transition={{ duration: 0.9 }} />
          ))}
          <motion.h2 initial={{ scale: reduced ? 1 : 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            transition={springs.bouncy} className="text-3xl font-black"
            style={{ backgroundImage: 'var(--c-accent-grad)', WebkitBackgroundClip: 'text', color: 'transparent' }}>
            {t('match.title')}
          </motion.h2>
          <p className="mt-2 text-sm" style={{ color: 'var(--c-text-2)' }}>
            {peerName ? t('match.subtitleNamed', { name: peerName }) : t('match.subtitle')}
          </p>
          <div className="mt-8 flex w-full max-w-xs flex-col gap-3">
            <Pressable onPress={onMessage} haptic="tap" className="rounded-2xl py-3 font-bold text-white">
              <span style={{ display: 'block', background: 'var(--c-accent-grad)', borderRadius: 16, padding: '12px 0' }}>{t('match.sayHello')}</span>
            </Pressable>
            <Pressable onPress={onClose} haptic={null} className="rounded-2xl py-3 text-sm font-semibold">
              <span style={{ color: 'var(--c-text-3)' }}>{t('match.keepSwiping')}</span>
            </Pressable>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
