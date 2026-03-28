# Mobile Token Sheet - Messages Baseline 320x560

Tokens verrouilles pour l'ecran `Messages` sur viewport `320x560` (`20rem x 35rem`).

## Scope
- Ecran: `Messages`
- Baseline: `@media (max-width: 20rem) and (max-height: 35rem)`
- Fichiers relies:
  - `src/index.css`
  - `src/components/MessagesScreen.tsx`

## Locked Tokens (320x560)

```css
--messages-header-top: 0.85rem;
--messages-header-gap: 0.95rem;
--messages-title-size: 2rem;
--messages-settings-pad: 0.42rem;

--messages-matches-section-gap: 1.1rem;
--messages-matches-gap: 0.65rem;
--messages-match-avatar: 3.2rem;

--messages-conv-gap: 0.45rem;
--messages-conv-bottom-pad: 0.25rem;
--messages-conv-card-gap: 0.65rem;
--messages-conv-card-pad: 0.65rem;
--messages-conv-card-radius: 1.25rem;
--messages-conv-avatar: 2.75rem;
--messages-conv-avatar-radius: 0.85rem;
--messages-conv-name-size: 0.95rem;
--messages-conv-preview-size: 0.64rem;
```

## Behavioral Lock
- Header compact pour liberer de la hauteur utile.
- Matchs plus compacts pour eviter la coupe agressive.
- Cartes conversation denses et lisibles.
- Pas de double reserve bas (`pb-nav` retire dans `MessagesScreen`, AppShell garde le `content-safe`).

