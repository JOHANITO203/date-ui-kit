# iOS-2027 Design Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a reusable iOS-premium design-system layer (tokens, motion, haptics, native primitives) in direction C (neo-minimal tactile dark) and apply it to the 3 hero screens (Discover, Chat/Messages, Profile).

**Architecture:** A new `src/design/` layer is the single source of truth (semantic CSS tokens + a Motion spring/variant library). A central haptic map standardizes feel. Small single-purpose primitives in `src/components/ui/` (Pressable, Sheet, TabBar, PullToRefresh, PageTransition, Skeleton, Toast, MatchCelebration) are consumed by the hero screens. No new heavy dependencies — Motion and Capacitor Haptics already exist.

**Tech Stack:** React 19, Vite, Tailwind v4, Motion (Framer Motion `motion/react`), Capacitor (@capacitor/haptics).

**Verification model:** No unit-test harness exists. Each task verifies with `npm run lint` (tsc --noEmit) + `npm run build`, plus a manual QA note. Commit after each task.

---

## File Structure

- `src/design/tokens.css` — **create** — v2 semantic tokens (elevation, hairlines, accent roles, motion tokens). Imported by `src/index.css`.
- `src/design/motion.ts` — **create** — named springs + reusable Motion variants + reduced-motion gate.
- `src/utils/haptics.ts` — **modify** — add a semantic interaction map on top of the existing `haptic()`.
- `src/components/ui/Pressable.tsx` — **create** — universal tap wrapper (scale + haptic).
- `src/components/ui/Skeleton.tsx` — **create** — shimmer placeholder.
- `src/components/ui/Toast.tsx` — **create** — transient inline feedback + provider.
- `src/components/ui/Sheet.tsx` — **create** — draggable bottom sheet with detents.
- `src/components/ui/TabBar.tsx` — **create** — native tab bar (restyles BottomNav usage).
- `src/components/ui/PullToRefresh.tsx` — **create** — elastic pull wrapper.
- `src/components/ui/PageTransition.tsx` — **create** — route transition wrapper.
- `src/components/ui/MatchCelebration.tsx` — **create** — reward overlay.
- `src/components/SwipeScreen.tsx` — **modify** — velocity physics, deck peek, overlays, haptics, celebration.
- `src/components/ChatScreen.tsx` + `src/components/MessagesScreen.tsx` — **modify** — skeletons, send spring, Sheet actions, pull-to-refresh.
- `src/components/ProfileScreen.tsx` + `src/components/EditProfileScreen.tsx` — **modify** — collapsing title, gallery parallax, edit Sheet.

---

## Task 1: Design tokens v2

**Files:**
- Create: `src/design/tokens.css`
- Modify: `src/index.css` (add `@import "./design/tokens.css";` after the Tailwind import)

- [ ] **Step 1: Create the tokens file**

```css
/* src/design/tokens.css — Direction C: neo-minimal tactile dark */
@layer base {
  :root {
    /* Elevation surfaces (OLED true black + layers) */
    --c-bg: #000000;
    --c-surface: #0b0b0f;
    --c-elevated: #14141a;
    --c-overlay: #1c1c24;

    /* Hairline borders (faint light edge) */
    --c-hairline: rgba(255, 255, 255, 0.10);
    --c-hairline-strong: rgba(255, 255, 255, 0.18);

    /* Text levels */
    --c-text: #ffffff;
    --c-text-2: #c7c7cf;
    --c-text-3: #8a8a92;

    /* Single neon accent (high-signal only) */
    --c-accent: #ec4899;
    --c-accent-2: #00bfff;
    --c-accent-grad: linear-gradient(135deg, #ff1493, #00bfff);
    --c-accent-glow: 0 0 22px rgba(236, 72, 153, 0.45);

    /* Motion tokens */
    --motion-fast: 140ms;
    --motion-base: 220ms;
    --motion-slow: 360ms;
    --ease-ios: cubic-bezier(0.32, 0.72, 0, 1); /* iOS-like ease-out */
  }
}
```

- [ ] **Step 2: Import it in `src/index.css`**

Add immediately after the existing `@import "tailwindcss";` line:

```css
@import "./design/tokens.css";
```

- [ ] **Step 3: Verify**

