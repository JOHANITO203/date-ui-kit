# SOURCE OF TRUTH — MASTER SPEC VS REALITE ACTUELLE

Date de verrouillage: 2026-03-30
Derniere mise a jour: 2026-04-19
Source normative: Master Spec + decisions produit recentes validees en execution.

## 1) Positionnement produit
- App de dating orientee reduction de la barriere linguistique.
- La traduction chat est un axe central de valeur premium.
- Monetisation encadree: la valeur premium accelere l'experience sans corrompre le matching.

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
- Discover: qualite feed influencee par onboarding (langues, ville de lancement, nationalite, intentions/preferences).
- Likes: deux surfaces produit explicites:
  - `They liked me` (inbound interest, lock/unlock/icebreaker/ghost conserves),
  - `I liked` (outbound interest + conversion SuperLike).
- Messages/Chat: etats relationnels et blocage/unblocage coherents.
- Boost: offres, bundles et terminologie harmonisees.
- Profile: heritage statut + quick actions.
- Settings Privacy: controle sensible + Travel Pass server switch.
- Onboarding: reprise de progression persistante anti-friction.

## 5) Direction produit actuelle (verrouillee)
- Orientation conversion:
  - Likes n'est plus uniquement passif (reception), devient aussi actif (re-engagement sortant).
  - `I liked` sert de memoire d'intention et de surface de conversion vers SuperLike.
- Orientation messaging:
  - SuperLike reste un envoi direct de message (pas un match premium).
  - Le produit privilegie l'ouverture de conversation explicite plutot qu'un detournement du swipe.
- Orientation UX:
  - separation nette inbound/outbound sur Likes pour eviter la confusion des flux.
  - maintien des logiques metier fortes existantes (ghost, lock/unlock, entitlement).

## 6) Inventaire monetisation (verrouille)
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

## 7) Consequences produit anticipees
- Le `TRAVEL PASS` instant n'est plus concurrent du `TRAVEL PASS+`: usage court (24h) vs usage semaine (7 jours).
- Les packs/bundles qui incluent Travel Pass gardent la priorite entitlement (`bundle_included` / `plan_included`) sans regression UX.
- `SHADOWGHOST` devient monetisable en mode temporaire (24h) pour users free/gold/essential; plan `platinum` et `elite` restent inclusifs.
- Nomenclature commerciale unifiee en MAJUSCULE sur les items/packs/bundles modifies.
- Le ranking feed favorise la circulation internationale (notamment russe <-> non-russe) tout en gardant une priorite locale via la ville de lancement.
- Likes split cree un funnel clair:
  - inbound (reception) conserve,
  - outbound (relance) active,
  - conversion SuperLike directe.

## 8) Divergences restantes (a monitorer)
- Validation i18n RU (mojibake historique) a finaliser proprement.
- Certaines zones restent mockees (Edit Profile, achat paiement reel).
- Instrumentation analytics/metriques business encore partielle (runtime local).

## 9) Priorite produit post-lock
1. Finaliser i18n propre (EN/RU parity stricte).
2. Brancher paiement/back-end reels pour entitlements.
3. Industrialiser tests e2e des flux monetisation + onboarding resume.
