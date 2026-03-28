# Mobile Token Sheet - Baseline 320x560

Ce document verrouille les tokens de reference pour le viewport mobile `320x560` (`20rem x 35rem`).
Il sert de base pour le tuning mobile-small sans casser la logique globale responsive.

## Scope
- Ecran cible: `Discover`
- Viewport cible: `width <= 20rem` et `height <= 35rem`
- Source d'implementation: `src/index.css` + `src/components/SwipeScreen.tsx`

## Locked Tokens (320x560)

```css
@media (max-width: 20rem) and (max-height: 35rem) {
  :root {
    --page-x: 0.875rem;

    --discover-header-top: 1rem;
    --discover-card-h: 22.5rem;

    --discover-overlay-pad: 0.875rem;
    --discover-overlay-top: 5rem;
    --discover-identity-top: 2.85rem;

    --discover-name-size: 2.125rem;
    --discover-title-size: 1.75rem;

    --discover-action-gap: 0.7rem;
    --discover-action-mobile-w: 2.65rem;
    --discover-action-mobile-h: 2.1rem;
    --discover-action-mobile-radius: 0.7rem;
    --discover-action-mobile-main-w: 2.85rem;
    --discover-action-mobile-main-h: 2.3rem;
    --discover-action-mobile-main-radius: 0.9rem;

    --discover-verified-size: 1.5rem;
    --discover-compat-size: 3.2rem;
    --discover-compat-value-size: 0.8rem;
    --discover-compat-label-size: 0.38rem;

    --content-safe-extra: 0.25rem;
  }
}
```

## Behavioral Lock
- Nom + age: ancre en haut-gauche via `--discover-identity-top`.
- Badge verifie: ancre a cote du nom, taille fixe via `--discover-verified-size`.
- Ring compatibilite: taille compacte via `--discover-compat-size`.
- Actions mobile: boutons rectangulaires arrondis, hauteur reduite via les tokens `--discover-action-mobile-*`.
- Espace carte/menu bas: controle par `--content-safe-extra` (evite le grand trou noir).

## Implementation Notes
- Les positions sont tokenisees, pas hardcodees.
- Toute evolution mobile-small doit passer par ces tokens avant de toucher les classes.
- Les autres breakpoints gardent leurs tokens globaux existants.
