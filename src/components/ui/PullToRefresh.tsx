// src/components/ui/PullToRefresh.tsx
import { useRef, useState, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { springs } from '../../design/motion';
import { hapticFor } from '../../utils/haptics';

const THRESHOLD = 72;

export default function PullToRefresh({ onRefresh, children }: { onRefresh: () => Promise<void>; children: ReactNode }) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);
  const armed = useRef(false);

  return (
    <div
      onTouchStart={(e) => { if (e.currentTarget.scrollTop <= 0) startY.current = e.touches[0].clientY; }}
      onTouchMove={(e) => {
        if (startY.current == null || refreshing) return;
        const d = e.touches[0].clientY - startY.current;
        if (d > 0) {
          setPull(Math.min(d * 0.5, 110));
          if (d * 0.5 >= THRESHOLD && !armed.current) { armed.current = true; hapticFor.refresh(); }
        }
      }}
      onTouchEnd={async () => {
        if (pull * 1 >= THRESHOLD && !refreshing) {
          setRefreshing(true); setPull(THRESHOLD);
          try { await onRefresh(); } finally { setRefreshing(false); setPull(0); armed.current = false; startY.current = null; }
        } else { setPull(0); armed.current = false; startY.current = null; }
      }}
      className="h-full overflow-y-auto no-scrollbar"
    >
      <motion.div animate={{ y: pull }} transition={springs.smooth} style={{ height: 0 }}>
        <div className="flex h-12 items-center justify-center -mt-12 text-xs" style={{ color: 'var(--c-text-3)' }}>
          {refreshing ? 'Refreshing…' : pull >= THRESHOLD ? 'Release' : 'Pull'}
        </div>
      </motion.div>
      {children}
    </div>
  );
}