Run: `npm run lint && npm run build`
Expected: both pass (CSS import resolved, no TS errors).

- [ ] **Step 4: Commit**

```bash
git add src/design/tokens.css src/index.css
git commit -m "design: add v2 semantic tokens (direction C)"
```

---

## Task 2: Motion system

**Files:**
- Create: `src/design/motion.ts`

- [ ] **Step 1: Create the motion library**

```typescript
// src/design/motion.ts — named springs + reusable variants
import type { Transition, Variants } from 'motion/react';

export const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Named spring transitions — one place to tune the app's "feel".
export const springs = {
  snappy: { type: 'spring', stiffness: 520, damping: 36, mass: 0.9 } as Transition,
  smooth: { type: 'spring', stiffness: 280, damping: 32 } as Transition,
  bouncy: { type: 'spring', stiffness: 420, damping: 18 } as Transition,
};

// Reusable variants. When reduced-motion is on, fall back to opacity-only.
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
```

- [ ] **Step 2: Verify**

Run: `npm run lint`
Expected: PASS (Motion types resolve).

- [ ] **Step 3: Commit**

```bash
git add src/design/motion.ts
git commit -m "design: motion spring system + reusable variants"
```

---

## Task 3: Central haptic interaction map

**Files:**
- Modify: `src/utils/haptics.ts` (append; do not change the existing `haptic()`)

- [ ] **Step 1: Append a semantic interaction map**

```typescript
// Semantic interaction → haptic pattern. Use these names at call sites so the
// feel is consistent and tunable in one place.
export const hapticFor = {
  tap: () => haptic('select'),
  toggle: () => haptic('light'),
  like: () => haptic('medium'),
  pass: () => haptic('select'),
  superlike: () => haptic('medium'),
  match: () => haptic('success'),
  sheetSnap: () => haptic('light'),
  refresh: () => haptic('light'),
  error: () => haptic('error'),
} as const;
```

- [ ] **Step 2: Verify & commit**

Run: `npm run lint`
Expected: PASS

```bash
git add src/utils/haptics.ts
git commit -m "design: central semantic haptic map"
```

---

## Task 4: Pressable primitive

**Files:**
- Create: `src/components/ui/Pressable.tsx`

- [ ] **Step 1: Create the component**

```tsx
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
```

- [ ] **Step 2: Verify & commit**

Run: `npm run lint && npm run build`
Expected: PASS

```bash
git add src/components/ui/Pressable.tsx
git commit -m "ui: Pressable primitive (scale + haptic)"
```

---

## Task 5: Skeleton + Toast

**Files:**
- Create: `src/components/ui/Skeleton.tsx`
- Create: `src/components/ui/Toast.tsx`

- [ ] **Step 1: Skeleton**

```tsx
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
```

- [ ] **Step 2: Toast (context + hook)**

```tsx
// src/components/ui/Toast.tsx
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { springs } from '../../design/motion';

type Toast = { id: number; text: string };
const ToastCtx = createContext<(text: string) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((text: string) => {
    const id = performance.now();
    setToasts((t) => [...t, { id, text }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 px-4">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div key={t.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }} transition={springs.smooth}
              className="rounded-2xl border px-4 py-2 text-sm font-semibold text-white"
              style={{ background: 'var(--c-overlay)', borderColor: 'var(--c-hairline)' }}>
              {t.text}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}
```

- [ ] **Step 3: Mount the provider** in `src/main.tsx` — wrap `<App />` with `<ToastProvider>` inside the existing provider tree (after `AuthProvider`).

- [ ] **Step 4: Verify & commit**

Run: `npm run lint && npm run build`
Expected: PASS

```bash
git add src/components/ui/Skeleton.tsx src/components/ui/Toast.tsx src/main.tsx
git commit -m "ui: Skeleton + Toast primitives"
```

---

## Task 6: Sheet (draggable bottom sheet)

**Files:**
- Create: `src/components/ui/Sheet.tsx`

- [ ] **Step 1: Create the component**

```tsx
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
```

- [ ] **Step 2: Verify & commit**

Run: `npm run lint && npm run build`
Expected: PASS

