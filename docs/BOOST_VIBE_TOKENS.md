# Boost VIBE Tokens (Locked)

Date: 2026-03-28  
Scope: `src/components/BoostScreen.tsx` + `src/index.css`

## 1) Elements ajoutes/retravailles

- Bloc tiers premium (`Essential / Gold / Platinum`) avec etats:
  - inactif: scale + opacite reduite
  - actif: contraste fort + glow d'arriere-plan
  - click/press: border light + pulse glow court
- CTA global de conversion:
  - `S'ABONNER A <TIER>`
  - glow de base couleur dynamique selon tier actif
- Coherence typographique:
  - label tier, titre italic lourd, prix dominant, periode meta, liste features
- Coherence de surface:
  - glass dark + border fine + blur

---

## 2) Tokens nouveaux (responsive)

Ajoutes dans `:root` de `src/index.css` (avec `clamp()` pour couvrir mobile/tablette/desktop):

- `--boost-tier-card-w`
- `--boost-tier-card-min-h`
- `--boost-tier-card-radius`
- `--boost-tier-inner-radius`
- `--boost-tier-pad`
- `--boost-tier-title-size`
- `--boost-tier-price-size`
- `--boost-tier-period-size`
- `--boost-tier-feature-size`
- `--boost-tier-tag-size`
- `--boost-tier-cta-h`
- `--boost-tier-cta-size`
- `--boost-tier-cta-track`
- `--boost-tier-cta-glow-blur`
- `--boost-tier-cta-glow-h`
- `--boost-tier-cta-glow-offset`
- `--boost-tier-disclaimer-size`
- `--glass-card-bg`
- `--glass-card-bg-soft`
- `--glass-card-border`
- `--glass-card-border-strong`
- `--glass-card-blur`
- `--glass-card-pad`
- `--glass-card-radius-soft`
- `--glow-silver`
- `--glow-gold`
- `--glow-blue`
- `--glow-pink`
- `--glow-orange`
- `--glow-cyan`
- `--glow-alpha-soft`
- `--glow-alpha-medium`
- `--glow-alpha-strong`

## 2.1) Pattern reutilisable "Carte Verre"

Classes communes ajoutees dans `src/index.css`:

- `glass-panel`  
  Verre standard: fond, bordure fine, blur 24px.
- `glass-panel-soft`  
  Version plus legere (etat inactif).
- `glass-panel-active`  
  Bordure renforcee pour etat selectionne.
- `glass-panel-float`  
  Transition uniforme (scale/opacite/border/bg).

Toutes les cartes verre de `BoostScreen` ont ete alignees sur ce pattern.

## 2.2) Token de Glow Reutilisable

Le glow couleur est maintenant pilote par tokens globaux:

- `--glow-silver` (Essential / starter)
- `--glow-gold` (Gold / rythme)
- `--glow-blue` (Platinum / securite)
- `--glow-pink` (Premium / bundles pro / matches)
- `--glow-orange` (Boost flash)
- `--glow-cyan` (Premium+)

Les helper styles de `BoostScreen` reutilisent ce schema pour:

- glow carte active tier
- glow pulse au clic
- glow du CTA principal (selon tier actif)
- glow des cartes produits (instant/passes/bundles)
- glow harmonise des mini-cartes argumentaires
- glow au clic sur toutes les cartes (tiers + produits + packs + bundles + arguments)
- glow au hover sur toutes les cartes produits restantes (hors tiers Essential/Gold/Platinum)

---

## 3) Mapping visuel par tier

Defini dans `tiers[]` (BoostScreen):

- `tagClass` (pill label)
- `bulletClass` (couleur puce)
- `glowToken` (couleur source du glow reutilisable)
- `ctaButtonClass` (gradient du bouton principal hero)

Prix/chiffres:
- rendu en `font-mono` (JetBrains Mono charge localement)
- devise unifiee en `₽` sur tous les items de la page Boost

Descriptions enrichies:
- bundles: ajout de listes a puces colorees (meme logique visuelle que les cartes tiers)
- instant/passes/flash: puces colorees harmonieuses avec variation chromatique

---

## 4) Interaction tokens / comportements

- Tap carte:
  - `whileTap: scale(0.95)`
  - spring reactif (`stiffness` eleve)
  - border highlight temporaire
- Selection carte:
  - switch en `500ms ease-in-out`
  - glow actif persistant
- Click feedback:
  - `glowPulseTier` (pulse court ~260ms) pour confirmer l'action

---

## 5) Coherence multi-resolutions

Strategie retenue:
- dimensions/typo majeures pilotees par tokens `clamp()`
- layout:
  - mobile: carousel horizontal snap
  - tablette/desktop: grille 3 colonnes
- rail desktop:
  - active uniquement sur appareil non tactile (`!isTouch`)
  - visible uniquement dans sa zone d'activation

Cette base garantit une cohesion visuelle sur:
- mobile small/base
- tablette
- desktop intermediaire
- desktop large
