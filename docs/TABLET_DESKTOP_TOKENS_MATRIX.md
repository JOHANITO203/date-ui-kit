# Tablet & Desktop Token Matrix

Base de calcul: progression continue depuis les locks mobiles (`320x560` + matrices `360/390/412/430`) vers tablette et desktop.

## Breakpoints utilises
- Tablet: `min-width: 48rem`
- Desktop: `min-width: 64rem`
- Desktop large: `min-width: 80rem`
- Wide: `min-width: 90rem`

## Discover

| Tier | Card H | Name Size | Title Size | Overlay Top | Actions | Compat |
|---|---:|---:|---:|---:|---:|---:|
| Tablet 48+ | `min(72dvh,33rem)` | `1.5rem` | `2.1rem` | `8.75rem` | `3.75/3.35rem` | `3.7rem` |
| Desktop 64+ | `min(74dvh,36rem)` | `2.6rem` | `2.2rem` | `9.25rem` | `4/3.5rem` | `3.9rem` |
| Large 80+ | `min(76dvh,38rem)` | `2.8rem` | `2.3rem` | `9.6rem` | stable | stable |
| Wide 90+ | `min(77dvh,40rem)` | `2.95rem` | stable | `9.9rem` | stable | stable |

## Messages

| Tier | Title | Match Avatar | Conv Avatar | Conv Card Pad | Conv Name |
|---|---:|---:|---:|---:|---:|
| Tablet 48+ | `2.45rem` | `4rem` | `3.4rem` | `0.9rem` | `1.12rem` |
| Desktop 64+ | `2.6rem` | `4.2rem` | `3.6rem` | `1rem` | `1.16rem` |
| Large 80+ | `2.75rem` | `4.4rem` | `3.8rem` | stable | stable |
| Wide 90+ | `2.9rem` | stable | stable | stable | stable |

## Boost

| Tier | Page Y | Hero Pad | Icon Box | Title | Desc | CTA H |
|---|---:|---:|---:|---:|---:|---:|
| Tablet 48+ | `1.6rem` | `1.25rem` | `4.5rem` | `2.55rem` | `0.98rem` | `3.2rem` |
| Desktop 64+ | `1.8rem` | `1.4rem` | `4.85rem` | `2.75rem` | `1.02rem` | `3.35rem` |
| Large 80+ | stable | stable | stable | `2.9rem` | `1.05rem` | `3.5rem` |
| Wide 90+ | stable | stable | stable | `3rem` | stable | stable |

## Notes d'integration
- Les tokens sont integres dans `src/index.css` directement dans les media queries `48/64/80/90`.
- Les pages non touchees composant-par-composant continuent d'heritier des tokens globaux.
- `Profile` reste preserve structurellement (pas de refonte).
