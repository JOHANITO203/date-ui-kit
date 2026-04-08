# SOURCE OF TRUTH — ALGO CALIBRATION V1

Date: 2026-04-08  
Statut: verrouille (current truth) + extensions proposees (non enforcees)

## 1) Poids actifs (current truth)
Source code: `backend/services/discover-service/src/server.ts`

| Signal | Regle active | Delta |
|---|---|---|
| Intent `serieuse` | verified | +2 |
| Intent `serieuse` | compatibility >= 90 | +1 |
| Intent `connexion` | online | +2 |
| Intent `connexion` | distance <= 8km | +1 |
| Intent `decouverte` | candidat >=2 langues | +1 |
| Intent `decouverte` | distance 3..25km | +1 |
| Interests overlap | 1 / 2 / >=3 | +2 / +3 / +4 |
| Launch city | meme ville que onboarding launch city | +5 |
| Nationality | pair russe <-> non-russe | +12 |
| Nationality | nationalites differentes hors pair russe/non-russe | +7 |
| Languages | diversite + overlap (cap) | cap +10 |

## 2) Effet metier attendu
- Qualite feed influencee par les choix onboarding (etapes 4, 7, 8).
- Croissance internationale agressive:
  - forte circulation russe <-> non-russe,
  - diversification linguistique,
  - priorite locale conservee via `launchCity`.

## 3) Garde-fous
- Premium ne doit pas ecraser le ranking de pertinence.
- Pas de boost non borne qui detruit la diversite.
- Les deltas restent interpretable via `scoreReason`.

## 4) Propositions a executer (non enforcees)
1. Non-regression ranking:
   - Scenario A: meme ville + langue commune doit battre profil hors-ville sans signal fort.
   - Scenario B: pair russe/non-russe doit remonter sans ecraser tous les profils locaux.
   - Scenario C: multi-langues doit apporter gain mesurable avec cap respecte.
2. Monitoring minimal:
   - distribution des suffixes `scoreReason`,
   - part top-20 locale vs cross-nationalite,
   - impact moyen des deltas onboarding (intent/interests/city/nationality/languages).
