// src/components/ui/Sheet.tsx — bottom sheet, drag-to-dismiss, spring snap
import { AnimatePresence, motion, type PanInfo } from 'motion/react';
import type { ReactNode } from 'react';
import { springs } from '../../design/motion';
import { hapticFor } from '../../utils/haptics';

type SheetProps = { open: boolean; onClose: () => void; title?: string; children: ReactNode };

export default function Sheet({ open, onClose, title, children }: SheetProps) {
  const handleDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 120 || info.velocity.y > 600) {
      hapticFor.sheetSnap();
      onClose();
    }
  };
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="fixed inset-0 z-[70] bg-black/60"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            className="fixed inset-x-0 bottom-0 z-[71] rounded-t-[28px] border-t p-5 pb-[max(env(safe-area-inset-bottom),1rem)]"
            style={{ background: 'var(--c-elevated)', borderColor: 'var(--c-hairline)' }}
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={springs.smooth}
            drag="y" dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={handleDragEnd}>
            <div className="mx-auto mb-4 h-1.5 w-10 rounded-full" style={{ background: 'var(--c-hairline-strong)' }} />
            {title && <h3 className="mb-3 text-base font-bold text-white">{title}</h3>}
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
