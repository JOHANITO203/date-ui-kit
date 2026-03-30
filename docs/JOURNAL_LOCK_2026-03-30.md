# JOURNAL DE PROGRESSION (LOCK)

Date de freeze: 2026-03-30

## Phase 1 — Audit et alignement global
- Relecture documentation existante et identification des pages coeur.
- Mise en place d'un workflow page par page (ecran -> donnees -> etats -> logique -> algo -> API -> tests -> prod).

## Phase 2 — Stabilisation technique
- Correction boucle infinie React sur Profile (`Maximum update depth exceeded`).
- Stabilisation garde-fous i18n (detection mojibake / placeholders).

## Phase 3 — Monetisation et badges
- Harmonisation badges vendus: `premium`, `platinum`, `premium_plus`.
- Distinction claire `verified` vs premium status.
- Retrait des badges time pass sur Discover/Messages/Chat (conservation contexte Profile).
- Reintroduction et alignement bundles: Starter, Dating Pro, Premium+.

## Phase 4 — Messages / Chat / Discover UX states
- Etats conversation: active, blocked_by_me, blocked_me, unmatched.
- Blocage/deblocage visible en liste + chat.
- Optimisation layout Messages: nom/badges/heure robustes et responsive.
- Bouton Boost Discover avec etats actifs/epuises et logique de redirection achat.

## Phase 5 — Travel Pass rule set
- Ajout option changement serveur dans Privacy.
- Ajout action rapide changement serveur dans Profile.
- Introduction entitlement source-based:
  - `plan_included`
  - `travel_pass`
  - `bundle_included`
  - `none`
- Anticipation des cas business: user free eligible via bundle incluant Travel Pass.

## Phase 6 — Onboarding anti-regression
- Sauvegarde discrète progression onboarding (step + form) en local.
- Reprise automatique au bon step.
- Nettoyage draft en fin onboarding.
- Retour depuis Improve Profile vers onboarding sans reset destructif.

## Phase 7 — Documentation lock
- Creation des sources de verite canoniques (design/spec/data/states/business/algo).
- Creation des dettes par domaine.
- Preparation suppression des anciens docs intermediaires pour eviter confusion.
