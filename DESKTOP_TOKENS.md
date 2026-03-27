# Desktop Tokens - SWIPE

This file is the desktop design token reference for the current app.
Primary source of truth: `src/index.css` and `tailwind.config.ts`.

## 1) Breakpoints

Tailwind screens (rem):

- `xs`: `30rem` (480px)
- `sm`: `40rem` (640px)
- `md`: `48rem` (768px)
- `lg`: `64rem` (1024px)
- `xl`: `80rem` (1280px)
- `wide`: `90rem` (1440px)
- `2xl`: `96rem` (1536px)

Business aliases (`:root` docs/hooks):

- `--bp-mobile-small-max: 29.9375rem`
- `--bp-mobile-min: 30rem`
- `--bp-tablet-min: 48rem`
- `--bp-desktop-min: 64rem`
- `--bp-wide-min: 90rem`

## 2) Core Color Tokens

- `--color-premium-start: #FF1493`
- `--color-premium-end: #00BFFF`
- `--color-boost-start: #FF8C00`
- `--color-boost-end: #FFD166`
- `--color-surface: rgba(255, 255, 255, 0.05)`
- `--color-surface-border: rgba(255, 255, 255, 0.1)`
- secondary text utility: `.text-secondary` => `#8E8E93`

Background baseline:

- `body` uses dark radial gradient from `#1c1326` to `#000000`

## 3) Responsive Layout Tokens

Base (`:root`):

- `--page-x: 1rem`
- `--section-gap: 1.5rem`
- `--card-gap: 0.75rem`
- `--grid-gap: 0.75rem`
- `--card-radius: 1.25rem`
- `--icon-size: 1.25rem`
- `--avatar-size: 3.5rem`
- `--cta-height: 3rem`
- `--header-height: 4rem`
- `--bottom-nav-height: 5.25rem`
- `--safe-bottom-offset: calc(var(--bottom-nav-height) + env(safe-area-inset-bottom))`
- `--content-max-width: 40rem`
- `--content-max-width-wide: 75rem`

Tablet (`@media min-width: 48rem`):

- `--page-x: 1.5rem`
- `--section-gap: 2rem`
- `--card-gap: 1rem`
- `--grid-gap: 1rem`
- `--card-radius: 1.5rem`
- `--icon-size: 1.375rem`
- `--avatar-size: 4rem`
- `--cta-height: 3.25rem`
- `--content-max-width: 60rem`

Desktop (`@media min-width: 64rem`):

- `--page-x: 2rem`
- `--section-gap: 2.5rem`
- `--card-gap: 1.25rem`
- `--grid-gap: 1.25rem`
- `--card-radius: 1.75rem`
- `--icon-size: 1.5rem`
- `--avatar-size: 4.5rem`
- `--cta-height: 3.5rem`
- `--content-max-width: 75rem`
- `--content-max-width-wide: 90rem`

## 4) Typography Tokens

- `--text-xs: clamp(0.75rem, 0.72rem + 0.1vw, 0.8rem)`
- `--text-sm: clamp(0.875rem, 0.82rem + 0.15vw, 0.95rem)`
- `--text-base: clamp(1rem, 0.95rem + 0.2vw, 1.1rem)`
- `--text-lg: clamp(1.125rem, 1.05rem + 0.35vw, 1.35rem)`
- `--text-xl: clamp(1.25rem, 1.1rem + 0.6vw, 1.6rem)`
- `--text-2xl: clamp(1.5rem, 1.3rem + 1vw, 2rem)`
- `--text-3xl: clamp(2rem, 1.6rem + 1.5vw, 3rem)`

Component helpers:

- `.fluid-title` => `font-size: var(--text-3xl); line-height: 1.1`
- `.fluid-subtitle` => `font-size: var(--text-lg)`

## 5) Container System

- `.app-container`: full app max width (`var(--content-max-width-wide)`) + horizontal padding (`var(--page-x)`)
- `.container-content`: constrained content (`var(--content-max-width)`)
- `.container-wide`: wide content (`var(--content-max-width-wide)`)
- `.container-narrow`: `max-width: 32rem`
- `.container-split`: 1 column mobile, `20rem + 1fr` at desktop
- `.container-fullscreen`: full width, min-height 100%

## 6) Safe Area / Navigation Utilities

- `.screen-safe`
- `.pb-safe`
- `.pb-nav`
- `.pt-header`
- `.content-safe`

Rule: desktop pages should keep enough bottom/side breathing room even when mobile nav/header utilities are not active.

## 7) Surface / Component Tokens

- `.glass`: `bg-white/5`, `border-white/10`, `backdrop-blur-xl`
- `.gradient-premium`: 135deg premium gradient
- `.gradient-boost`: 135deg boost gradient
- `.surface-card`: shared card padding/radius responsive pattern
- common large radii in desktop UI: `rounded-[28px]`, `rounded-[32px]`, `rounded-[40px]`, `rounded-[48px]`

## 8) Layout Patterns

- `.layout-stack`: vertical flow with `var(--section-gap)`
- `.layout-grid`: 1 col -> 2 cols (`md`) -> 3 cols (`xl`)
- `.layout-autofit`: `repeat(auto-fit, minmax(17.5rem, 1fr))`

## 9) Motion Tokens / Behavior

- soft motion only, no aggressive transitions
- key shared animation: `float`
- `hover-effect` is pointer-aware:
  - coarse pointers: active scale only
  - fine pointers: richer hover state + thin custom scrollbars

## 10) Desktop UX Guardrails

- avoid fixed widths/heights when not required
- avoid mobile-stretched desktop layouts
- keep max-width constrained center content
- keep side panels meaningful (filters, quick actions, context)
- keep glow subtle and reserved for high-priority actions
- use one visual hierarchy: identity -> status -> action -> monetization -> options
