# SOURCE OF TRUTH — ALGORITHME

Date de verrouillage initiale: 2026-03-30  
Derniere mise a jour: 2026-04-08

Contexte actuel: moteur de ranking principal cote `discover-service`, avec ajustements onboarding pris en compte.

## 1) Feed ranking (REALITE ACTUELLE)
Source of truth code: `backend/services/discover-service/src/server.ts`

### 1.1 Score de base
- Base `rankScore` provient de la seed candidate (`feedSeed`).
- Le score final = `rankScore + delta`.
- `delta` est la somme des deltas onboarding + preferences:
  - `intentDelta`
  - `interestDelta`
  - `launchCityDelta`
  - `nationalityDelta`
  - `languageDelta`

### 1.2 Calibration active (v1)
- `intentDelta`
  - `serieuse`: `+2` (verified), `+1` (compat >= 90)
  - `connexion`: `+2` (online), `+1` (distance <= 8km)
  - `decouverte`: `+1` (>=2 langues), `+1` (distance 3..25km)
- `interestDelta`
  - overlap 1: `+2`
  - overlap 2: `+3`
  - overlap >=3: `+4`
- `launchCityDelta`
  - meme ville de lancement: `+5`
- `nationalityDelta`
  - pair cross russe/non-russe: `+12`
  - nationalites differentes hors pair russe/non-russe: `+7`
  - identique: `0`
- `languageDelta`
  - diversite linguistique priorisee, plafond `+10`
  - sans langues user: `+3` si candidat >=2 langues
  - sinon combine overlap + diversite

### 1.3 Effet produit verrouille
- La qualite du feed est explicitement influencee par les choix onboarding:
  - etape 4: langues + ville de lancement + nationalite
  - etapes 7/8: intentions + preferences (impact progressif)
  - etape 9: cible de traduction (impact UX chat immediat, pas un boost direct de ranking brut)
- Objectif de circulation: augmenter la rencontre inter-nationalites, en particulier russe <-> non-russe, sans casser la pertinence locale.

### 1.4 Filtrage et tri
- Filtres rapides appliques avant tri (`all`, `nearby`, `new`, `online`, `verified`).
- Tri final descendant sur `rankScore`.
- `scoreReason` enrichi avec suffixes (`intent_*`, `interest_match`, `launch_city_match`, `nationality_diversity`, `language_diversity`).

## 2) Match probabiliste (REALITE ACTUELLE)
- Endpoint swipe deterministe via seed/hash (`stableScore`) pour `like/dislike`.
- `superlike` n'est plus dans ce pipeline:
  - route dediee `POST /discover/superlike/send`,
  - envoi direct de message,
  - aucune dependance a un match.

## 3) Guardrails metier (VERROUILLES)
- Premium accelere la visibilite mais ne doit pas ecraser la qualite.
- Diversite + securite restent prioritaires.
- Les boosts onboarding doivent rester calibrables et versionnables.

## 4) Propositions next-step (NON ENFORCEES)
Les points ci-dessous sont des propositions, pas encore des regles actives:

1. Versionner officiellement la calibration (`algo_ranking_v1`, puis v2...).

## 5) Verification runtime active (2026-04-08)
- Script de non-regression actif dans `discover-service`:
  - `npm run check:ranking`
  - Scenarios A/B/C verifies:
    - priorite locale (launch city),
    - circulation cross-nationalite (sans ecraser totalement le local),
    - cap language diversity (`+10` max).
- Monitoring minimal actif:
  - endpoint `GET /discover/metrics/ranking`
  - expose distribution `scoreReason`, ratio local/non-local, ratio same/cross nationalite sur top-N.
