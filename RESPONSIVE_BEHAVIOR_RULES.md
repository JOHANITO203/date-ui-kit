# Responsive Behavior Rules - SWIPE

This document defines behavior-driven responsive rules, screen by screen.
It complements tokens in `src/index.css`.

## Global Rules

- Mobile-first always.
- Desktop must not be a stretched mobile layout.
- Use specialized containers, not one universal max-width.
- Use density modes intentionally:
  - `compact`: high information density, short loops.
  - `comfortable`: default app reading/scanning.
  - `immersive`: visual-first, focused interaction.

## Container Mapping

- `Discover`: `container-immersive` + `container-deck`
- `Messages`: split shell + `panel-width-*` + fluid detail area
- `Chat`: `container-chat`
- `Profile`: `container-dashboard`
- `Boost`: `container-commerce`
- `Long-form text/help`: `container-reading`
- `Form-first`: `container-form`

## Density Mapping

- `Discover`: `density-immersive`
- `Messages`: `density-comfortable` (master), `compact` in list rows
- `Chat`: `density-comfortable`
- `Profile`: `density-comfortable` with selective `compact` modules
- `Boost`: `density-comfortable`, compact in pricing cells

## Screen Rules

### Discover

- Mobile: one immersive stack.
- Tablet/Desktop: split layout mandatory.
- Left panel: filters + lightweight activity context.
- Deck width must stay constrained (`container-deck`), never full-width.
- No empty lateral voids are allowed.
- Action bar stays close to deck and must not overlap profile text.

### Messages

- Mobile: list only, chat opens full screen route.
- Tablet/Desktop: master-detail mandatory.
- Master width uses panel tokens (`panel-width-md/lg`).
- Detail view consumes remaining width (`minmax(0, 1fr)`).
- Vertical rail and horizontal matches rail are optional UI affordances, never blockers.

### Chat

- Embedded (desktop): no mobile bottom-nav offset.
- Bubble width capped to preserve readability.
- Input always visible and reachable.
- Keep conversation lane centered (`container-chat`) on wide screens.

### Profile

- Mobile: narrative stack.
- Tablet/Desktop: modular dashboard with clear section hierarchy.
- Sections order stays stable: identity -> premium/status -> stats -> actions.
- Avoid identical visual treatment across all cards; keep priority surfaces stronger.

### Boost

- Mobile: value + CTA quickly visible.
- Tablet/Desktop: commerce layout with clear comparison rhythm.
- Hero must communicate state (inactive/active) + timer when active.
- Packs must be scannable and one recommended option must stand out.

## Visual Hierarchy Hardening Rules

- Do not apply `.glass` to every block.
- Critical cards: stronger surface contrast, cleaner border, less blur.
- Secondary cards: softer contrast.
- Radius follows role first, viewport second.
- Keep glow only for primary actions and key statuses.

## Validation Checklist

- Any desktop screen has a clear visual center.
- Side columns carry useful context (not decorative emptiness).
- No critical content hidden by nav/input overlays.
- Text lines stay readable at tablet and wide desktop.
- Actions remain in natural focus zones.
- Responsive changes alter composition, not only spacing.
