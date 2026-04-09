# DEBT / MVP STATUS — 2026-04-08

## Executive summary

- Progression globale:
  - MVP fonctionnel (local/dev): ~88-90%
  - MVP prêt release (staging/prod-like): ~75-80%
- Écart principal restant:
  - validation release (staging + E2E + observabilité),
  - pas la construction des features coeur.

## Ce qui a été sécurisé récemment

- Unification `user_id` en `uuid` sur les tables service critiques.
- Rétablissement et vérification des FKs vers `auth.users(id)`.
- Corrections responsive ciblées, dont verrouillage "rails desktop uniquement" sur les écrans concernés.
- Corrections i18n/encodage sur plusieurs écrans critiques.

## Dette haute (release blockers)

- Credentials prod finaux à verrouiller:
  - Supabase
  - Google OAuth (domaines finaux)
  - YooKassa
- Validation réelle des migrations/RLS/grants en environnement cible release.
- E2E critiques manquants:
  - auth flow
  - onboarding completion
- Boucle staging incomplète:
  - déploiement staging,
  - parcours réel complet,
  - triage + closure final.
- Observabilité:
  - Sentry frontend/backend non branché.
- Vérification UI finale:
  - block/report/unblock sur tous les edge states Messages/Chat.

## Dette moyenne

- Normalisation docs legacy avec dérives d'encodage (mojibake résiduel).
- Durcissement de certaines machines d'états implicites (flux spécifiques).

## Dette mineure

- Polish visuel résiduel sur quelques cas responsive legacy.
- Presence chat (reporté, non bloquant MVP).

## Priorité d'exécution recommandée

1. Clore E2E critiques (auth + onboarding).
2. Exécuter boucle staging complète et corriger bloquants.
3. Brancher Sentry frontend/backend.
4. Fermer la vérification UI finale block/report Chat/Messages.
5. Finaliser go/no-go release checklist.
