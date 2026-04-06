# Skill: animations

## 1. Purpose
Maintain coherent motion behavior and avoid performance or UX regressions.

## 2. When to use
- Any edit involving `motion` props, animation states, route transitions, or interaction feedback.

## 3. Inputs to inspect before changing code
- target `*Screen.tsx` motion blocks.
- `src/App.tsx` `AnimatePresence` usage.
- related CSS keyframes in `tailwind.config.ts` and `src/index.css`.

## 4. Rules to follow
- Reuse current transition tone (smooth, premium, non-aggressive).
- Keep interaction animations state-driven, not timer-only hacks.
- Avoid introducing heavy continuous animations in dense lists.
- Keep desktop/mobile interaction differences in mind (hover vs touch).

## 5. Existing repository patterns to preserve
- `AnimatePresence mode="wait"` for route-level transitions.
- motion-based hover/tap effects on cards/CTAs.
- tokenized glow/visual language paired with subtle motion.

## 6. Anti-patterns to avoid
- stacking many infinite animations in list items.
- introducing inconsistent easing/duration per nearby elements.
- animation changes that break readability or click targets.

## 7. Regression checklist
- verify interactions on touch and fine pointer.
- verify no layout jump from animated dimensions.
- verify key states (active/blocked/no-token) still readable during motion.

## 8. Definition of done
- motion feels consistent with existing UI language.
- no visual jank or performance drop in affected screens.
