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

### SuperLike (SOT verrouillee)
- SuperLike est un message direct depuis Discover, pas un match premium.
- Flow officiel:
  1. ouverture d'un composer depuis Discover,
  2. envoi direct du message au destinataire,
  3. consommation unitaire `1 SuperLike`,
  4. confirmation courte UI: `SuperLike sent.`.
- Pipeline backend dedie:
  - `POST /discover/superlike/send`
  - decouple de `/discover/swipe`
  - aucune dependance a `matched` / scoring / reciprocite.
- Like conserve son flow propre:
  - tentative d'ouverture via `like/pass/swipe/match`.

## 6) Onboarding
- Resume automatique du parcours en cas d'interruption.
- Retour depuis Edit Profile depuis onboarding ne doit pas reset le parcours.
- Fin onboarding nettoie le brouillon.

## 7) I18n
- Fallback EN si cle manquante.
- Validation placeholder/mojibake en dev.

## 8) Likes -> Match -> Chat
- Un `like` entrant doit d'abord vivre dans la source de verite `discover_likes`.
- La page Likes lit les `incoming likes` du destinataire (pas les conversations chat).
- Actions autorisees sur un like entrant:
  - `like_back`: cree un match bilateral et ouvre/alimente la conversation match des deux cotes.
  - `pass`: refuse le like (pas de match).
- `ShadowGhost`:
  - si l'expediteur a un ShadowGhost actif, l'identite reste masquee.
  - un indicateur ghost est visible sur Likes et Messages/Chat.
- Etat premium/lock:
  - user `free` sans mecanisme de deblocage actif conserve l'affichage floute des profils entrants.
- Hierarchie officielle de visibilite Likes:
  1. exception `ShadowGhost`,
  2. entitlement abonnement (unlock permanent),
  3. unlock ponctuel par IceBreaker,
  4. lock free par defaut.

## 9) Items / inventaire / consommation
- Source de verite item: `user_entitlements.entitlement_snapshot` + `in_app_offers`.
- Achat item:
  - un checkout `paid` attribue l'entitlement et retourne un feedback de succes.
  - l'inventaire frontend est mis a jour immediatement (sans attendre un refresh manuel).
- Inventaire Profile:
  - la carte plan affiche les items possedes avec compteur exact (superlikes, boosts, rewinds, icebreakers).
- Visibilite par page:
  - Likes: IceBreaker est l'item utilitaire principal expose en haut a droite.
  - Discover: Boost/Rewind restent sur le deck, SuperLike ouvre un composer de message direct.
- IceBreaker (regle officielle):
  - condition d'usage: stock `icebreakersLeft > 0`, like cible locke, user free.
  - consommation: `1 IceBreaker = 1 like/conversation debloque`.
  - effet: deblocage unitaire persistant via `discover_like_unlocks` (pas de fenetre globale 24h).
  - non-applicable sur une ligne `ShadowGhost` (l'identite reste masquee).
  - etat UI: compteur mis a jour immediatement + like debloque immediatement.
- ShadowGhost et IceBreaker coexistent:
  - IceBreaker debloque la vue des likes caches.
  - ShadowGhost continue de masquer l'identite de l'expediteur quand applicable.

## 10) Boutique / creditation post-achat (verrouille)
- Source de verite boutique:
  - prod: table DB `public.in_app_offers` (source explicite servie par `GET /payments/catalog`)
  - canon versionne: `backend/services/payments-service/src/catalog.ts` (reference de realign + tests)
  - mode urgence uniquement: fallback code active par `PAYMENTS_CATALOG_SOURCE=db_with_emergency_fallback` avec logs explicites
  - mapping effet metier: `backend/services/payments-service/src/entitlements.ts`
- Chaine obligatoire pour tout produit:
  - `product definition -> payment success -> post-purchase validation -> crediting -> persistence -> activation -> UI reflection -> real effect`.
- Regle temporelle critique:
  - les expirations (`planExpiresAtIso`, `travelPass.expiresAtIso`, `shadowGhost.expiresAtIso`) sont calculees au moment de l'attribution (achat valide), jamais au demarrage du service.
- Regle anti-faux-succes:
  - un produit paye sans effet metier explicite est invalide et doit echouer explicitement (pas de succes silencieux).
- Abonnements mensuels:
  - definissent un `planTier` + expiration + avantages quantifiables credites.
  - les acces derives (likes unlock, badges premium, shadow/travel inclus selon plan) restent appliques via les deriveurs metier existants.

## 11) Mapping avantages abonnements par page (verrouille)
- Source frontend unique: `src/domain/subscriptionBenefits.ts`.
- Tier -> benefices:
  - `free`: aucun benefice abonnement.
  - `essential`: `likes_identity_unlocked`, `messages_translation`, `premium_badge`.
  - `gold`: `essential` + `discover_advanced_filters`, `profile_hide_age_distance`.
  - `platinum`: `gold` + `messages_see_online`, `travel_pass_included`, `shadowghost_included`.
  - `elite`: meme couverture fonctionnelle que `platinum` + statut premium superieur.
- Application par page:
  - Discover: filtres avances (hors `all`) conditionnes par `discover_advanced_filters`.
  - Boost: affichage explicite ON/OFF des avantages par tier pour eviter les promesses non branchees.
  - Profile: toggles `hide age/distance` conditionnes par `profile_hide_age_distance`.
  - Messages/Chat: presence online conditionnee par `messages_see_online`, traduction conditionnee par `messages_translation`.
- Audit runtime:
  - `GET /entitlements/me` expose aussi `effectiveBenefits` (flags + mapping par page) pour verifier la propagation serveur -> UI.
