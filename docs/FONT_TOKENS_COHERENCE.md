# Font Tokens & Coherence Audit

Date: 2026-03-28

## Detection (etat actuel)

Sources detectees:
- `src/App.css`: font stack global sur `html, body, #root`
- `src/index.css`: `body` utilisait `font-sans` (Tailwind utility)
- `src/components/SwipeScreen.tsx`: classe `font-sans` locale

Conclusion:
- La police cible est un **sans moderne** avec priorite `Inter`.
- Inter n'etait pas chargee explicitement via `@font-face` ou `<link>` dans `index.html`, donc fallback system selon OS.
- Il y avait un risque de legere incoherence entre:
  - stack explicite `App.css`
  - stack `font-sans` Tailwind par defaut

## Harmonisation appliquee

### 1) Token police global
- Ajout dans `src/index.css`:
  - `--font-family-base`
  - `--font-family-display`

Valeur actuelle:
- `"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`

### 2) Base app unifiee
- `src/index.css`:
  - `body` utilise maintenant `font-family: var(--font-family-base);`
  - suppression de la dependance implicite `font-sans` au niveau `body`

### 3) Tailwind aligne
- `tailwind.config.ts`:
  - `theme.extend.fontFamily.sans` aligne sur le meme stack
  - `theme.extend.fontFamily.display` aligne aussi

### 4) Legacy CSS aligne
- `src/App.css`:
  - `html, body, #root` utilisent aussi `var(--font-family-base, fallback...)`

### 5) Font embedding local (repo)
- Dependance ajoutee:
  - `@fontsource/inter` dans `package.json`
  - `@fontsource/jetbrains-mono` dans `package.json`
- Chargement explicite dans `src/main.tsx`:
  - poids: `400, 500, 600, 700, 800, 900` + `italic`
  - subsets: `latin` (par defaut package), `cyrillic`, `cyrillic-ext`
  - JetBrains Mono: poids `500` et `700`

Objectif:
- eliminer la variabilite de rendu liee aux polices systeme
- garantir un affichage stable pour les textes FR/EN + contenus cyrilliques
- garantir une hierarchie editoriale: Inter (titres) + JetBrains Mono (prix/chiffres)

## Coherence verifiee

- Base globale: coherente (token unique)
- Classes Tailwind `font-sans`: coherentes avec la base
- Pas de police serif/mono imposee localement
- Pas de seconde famille concurrente

## Statut

Le rendu typographique est maintenant **embarque localement** et beaucoup plus deterministic cross-device.
Le fallback system reste present uniquement en secours.
