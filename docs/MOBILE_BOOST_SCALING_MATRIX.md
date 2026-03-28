# Boost Mobile Scaling Matrix

Base: `320x560` verrouillee dans `docs/MOBILE_BOOST_BASE_TOKENS_320x560.md`.
Objectif: agrandir `Boost` sans casser la structure mobile validee.

## Width presets

| Cible | Query | Page Y | Hero Pad | Icon Box | Title | Desc | CTA H |
|---|---|---:|---:|---:|---:|---:|---:|
| 360px | `22.5rem -> 24.374rem` | `1.1rem` | `0.95rem` | `3.75rem` | `2.1rem` | `0.86rem` | `2.65rem` |
| 390px | `24.375rem -> 25.749rem` | `1.2rem` | `1rem` | `3.95rem` | `2.2rem` | `0.88rem` | `2.75rem` |
| 412px | `25.75rem -> 26.874rem` | `1.3rem` | `1.05rem` | `4.1rem` | `2.3rem` | `0.9rem` | `2.85rem` |
| 430px | `26.875rem -> 29.9375rem` | `1.4rem` | `1.125rem` | `4.25rem` | `2.4rem` | `0.92rem` | `2.95rem` |

## Height bands

| Range | Query | Page Y | Section Gap | Hero Pad | Title | Desc | CTA H |
|---|---|---:|---:|---:|---:|---:|---:|
| 568-640px | `35.5rem -> 40rem` | `1rem` | `0.85rem` | `0.9rem` | `2.05rem` | `0.84rem` | `2.6rem` |
| 740-844px | `46.25rem -> 52.75rem` | `1.35rem` | `1.05rem` | `1.08rem` | `2.3rem` | `0.9rem` | `2.85rem` |
| 900px+ | `>=56.25rem` | `1.5rem` | `1.2rem` | `1.2rem` | `2.45rem` | `0.95rem` | `3rem` |

## Fichiers relies
- `src/index.css`
- `src/components/BoostScreen.tsx`

