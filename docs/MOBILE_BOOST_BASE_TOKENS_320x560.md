# Mobile Token Sheet - Boost Baseline 320x560

Tokens verrouilles pour l'ecran `Boost` sur viewport `320x560` (`20rem x 35rem`).

## Scope
- Ecran: `Boost`
- Baseline: `@media (max-width: 20rem) and (max-height: 35rem)`
- Fichiers relies:
  - `src/index.css`
  - `src/components/BoostScreen.tsx`

## Locked Tokens (320x560)

```css
--boost-page-y: 1rem;
--boost-mobile-section-gap: 0.8rem;
--boost-hero-pad: 0.875rem;
--boost-hero-icon-box: 3.5rem;
--boost-title-size: 1.95rem;
--boost-desc-size: 0.82rem;
--boost-cta-h: 2.5rem;
```

## Behavioral Lock
- Hero passe en composition verticale sur mobile (icone au-dessus du texte).
- Titre compact et lisible, sans troncature.
- Description raccourcie visuellement par taille de police et largeur utile plus large.
- CTA principal garde une hauteur mobile confortable.
- Espacement bas corrige pour eviter le collage avec la bottom nav.

