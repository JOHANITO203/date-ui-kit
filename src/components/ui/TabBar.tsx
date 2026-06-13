// src/components/ui/TabBar.tsx
import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import Pressable from './Pressable';
import { springs } from '../../design/motion';

export type TabItem = { key: string; icon: ReactNode; label: string; active: boolean; onPress: () => void };

export default function TabBar({ items }: { items: TabItem[] }) {
  return (
    <nav className="flex items-stretch justify-around px-2"
      style={{ background: 'var(--c-surface)', borderTop: '0.5px solid var(--c-hairline)',
               paddingBottom: 'max(env(safe-area-inset-bottom), 8px)' }}>
      {items.map((it) => (
        <Pressable key={it.key} onPress={it.onPress} ariaLabel={it.label}
          className="relative flex flex-1 flex-col items-center gap-1 py-2">
          {it.active && (
            <motion.span layoutId="tabIndicator" transition={springs.snappy}
              className="absolute -top-0.5 h-1 w-8 rounded-full" style={{ background: 'var(--c-accent)' }} />
          )}
          <span style={{ color: it.active ? 'var(--c-accent)' : 'var(--c-text-3)' }}>{it.icon}</span>
          <span className="text-[9px] font-bold" style={{ color: it.active ? 'var(--c-text)' : 'var(--c-text-3)' }}>{it.label}</span>
        </Pressable>
      ))}
    </nav>
  );
}
