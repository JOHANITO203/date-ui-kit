# Discover Mobile Scaling Matrix

Objectif: agrandir `Discover` a partir de la base `320x560` sans changer la logique de positionnement (nom/age a gauche, badge en haut droite, actions dans la carte).

## Largeur cible (preset principal)

| Cible | Query | Card H | Identity Top | Overlay Top | Name Size | Compat Ring |
|---|---|---:|---:|---:|---:|---:|
| 360px | `22.5rem -> 24.374rem` | `min(66dvh, 25rem)` | `4.5rem` | `5.35rem` | `2.25rem` | `3.4rem` |
| 390px | `24.375rem -> 25.749rem` | `min(67dvh, 26rem)` | `4.65rem` | `5.5rem` | `2.35rem` | `3.5rem` |
| 412px | `25.75rem -> 26.874rem` | `min(68dvh, 27rem)` | `4.9rem` | `5.75rem` | `2.45rem` | `3.65rem` |
| 430px | `26.875rem -> 29.9375rem` | `min(69dvh, 28rem)` | `5.1rem` | `6rem` | `2.55rem` | `3.8rem` |

## Hauteur cible (adjustment secondaire)

| Range | Query | Card H | Identity Top | Overlay Top | Notes |
|---|---|---:|---:|---:|---|
| 568-640px | `35.5rem -> 40rem` | `min(63dvh, 24.75rem)` | `4.15rem` | `5.15rem` | cas critique, actions toujours visibles |
| 740-844px | `46.25rem -> 52.75rem` | `min(70dvh, 29rem)` | `5.2rem` | `6.1rem` | standard actuel |
| 900px+ | `>=56.25rem` | `min(72dvh, 31rem)` | `5.6rem` | `6.5rem` | grands ecrans |

## Actions mobile (forme)

- Boutons lateraux: rectangle arrondi
  - `--discover-action-mobile-w`
  - `--discover-action-mobile-h`
  - `--discover-action-mobile-radius`
- Bouton central: rectangle arrondi principal
  - `--discover-action-mobile-main-w`
  - `--discover-action-mobile-main-h`
  - `--discover-action-mobile-main-radius`

## Fichiers relies

- `src/index.css`
- `src/components/SwipeScreen.tsx`
- `docs/MOBILE_BASE_TOKENS_320x560.md`

