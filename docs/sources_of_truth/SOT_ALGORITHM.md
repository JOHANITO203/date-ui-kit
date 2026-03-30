# SOURCE OF TRUTH — ALGORITHME

Date de verrouillage: 2026-03-30
Contexte: runtime local (simulation), non moteur prod distribue.

## 1) Feed ranking (simulation actuelle)
Source: `src/state/appRuntimeStore.ts`

- Base `rankScore` = `compatibility` + bonus online + bonus verified.
- Filtres rapides appliques avant tri (`all`, `nearby`, `new`, `online`, `verified`).
- Tri final descendant par `rankScore`.
- `scoreReason` derive (high compatibility / verified / online / balanced).

## 2) Match probabiliste deterministe (mock)
- Seed deterministic via hash du profile id.
- SuperLike augmente la probabilite de match vs like normal.

## 3) Guardrails metier a respecter
- Premium accelere, ne doit pas detruire la qualite matching.
- Diversite et securite doivent rester prioritaires sur la pure monetisation.

## 4) Etat reel vs cible
### Reel
- Algo local simplifie, deterministic mock.

### Cible
- Orchestration server-side, scoring multi-signaux, contraintes anti-biais, observabilite.

## 5) Prochaine etape algorithmique
1. Externaliser scoring API.
2. Versionner features/signaux.
3. Ajouter tests de non-regression ranking (ordre + fairness + plafond premium).
