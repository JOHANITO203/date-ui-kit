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
- `TRAVEL PASS` instant = 24h.
- `TRAVEL PASS+` time pack = 7 jours.

## 4) ShadowGhost
- Acces derive:
  - `plan_included` (platinum/elite),
  - `shadowghost_item` (24h),
  - `none`.
- Si l'entitlement expire, le mode est force sur `off` (pas d'etat zombie actif).

## 5) Boost / tokens
- Boost consomme a l'activation.
- Rewind/SuperLike consommes a l'usage.
- Absence de token => etat upsell.

## 6) Onboarding
- Resume automatique du parcours en cas d'interruption.
- Retour depuis Edit Profile depuis onboarding ne doit pas reset le parcours.
- Fin onboarding nettoie le brouillon.

## 7) I18n
- Fallback EN si cle manquante.
- Validation placeholder/mojibake en dev.
