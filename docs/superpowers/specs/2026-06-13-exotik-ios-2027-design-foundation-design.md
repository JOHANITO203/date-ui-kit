# Exotik — iOS-premium 2027 design foundation (Direction C)

Status: approved (brainstorm 2026-06-13). Scope: **design foundation + 3 hero screens**.
Stack: React 19 + Vite + Tailwind v4 + Motion (Framer) + Capacitor. No new heavy deps.

## 1. Goal

Mature the existing dark/glass UI into a premium, native-feeling iOS-2027 experience —
focused on the **feel in the user's hand**: gesture physics, mapped haptics, fluid
60fps transitions, reward moments, and liveliness. Build a reusable **system** once,
apply it to Discover, Chat/Messages and Profile, then roll out to the rest later.

## 2. Design direction — C: Neo-minimal Tactile Dark

Evolution of the current identity, more disciplined:

- **Surfaces:** true OLED black (`#000`) + 3 elevation layers (surface / elevated / overlay).
- **Borders:** hairlines (~0.5px) with a faint light edge instead of heavy glass.
- **Accent:** a single neon accent (the existing pink→cyan gradient) reserved for
  high-signal moments (like, match, active state); everything else stays sober.
- **Type:** keep the current fluid clamp scale; tighten usage and hierarchy (3 text levels).
- **Motion-forward:** the design reads as "alive" through interaction, not decoration.

## 3. Architecture (the system layer)

New folder `src/design/` (single source of truth), consumed by all screens:

- `src/design/tokens.css` — v2 semantic tokens layered on the existing `@theme`:
  elevation surfaces, hairline colors, accent roles, **motion duration/easing tokens**.
  Refines existing tokens; does not rip them out.
- `src/design/motion.ts` — named springs (`snappy`, `smooth`, `bouncy`) + reusable
  Motion variants (`fadeUp`, `pressScale`, `sheet`, `listStagger`). One place to tune feel.
- `src/utils/haptics.ts` (exists) — extend into the **central haptic map**: every
  interaction maps to a feedback (`select|light|medium|success|error`). Already
  native on iOS via Capacitor, web fallback. No new code paths elsewhere.
- `prefers-reduced-motion` honored centrally in `motion.ts` (variants degrade to fades).

## 4. Primitives to build (`src/components/ui/`)

Each is small, single-purpose, independently testable.

| Component | Purpose | Behavior |
|---|---|---|
| `Pressable` | Universal tap wrapper | scale-on-press + haptic (`select`); replaces ad-hoc `active:scale-95` |
| `Sheet` | Bottom sheet | drag-to-dismiss, detents, spring + haptic on snap; for filters, profile/chat actions |
| `TabBar` | Bottom nav | spring active indicator + haptic + safe-area; restyles current `BottomNav` |
| `PullToRefresh` | Feed refresh | elastic pull, haptic at threshold; wraps Discover/Messages |
| `PageTransition` | Route transitions | `AnimatePresence` shared-element/sheet; reduced-motion aware |
| `Skeleton` | Loading | shimmer placeholders |
| `Toast` | Inline feedback | transient, non-blocking |
| `MatchCelebration` | Reward moment | halo/confetti + `success` haptic (+ optional sound) |

## 5. Hero screens (apply the system)

- **Discover (`SwipeScreen`)** — deck with next-card peek (scale+translate); **velocity
  swipe** (follows finger, rotation/parallax, rubber-band at edges, throw-by-velocity not
  a hard threshold); LIKE/NOPE/SUPER overlays scale with drag distance; mapped haptics
  (light=pass, medium=like, success=match); match → `MatchCelebration` → smooth transition
  to chat. Rewind preserved.
- **Chat / Messages (`ChatScreen` + `MessagesScreen`)** — skeletons on load; presence pulse
  + typing dots (already realtime-wired); message send spring + haptic; `Sheet` for
  block/report/translate; `PullToRefresh` on the conversation list. Keeps live translation.
- **Profile (`ProfileScreen` + `EditProfileScreen`)** — iOS collapsing large-title on
  scroll; photo gallery with parallax; `Sheet` for edit; haptic toggles.

## 6. Cross-cutting

- **Accessibility:** `prefers-reduced-motion` disables large animations (keep essential
  feedback); Dynamic Type via the fluid scale; touch targets ≥ 44px (`--touch-target`).
- **Performance (60fps):** animate only `transform`/`opacity`; targeted `will-change`;
  no layout reflow during the swipe; lazy-mount heavy overlays.
- **Sound:** optional micro-cues (match/superlike), **OFF by default**, user-toggleable;
  no audio dependency when off.

## 7. Out of scope (follow-up passes)

- The other ~18 screens (Boost, Likes, Onboarding, Login, Settings, etc.) — rolled out
  after the foundation lands.
- Full rebrand / new color palette (we refine, not replace, the identity).
- Native push (APNs/FCM), call UI, AI moderation — tracked separately.

## 8. Success criteria

- A documented design-system layer (`src/design/`) other screens can adopt.
- The 3 hero screens visibly feel native: gesture physics, mapped haptics, fluid
  transitions, reward moments, liveliness.
- 60fps on a mid-range phone; reduced-motion respected; no new heavy dependency.
- `npm run build` + `npm run lint` green.

## 9. Sequencing

1. Foundation: `tokens.css`, `motion.ts`, haptic map. 2. Primitives (`Pressable`,
`Sheet`, `TabBar`, `PullToRefresh`, `PageTransition`, `Skeleton`, `Toast`,
`MatchCelebration`). 3. Discover. 4. Chat/Messages. 5. Profile. 6. Verify (build/lint),
then plan the rollout to remaining screens.
