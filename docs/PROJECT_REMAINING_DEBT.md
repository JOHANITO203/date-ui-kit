# Dette Restante Pour Boucler Le Frontend

Date: 2026-03-28  
Projet: SWIPE (frontend UI/UX + responsive system)

## 1) Etat actuel (resume rapide)

- Tokens definis: **110 tokens uniques** dans `src/index.css`
- Overrides responsive: **674 declarations**
- Fondation en place:
  - breakpoints et scaling mobile/tablet/desktop
  - containers et templates d'ecran
  - safe areas + bottom nav offsets
  - tokens Discover / Messages / Boost
  - tokens typo + font embedding local Inter

Conclusion: le socle est solide, la dette restante est surtout de **finition systeme** et **durcissement de coherence**.

---

## 2) Dette prioritaire a fermer (Must-have)

### A. Tokens semantiques manquants (etat/interaction)

Objectif: sortir des valeurs hardcodees restantes dans les composants.

- `state-success-*`
- `state-warning-*`
- `state-error-*`
- `state-info-*`
- `interactive-hover-*`
- `interactive-active-*`
- `interactive-focus-*`
- `interactive-disabled-*`

Impact:
- coherence visuelle stricte
- theming plus simple
- moins de regressions

Estimation: **8 a 12 tokens**

### B. Elevation / profondeur / surfaces

Objectif: durcir la hierarchie visuelle et eviter le "tout glass uniforme".

- `shadow-1/2/3`
- `glow-premium`, `glow-boost`
- `border-subtle`, `border-strong`
- `surface-1/2/3`
- `blur-soft`, `blur-strong`

Estimation: **8 a 10 tokens**

### C. Motion system unifie

Objectif: uniformiser animations et feedbacks tactiles.

- `motion-fast`, `motion-base`, `motion-slow`
- `ease-standard`, `ease-emphasized`, `ease-decelerate`
- spring preset (UI interactions)

Estimation: **6 a 8 tokens**

### D. Typographie de production (fine tuning)

Objectif: stabiliser le rendu cross-device de facon stricte.

- `line-title`, `line-body`, `line-meta`
- `tracking-title`, `tracking-section`, `tracking-meta`
- mapping final des weights par role (title/name/body/meta/button)

Estimation: **6 a 8 tokens**

### E. Layers / z-index policy

Objectif: supprimer les conflits overlays/nav/input/rails.

- `z-base`, `z-nav`, `z-sticky`, `z-overlay`, `z-modal`

Estimation: **5 tokens**

---

## 3) Dette technique-couplage (Medium)

### A. Hardcodes couleurs encore presents

Des valeurs `#...` / `rgba(...)` existent encore dans des composants.
Action:
- migrer ces valeurs vers tokens semantiques
- limiter les couleurs inline aux cas exceptionnels

### B. Regles de fallback typo

La police est embarquee, mais il faut documenter:
- fallback policy par OS
- tolérance de variation minime

### C. Normalisation des patterns composants

Verifier que tous les ecrans reutilisent bien:
- container patterns
- density modes
- sections header/content/actions coherentes

---

## 4) Dette UX de validation finale (Pre-release)

### A. Matrice QA responsive finale

Valider systematiquement:
- 320x560
- 360x640
- 390x844
- 412x915
- 430x932
- tablette portrait/paysage
- desktop intermediaire + large

Checks:
- aucun chevauchement
- aucun element critique masque par nav/clavier
- densite lisible et premium

### B. Matrice interaction tactile

Verifier:
- scroll vertical/horizontal par zone
- sliders/rails utilisables sans precision souris
- input + clavier + CTA toujours accessibles

### C. Coherence contenu profile

Pattern unique partout:
- `Prenom, Age`
- badge verifie au meme style
- priorite visuelle stable entre nom / meta / compatibilite / actions

---

## 5) Estimation de cloture

Dette design-system restante pour "boucler proprement":
- **~40 a 45 tokens** (coherent avec l'audit en cours)

Execution recommandee:

1. Ajouter tokens manquants (etat, elevation, motion, typo fine, layers)
2. Migrer hardcodes couleurs vers tokens
3. QA multi-resolution + tactile keyboard/accessibilite
4. Freeze final des tokens (versionnee)

---

## 6) Definition de "Done"

La partie frontend est consideree bouclee si:

- aucun hardcode critique de couleur/layout dans les ecrans principaux
- tokens semantiques complets et documentes
- cross-device stable (mobile/tablette/desktop)
- experience tactile validee
- navigation/input/overlays sans conflit
- guide de tokens final versionne pour maintenance future

---

## 7) Backlog actionnable (ordre de travail)

1. Implementer lot tokens etat/elevation/motion/layers/typo  
2. Refactor hardcodes vers tokens  
3. QA complete et correction regressions  
4. Ecrire document de freeze final (`docs/TOKENS_FINAL_FREEZE.md`)

