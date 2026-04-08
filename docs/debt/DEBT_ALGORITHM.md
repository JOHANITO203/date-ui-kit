# DETTE — ALGORITHME

Date initiale: 2026-03-30
Maj: 2026-04-08

Etat actuel:
- Le scoring principal feed est deja cote `discover-service` avec deltas onboarding (intent, interests, launch city, nationality, languages).
- Calibration v1 active documentee dans `docs/sources_of_truth/SOT_ALGORITHM.md`.

Reste a faire:
- Ajouter tests de non-regression ranking (ordre, plafond des boosts, scenarios diversite et localite).
- Ajouter metriques d'observabilite ranking (distribution `scoreReason`, ratio local vs cross-nationalite, impact deltas onboarding top-N).
- Versionner explicitement la calibration en runtime (`algo_ranking_v1`) et preparer un chemin v2.
