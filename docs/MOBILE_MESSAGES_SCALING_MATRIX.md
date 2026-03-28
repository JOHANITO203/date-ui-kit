# Messages Mobile Scaling Matrix

Base: `320x560` verrouillee dans `docs/MOBILE_MESSAGES_BASE_TOKENS_320x560.md`.
Objectif: agrandir `Messages` sans casser la composition.

## Width presets

| Cible | Query | Title | Match Avatar | Conv Avatar | Conv Name |
|---|---|---:|---:|---:|---:|
| 360px | `22.5rem -> 24.374rem` | `2.2rem` | `3.45rem` | `2.9rem` | `1rem` |
| 390px | `24.375rem -> 25.749rem` | `2.3rem` | `3.6rem` | `3rem` | `1.02rem` |
| 412px | `25.75rem -> 26.874rem` | `2.35rem` | `3.7rem` | `3.1rem` | `1.04rem` |
| 430px | `26.875rem -> 29.9375rem` | `2.45rem` | `3.85rem` | `3.25rem` | `1.07rem` |

## Height bands

| Range | Query | Header Top | Header Gap | Matches Gap | Conv Bottom Pad |
|---|---|---:|---:|---:|---:|
| 568-640px | `35.5rem -> 40rem` | `0.9rem` | `1rem` | `1.2rem` | `0.3rem` |
| 740-844px | `46.25rem -> 52.75rem` | `1rem` | `1.2rem` | `1.4rem` | `0.5rem` |
| 900px+ | `>=56.25rem` | `1.1rem` | `1.35rem` | `1.6rem` | `0.75rem` |

## Fichiers relies
- `src/index.css`
- `src/components/MessagesScreen.tsx`

