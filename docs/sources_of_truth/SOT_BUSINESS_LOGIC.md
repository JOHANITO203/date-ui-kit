# SOURCE OF TRUTH — LOGIQUES METIER

Date de verrouillage: 2026-03-30

## 1) Badges
- `verified` = identite verifiee (non vendable).
- `premium` = tout utilisateur payant ou pass court actif.
- `platinum` / `premium_plus` = niveaux superieurs.
- Time pass badges non affiches dans Discover/Messages/Chat.

## 2) Conversations / blocage
- `blocked_by_me`: je bloque, envoi desactive.
- `blocked_me`: je suis bloque, envoi desactive.
- `unmatched`: conversation fermee.
- Actions block/unblock localisees en liste + chat.

## 3) Travel Pass
- Changement serveur gere par entitlement derive:
  - `plan_included`
  - `travel_pass`
  - `bundle_included`
  - `none`
- Acces expose en Profile + Settings/Privacy.

## 4) Boost / tokens
- Boost consomme a l'activation.
- Rewind/SuperLike consommes a l'usage.
- Absence de token => etat upsell.

## 5) Onboarding
- Resume automatique du parcours en cas d'interruption.
- Retour depuis Edit Profile depuis onboarding ne doit pas reset le parcours.
- Fin onboarding nettoie le brouillon.

## 6) I18n
- Fallback EN si cle manquante.
- Validation placeholder/mojibake en dev.
