# SOURCE OF TRUTH — DONNEES

Date de verrouillage: 2026-03-30
Derniere mise a jour: 2026-04-19

## 1) Contrats centraux
Source: `src/contracts/*`

### Common
- `PlanTier`: `free | essential | gold | platinum | elite`
- `ShortPassTier`: `day | week`
- `CityId`: `voronezh | moscow | saint-petersburg | sochi`

### ProfileCard / flags
- `verifiedIdentity`
- `premiumTier`
- `shortPassTier?`
- `hideAge`, `hideDistance`, `shadowGhost`

### Settings
- `UserSettings`:
  - `account`
  - `privacy`
  - `notifications`
  - `preferences`
  - `translation`

### Travel Pass entitlement (actuel)
- `preferences.travelPassCity?`
- `preferences.travelPassEntitlementSource?`: `none | travel_pass | bundle_included`
- `preferences.travelPassEntitlementExpiresAtIso?`
- `SettingsEnvelope.travelPassServerAccess`:
  - `canChangeServer`
  - `source`: `none | travel_pass | bundle_included | plan_included`
  - `expiresAtIso?`

### ShadowGhost entitlement (actuel)
- `preferences.shadowGhostEntitlementSource?`: `none | shadowghost_item`
- `preferences.shadowGhostEntitlementExpiresAtIso?`
- `privacy.shadowGhost` est force a `false` si entitlement invalide/expire.

### Likes contracts (inbound + outbound)
- Inbound:
  - `GetReceivedLikesResponse`
  - `ReceivedLike`
  - `UseIceBreakerResponse`
- Outbound:
  - `GetSentLikesResponse`
  - `SentLike`
  - `SentLikeStatus = pending | matched | passed`

## 2) Runtime state (local)
Source: `src/state/appRuntimeStore.ts`

- `planTier`
- `balances` (superlikes/boosts/rewinds/icebreakers)
- `boost.activeUntilIso`
- `iceBreaker.unlockedLikeIds[]`
- `settings`
- `feedSource`, `dismissedProfileIds`, `likedProfileIds`
- `likes`, `likesUnlocked`
- `conversations`, `messagesByConversation`
- translation toggles par conversation
- `getSentLikes()` fallback runtime pour la surface `I liked`

## 3) Persistence locale
- `exotic.runtime.settings.v1` (settings)
- `exotic.onboarding.draft.v1` (onboarding step+form)

## 4) Regles de qualite data
- Merge partiel robuste (`DeepPartial`) dans `patchSettings`.
- Entitlements derives server-change calcules au moment de l'envelope.
- Pas de hardcode de droits UI sans passer par contrat/derive metier.

## 5) Boutique: definitions / effets
- Catalogue prod: `public.in_app_offers` (servi par `GET /payments/catalog`, mode strict par defaut).
- Catalogue canon versionne: `backend/services/payments-service/src/catalog.ts` (reconciliation/migrations/tests).
- Effets post-achat: `backend/services/payments-service/src/entitlements.ts` (`offer -> entitlement snapshot`).
- Validation anti-produit vide:
  - un produit sans effet metier est considere invalide lors de l'attribution.

## 6) Likes data model (verrouille)
- Table `public.discover_likes`: source de verite des likes entrants et sortants.
  - cles directionnelles: `liker_user_id`, `liked_user_id`
  - `status`: `pending | matched | passed`
  - `was_superlike`, `hidden_by_shadowghost`
- Table `public.discover_like_unlocks`: unlock ponctuel IceBreaker par `(user_id, like_id)`.
- Entitlement stock: `user_entitlements.entitlement_snapshot.balancesDelta.icebreakersLeft`.

## 7) Endpoints Likes (verrouilles)
- Inbound:
  - `GET /discover/likes/incoming`
  - `POST /discover/likes/:likeId/decision`
  - `POST /discover/likes/:likeId/icebreaker/use`
- Outbound:
  - `GET /discover/likes/outgoing?status=pending|matched|passed|all`
- SuperLike direct:
  - `POST /discover/superlike/send`
  - effet data attendu: upsert/merge `discover_likes.was_superlike=true` sur la ligne outbound concernee.

## 8) Mapping abonnements (page-level)
- Source unique frontend: `src/domain/subscriptionBenefits.ts`.
- Source auditable backend: `backend/services/payments-service/src/entitlements.ts` via `resolveEffectiveBenefitsSnapshot` retourne dans `GET /entitlements/me`.
- Ce mapping pilote les deriveurs/transitions UI suivants:
  - Discover: acces filtres avances.
  - Profile: acces toggles privacy age/distance.
  - Messages/Chat: presence online + traduction.
  - Likes unlock abonnement: via `likes_identity_unlocked` (consomme dans runtime/discover).
