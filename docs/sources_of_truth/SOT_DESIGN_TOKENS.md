# SOURCE OF TRUTH — DESIGN & TOKENS (CURRENT)

Date de verrouillage: 2026-03-30
Portee: application complete (React + TypeScript + Tailwind + tokens CSS)

## 1) Principes UX verrouilles
- Cohérence visuelle premium sans surcharge.
- Separation claire des badges: `premium`, `platinum`, `premium_plus`, `verified`.
- Badges de time pass non exposes sur Discover/Messages/Chat; visibles sur Profile (et contexte avantages).
- Travel Pass est un pass utilitaire (pas un badge).

## 2) Langage visuel par page
### Discover
- Carte immersive, CTA swipe/boost centraux, etat boost anime (pulse lent) quand actif.
- Token family principale: `--discover-*`.

### Messages
- Liste conversations compacte premium.
- Heure dans un slot fixe, nom/badges contraints pour eviter l'ecrasement.
- Token family principale: `--messages-*`.

### Chat
- Header conversation avec badges d'identite/statut.
- Etats relationnels: active / blocked_by_me / blocked_me / unmatched.

### Boost
- Catalogue segmente: instant / passes / bundles.
- Cartes produit animees avec glow tokenise.

### Profile
- Hub de statut (plan, badges, ressources, privacy).
- Action rapide serveur (Travel Pass) depuis le header + section controle.

### Settings (Privacy)
- Controle principal des options sensibles.
- Changement serveur Travel Pass accessible ici en source de verite UX.

### Onboarding
- Flux multi-etapes avec reprise de progression persistante.

## 3) Tokens de reference (actuels)
Source: `src/index.css`

### Base layout
- `--page-x`, `--section-gap`, `--grid-gap`, `--card-radius`, `--cta-height`
- `--content-max-width`, `--container-*`

### Discover
- `--discover-header-top`
- `--discover-card-h`
- `--discover-overlay-*`
- `--discover-action-*`
- `--discover-compat-*`

### Messages
- `--messages-pane-width-md`, `--messages-pane-width-lg`
- `--messages-page-x`
- `--messages-header-*`
- `--messages-match-*`
- `--messages-conv-*`
- `--messages-zone-*`
- `--messages-selected-*`

### Naming / badges
- `--name-xl`, `--name-lg`, `--name-md`
- `--name-badge-gap`
- `--verified-badge-size`

### Boost
- `--boost-page-y`
- `--boost-tier-*`
- `--boost-cta-h`

### Visual surfaces
- `--glass-card-*`
- `--glow-*`
- `--color-premium-*`, `--color-boost-*`

## 4) Responsive lock
- Mobile small: reference 320x560 explicite.
- Echelles mobiles dediees par largeur/hauteur.
- Tablet/desktop tokens derives en continuite.

## 5) Regles de modification
- Toute evolution visuelle passe d'abord par tokens.
- Pas de hardcode local si un token equivalent existe.
- Toute regression de layout doit etre corrigee sans casser la hierarchie badges/heure/etat.