```bash
git add src/components/ui/Sheet.tsx
git commit -m "ui: draggable bottom Sheet with spring snap"
```

---

## Task 7: TabBar

**Files:**
- Create: `src/components/ui/TabBar.tsx`
- Modify: `src/components/BottomNav.tsx` (render `TabBar` internals or restyle in place; keep its routes/props)

- [ ] **Step 1: Read `src/components/BottomNav.tsx`** to learn the existing tab list (routes, icons, active detection). Reuse that data.

- [ ] **Step 2: Create `TabBar.tsx`** — a presentational bar that takes `items: {key, icon, label, active, onPress}[]`. Each item is a `Pressable` (haptic `tap`). The active item shows a spring-animated indicator using `layoutId="tabIndicator"` (Motion shared layout) and the accent color. Container: `style={{ background:'var(--c-surface)', borderTop:'0.5px solid var(--c-hairline)' }}`, with `padding-bottom: max(env(safe-area-inset-bottom), 8px)`.

```tsx
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
```

- [ ] **Step 3: Wire `BottomNav` to render `TabBar`** with its existing route data (map current routes → `TabItem[]`, `active` from current location, `onPress` → navigate + nothing else). Keep `BottomNav`'s export and where it's used in `AppShell`.

- [ ] **Step 4: Verify & commit**

Run: `npm run lint && npm run build`. Manual QA: tabs switch, indicator springs to active, haptic on tap (device), safe-area respected.

```bash
git add src/components/ui/TabBar.tsx src/components/BottomNav.tsx
git commit -m "ui: native TabBar with spring indicator + haptic"
```

---

## Task 8: PullToRefresh

**Files:**
- Create: `src/components/ui/PullToRefresh.tsx`

- [ ] **Step 1: Create the wrapper** — a scroll container that tracks touch drag from the top; when pulled past `threshold` (72px) and released, fires `onRefresh` (async) and shows a spinner until it resolves. Haptic `refresh` at threshold crossing. Uses a `motion.div` translateY tied to pull distance with rubber-band damping (`distance * 0.5`).

```tsx
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
```

- [ ] **Step 2: Verify & commit**

Run: `npm run lint && npm run build`

```bash
git add src/components/ui/PullToRefresh.tsx
git commit -m "ui: elastic PullToRefresh"
```

---

## Task 9: PageTransition

**Files:**
- Create: `src/components/ui/PageTransition.tsx`

- [ ] **Step 1: Create the wrapper** — wraps a route's content in a `motion.div` keyed by route, fading+sliding in (`fadeUp` variant), reduced-motion aware. It does NOT own the router; screens/AppShell opt in by wrapping their content.

```tsx
// src/components/ui/PageTransition.tsx
import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { springs, prefersReducedMotion } from '../../design/motion';

export default function PageTransition({ children }: { children: ReactNode }) {
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
```

- [ ] **Step 2: Apply in `src/pages/AppShell.tsx`** — wrap the `<Outlet />` with `<PageTransition>` (keep the `key` as the current pathname via `useLocation` so it re-animates on route change).

- [ ] **Step 3: Verify & commit**

Run: `npm run lint && npm run build`

```bash
git add src/components/ui/PageTransition.tsx src/pages/AppShell.tsx
git commit -m "ui: PageTransition + apply in AppShell"
```

---

## Task 10: MatchCelebration

**Files:**
- Create: `src/components/ui/MatchCelebration.tsx`

- [ ] **Step 1: Create the overlay** — full-screen overlay shown when `open`, with a spring-scaled "It's a match" card, an accent halo, and a small CSS confetti burst (12 absolutely-positioned dots animated outward). Fires `hapticFor.match()` once on open (in a `useEffect` on `open`). Buttons: "Say hello" (`onMessage`) and "Keep swiping" (`onClose`), both `Pressable`. Respects reduced-motion (skip confetti, keep fade).

