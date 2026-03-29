# Workflow Par Écran (Exotic)

## Objectif
Appliquer un cycle unique, strict et reproductible pour **chaque écran** de l’app :

`Écran -> Données -> États -> Logique métier -> Algorithme -> API -> Tests -> Prod`

---

## Pipeline Standard (Obligatoire)

### 1) Écran
- Définir le rôle produit de l’écran (découverte, conversion, conversation, settings, etc.).
- Définir les actions principales utilisateur.
- Définir les KPIs d’écran.

### 2) Données
- Lister les données nécessaires (UI, métier, analytics).
- Identifier la source (local state, API, cache, mock).
- Définir schémas/types et contrat i18n (pas de hardcode).

### 3) États
- Définir tous les états UI :
  - `loading`
  - `empty`
  - `success`
  - `error`
  - `locked/premium` si applicable
- Définir les transitions d’états (entrées/sorties).

### 4) Logique Métier
- Définir les règles métier de l’écran (priorités, restrictions, quotas, permissions).
- Définir les validations (inputs, gating, limites).
- Définir les effets sur le parcours global.

### 5) Algorithme
- Définir le scoring/ranking/priorisation si nécessaire.
- Documenter pondérations, seuils et fallbacks.
- Documenter les règles anti-régression (ne pas casser la cohérence feed/business).

### 6) API
- Définir endpoints requis (lecture/écriture).
- Définir payloads, réponses, erreurs.
- Définir idempotence/retry/timeout et tracking événements.

### 7) Tests
- Unit tests (logique métier + helpers).
- Integration tests (écran + data flow + API mockée).
- UI tests (responsive, i18n EN/RU, accessibilité de base).
- Tests de non-régression visuelle (états critiques).

### 8) Prod
- Feature flag / rollout progressif.
- Monitoring (erreurs, events, conversion).
- Vérification post-release (KPI baseline vs nouveau KPI).
- Plan de rollback documenté.

---

## Écrans Couverts (V1)
- Splash
- Login / Auth rapide
- Onboarding (étapes 1-12)
- Discover / Swipe
- Likes
- Messages
- Chat
- Boost
- Profile
- Settings (Compte, Confidentialité, Notifications, Préférences)

---

## Template À Réutiliser Par Écran

```md
## [Nom de l’écran]
### Écran
- Rôle:
- Actions utilisateur:
- KPI:

### Données
- Inputs:
- Sources:
- Types/contrats:

### États
- loading:
- empty:
- success:
- error:
- premium/locked:

### Logique métier
- Règles:
- Validations:
- Contraintes:

### Algorithme
- Variables:
- Pondérations:
- Seuils:
- Fallback:

### API
- Endpoints:
- Payload:
- Réponse:
- Erreurs:

### Tests
- Unit:
- Integration:
- UI:
- Non-régression:

### Prod
- Flag:
- Monitoring:
- Post-release checks:
- Rollback:
```

---

## Règles Transverses
- Pas de hardcode texte UI (i18n obligatoire EN/RU).
- Pas de régression responsive (mobile/tablette/desktop).
- Respect des tokens design (layout, typo, couleurs, glass, motion).
- Tous les événements analytics critiques doivent être tracés.
- Chaque écran doit être livrable indépendamment (contrats clairs + tests).
