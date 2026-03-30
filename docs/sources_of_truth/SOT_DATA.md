# SOURCE OF TRUTH — DONNEES

Date de verrouillage: 2026-03-30

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

## 2) Runtime state (local)
Source: `src/state/appRuntimeStore.ts`

- `planTier`
- `balances` (superlikes/boosts/rewinds)
- `boost.activeUntilIso`
- `settings`
- `feedSource`, `dismissedProfileIds`, `likedProfileIds`
- `likes`, `likesUnlocked`
- `conversations`, `messagesByConversation`
- translation toggles par conversation

## 3) Persistence locale
- `exotic.runtime.settings.v1` (settings)
- `exotic.onboarding.draft.v1` (onboarding step+form)

## 4) Regles de qualite data
- Merge partiel robuste (`DeepPartial`) dans `patchSettings`.
- Entitlements derives server-change calcules au moment de l'envelope.
- Pas de hardcode de droits UI sans passer par contrat/derive metier.
