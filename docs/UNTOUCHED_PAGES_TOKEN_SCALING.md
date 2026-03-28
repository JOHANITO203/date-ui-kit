# Cahier - Pages Non Modifiees (Scaling par Tokens Existants)

Ce cahier note les pages que nous n'avons pas refactorisees composant par composant, mais qui beneficient maintenant d'un scaling multi-resolution via les tokens globaux.

## Pages concernees
- `Likes`
- `Chat`
- `Profile` (conserve tel quel)
- `Splash / Entry`
- `Onboarding`
- `Login` + `Login methods`
- `Settings` + sous-sections
- `Edit profile`

## Principe
On ne touche pas leur structure UI.
On scale via tokens globaux deja consommes par ces ecrans:
- `--page-x`
- `--section-gap`
- `--card-gap`
- `--grid-gap`
- `--card-radius`
- `--cta-height`
- `--content-safe-extra`

## Scaling largeur applique (mobile 360/390/412/430)

| Cible | Query | page-x | section-gap | card-radius | cta-height |
|---|---|---:|---:|---:|---:|
| 360px | `22.5rem -> 24.374rem` | `0.95rem` | `1.35rem` | `1.2rem` | `3rem` |
| 390px | `24.375rem -> 25.749rem` | `1rem` | `1.45rem` | `1.25rem` | `3.05rem` |
| 412px | `25.75rem -> 26.874rem` | `1.05rem` | `1.5rem` | `1.3rem` | `3.1rem` |
| 430px | `26.875rem -> 29.9375rem` | `1.125rem` | `1.6rem` | `1.35rem` | `3.2rem` |

## Scaling hauteur applique (mobile)

| Range | Query | section-gap | cta-height | objectif |
|---|---|---:|---:|---|
| 568-640px | `35.5rem -> 40rem` | `1.25rem` | `2.95rem` | compacter sans casser la lisibilite |
| 740-844px | `46.25rem -> 52.75rem` | `1.6rem` | `3.1rem` | equilibre standard |
| 900px+ | `>=56.25rem` | `1.8rem` | `3.2rem` | respiration grands ecrans |

## Notes
- `Profile` est explicitement preserve (pas de refonte structurelle).
- Les pages ci-dessus suivent la meme logique responsive sans nouvelles regressions de layout.
- Les ecrans deja traites (`Discover`, `Messages`, `Boost`) gardent leurs tokens specifiques en plus de ce scaling global.