```tsx
// src/components/ui/MatchCelebration.tsx
import { useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import Pressable from './Pressable';
import { springs, prefersReducedMotion } from '../../design/motion';
import { hapticFor } from '../../utils/haptics';

type Props = { open: boolean; onClose: () => void; onMessage: () => void; peerName?: string };

export default function MatchCelebration({ open, onClose, onMessage, peerName }: Props) {
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
            It&apos;s a match
          </motion.h2>
          <p className="mt-2 text-sm" style={{ color: 'var(--c-text-2)' }}>
            {peerName ? `You and ${peerName} liked each other.` : 'You liked each other.'}
          </p>
          <div className="mt-8 flex w-full max-w-xs flex-col gap-3">
            <Pressable onPress={onMessage} haptic="tap"
              className="rounded-2xl py-3 font-bold text-white" >
              <span style={{ display: 'block', background: 'var(--c-accent-grad)', borderRadius: 16, padding: '12px 0' }}>Say hello</span>
            </Pressable>
            <Pressable onPress={onClose} haptic={null}
              className="rounded-2xl py-3 text-sm font-semibold" >
              <span style={{ color: 'var(--c-text-3)' }}>Keep swiping</span>
            </Pressable>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

- [ ] **Step 2: Verify & commit**

Run: `npm run lint && npm run build`

```bash
git add src/components/ui/MatchCelebration.tsx
git commit -m "ui: MatchCelebration reward overlay"
```

---

## Task 11: Discover — velocity physics + deck + celebration

**Files:**
- Modify: `src/components/SwipeScreen.tsx`

- [ ] **Step 1: Read `SwipeScreen.tsx`** fully. Locate: the `motion.div` swipe card, `useMotionValue` `x`/`y`, `handleDragEnd`, `swipe(dir)`, `showMatch`/`matchedUser` state, and the existing `haptic(...)` calls (added earlier).

- [ ] **Step 2: Upgrade drag → velocity throw.** In `handleDragEnd`, decide by combined offset AND velocity (not just the 80px threshold):

```tsx
const handleDragEnd = (_: unknown, info: PanInfo) => {
  const flungX = Math.abs(info.velocity.x) > 600;
  const flungUp = info.velocity.y < -600;
  if (info.offset.x > 80 || (flungX && info.offset.x > 0)) swipe('right');
  else if (info.offset.x < -80 || (flungX && info.offset.x < 0)) swipe('left');
  else if (info.offset.y < -80 || flungUp) openSuperLikeComposer();
};
```

Keep the existing `rotate`/`opacity`/overlay `useTransform` values; confirm the LIKE/NOPE/SUPER overlays already scale with `x`/`y` (they do — `likeScale`, `nopeScale`, `superLikeScale`). No change needed there.

- [ ] **Step 3: Add next-card peek.** Render the `nextUser` card behind the active one (already computed as `nextUser`), with `style={{ scale: 0.94, translateY: 10, opacity: 0.5 }}`, positioned absolutely behind the draggable card. Use `currentPhotoAttrs`/`nextPhotoAttrs` already present.

- [ ] **Step 4: Replace the match modal with `MatchCelebration`.** Import it; when `showMatch` is true render `<MatchCelebration open={showMatch} peerName={matchedUser?.name} onMessage={() => navigate('/messages')} onClose={() => setShowMatch(false)} />`. The existing `haptic('success')` in `swipe()` can stay or be removed (MatchCelebration fires `match` haptic itself — remove the duplicate in `swipe()` to avoid a double buzz).

- [ ] **Step 5: Verify**

Run: `npm run lint && npm run build`
Manual QA: card follows finger + rotates; a fast flick throws it; next card peeks and rises; like/nope overlays scale; match shows celebration with one haptic; rewind still works.

- [ ] **Step 6: Commit**

```bash
git add src/components/SwipeScreen.tsx
git commit -m "discover: velocity swipe physics, deck peek, match celebration"
```

---

## Task 12: Chat / Messages polish

**Files:**
- Modify: `src/components/ChatScreen.tsx`
- Modify: `src/components/MessagesScreen.tsx`

- [ ] **Step 1: ChatScreen — message send spring.** Wrap each rendered message bubble's enter in `fadeUp` (or `initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={springs.smooth}`). The realtime live-append (added earlier) will animate new incoming messages in.

- [ ] **Step 2: ChatScreen — actions Sheet.** Replace the existing `showSafetyMenu` inline menu with `<Sheet open={showSafetyMenu} onClose={...} title="Options">` containing the block/report/translate `Pressable` rows. Keep the existing handlers (`handleToggleBlock`, report, translate toggle).

- [ ] **Step 3: ChatScreen — loading skeletons.** While `isLoading` is true, render 4 `<Skeleton className="h-12 w-2/3" />` rows instead of the empty state.

- [ ] **Step 4: MessagesScreen — pull-to-refresh + skeletons.** Read `MessagesScreen.tsx`; wrap the conversation list in `<PullToRefresh onRefresh={async () => { /* re-call the existing conversations fetch */ }}>`; show `Skeleton` rows during initial load.

- [ ] **Step 5: Verify**

Run: `npm run lint && npm run build`
Manual QA: messages animate in; options open as a draggable sheet; skeletons show on load; pull-to-refresh on the conversation list works with haptic.

- [ ] **Step 6: Commit**

```bash
git add src/components/ChatScreen.tsx src/components/MessagesScreen.tsx
git commit -m "chat: send spring, actions Sheet, skeletons, pull-to-refresh"
```

---

## Task 13: Profile polish

**Files:**
- Modify: `src/components/ProfileScreen.tsx`
- Modify: `src/components/EditProfileScreen.tsx`

- [ ] **Step 1: Read both files.** Locate the scroll container, the header/title, and the photo gallery.

- [ ] **Step 2: Collapsing large title.** Track scroll position with `useScroll` (Motion) on the scroll container; map scrollY 0→80px to a title font-size/opacity transform via `useTransform` so the large title shrinks into a compact header. Reduced-motion: keep static.

- [ ] **Step 3: Gallery parallax.** For the lead photo, apply a subtle `y` parallax (`useTransform(scrollY, [0,200], [0,-30])`) so it drifts as the page scrolls.

- [ ] **Step 4: Edit via Sheet.** Where ProfileScreen links to edit, optionally present `EditProfileScreen` content inside a `<Sheet>` (or keep route — choose route if EditProfile is a full page). Apply `Pressable` to the toggle rows in EditProfile for consistent haptic feedback.

- [ ] **Step 5: Verify**

Run: `npm run lint && npm run build`
Manual QA: title collapses smoothly on scroll; lead photo parallaxes; toggles give haptic feedback.

- [ ] **Step 6: Commit**

```bash
git add src/components/ProfileScreen.tsx src/components/EditProfileScreen.tsx
git commit -m "profile: collapsing title, gallery parallax, haptic toggles"
```

---

## Task 14: Final verification + QA pass

- [ ] **Step 1: Full build + lint**

Run: `npm run lint && npm run build`
Expected: both PASS, SW/manifest still generated.

- [ ] **Step 2: Reduced-motion check** — toggle OS "reduce motion"; confirm large animations (celebration confetti, page slide, parallax) degrade to fades/static while taps still give feedback.

- [ ] **Step 3: Manual QA checklist (device or responsive emulator):**
  - Discover: finger-follow, velocity throw, deck peek, overlays, haptics, match celebration.
  - Chat: send spring, live incoming, typing dots, presence, actions sheet, skeletons.
  - Messages: pull-to-refresh + haptic.
  - Profile: collapsing title, parallax, haptic toggles.
  - TabBar: spring indicator, haptic, safe-area.

- [ ] **Step 4: Commit any QA fixes, then push**

```bash
git add -A && git commit -m "design: foundation QA fixes" && git push origin main
```

---

## Notes for the implementer

- **Match the surrounding code style** in each screen (className conventions, i18n via `t()`, existing state patterns). Don't reformat unrelated code.
- **Reuse, don't duplicate:** every tap target should migrate to `Pressable`/`hapticFor` over time, but only within the files you touch this pass — don't sweep the whole app.
- **No new heavy deps.** Everything uses Motion + Capacitor Haptics, already installed.
- **i18n:** any new visible strings (e.g. "It's a match", "Refreshing…") should go through the existing `t()` system with EN+RU keys (run `npm run i18n:check`). The plan's English literals are placeholders to translate.
- **Sound (deferred):** the spec lists optional micro-cue sounds, OFF by default. They are intentionally **not** implemented in this pass (haptics cover the "in-hand" feel). Add later as a thin, setting-gated audio layer if desired — `MatchCelebration` is the natural first hook.
