# SOURCE OF TRUTH — MASTER SPEC VS REALITE ACTUELLE

Date de verrouillage: 2026-03-30
Source normative: Master Spec + decisions produit recentes validees en execution.

## 1) Positionnement produit
- App de dating orientee reduction de la barriere linguistique.
- La traduction chat est un axe central de valeur premium.
- Monétisation encadree: la valeur premium accelere l'experience sans corrompre le matching.

## 2) Badges / statuts (verrouilles)
### Verrouille
- `verified` (KYC, non vendable)
- `premium`
- `platinum`
- `premium_plus`

### Regles verrouillees
- Tout user payant non free porte au minimum `premium`.
- `platinum` et `premium_plus` surclassent `premium`.
- Time pass/travel pass n'ajoutent pas de badge sur Discover/Messages/Chat.
- Time pass/travel pass peuvent etre visibles en contexte Profile/avantages.

## 3) Travel Pass
### Verrouille
- Pass utilitaire (pas badge).
- Changement de serveur disponible:
  - dans `Profile` (action rapide),
  - dans `Settings > Privacy`.

### Regle d'eligibilite verrouillee
- Autorise si:
  - plan incluant l'avantage (`platinum`, `elite`),
  - ou pass Travel actif,
  - ou bundle actif incluant Travel Pass.

## 4) Pages coeur alignees
- Discover: boost stateful + gate tokens.
- Messages/Chat: etats relationnels et blocage/unblocage coherents.
- Boost: offres, bundles et terminologie harmonisees.
- Profile: heritage statut + quick actions.
- Settings Privacy: controle sensible + Travel Pass server switch.
- Onboarding: reprise de progression persistante anti-friction.

## 5) Inventaire monetisation (verrouille)
- Instant items:
  - `BOOST`
  - `ICEBREAKER`
  - `TRAVEL PASS` (24h uniquement)
  - `SUPERLIKE`
  - `REWIND (X10)`
  - `SHADOWGHOST` (24h)
- Time packs:
  - `DAY PASS`
  - `WEEK PASS`
  - `MONTH PASS`
  - `TRAVEL PASS+` (7 jours)
- Bundles:
  - `STARTER`
  - `DATING PRO`
  - `PREMIUM+`

## 6) Consequences produit anticipees
- Le `TRAVEL PASS` instant n'est plus concurrent du `TRAVEL PASS+`: usage court (24h) vs usage semaine (7 jours).
- Les packs/bundles qui incluent Travel Pass gardent la priorite entitlement (`bundle_included` / `plan_included`) sans regression UX.
- `SHADOWGHOST` devient monétisable en mode temporaire (24h) pour users free/gold/essential; plan `platinum` et `elite` restent inclusifs.
- Nomenclature commerciale unifiee en MAJUSCULE sur les items/packs/bundles modifies.

## 7) Divergences restantes (a monitorer)
- Validation i18n RU (mojibake historique) a finaliser proprement.
- Certaines zones restent mockees (Edit Profile, achat paiement reel).
- Instrumentation analytics/metriques business encore partielle (runtime local).

## 8) Priorite produit post-lock
1. Finaliser i18n propre (EN/RU parity stricte).
2. Brancher paiement/back-end reels pour entitlements.
3. Industrialiser tests e2e des flux monetisation + onboarding resume.
