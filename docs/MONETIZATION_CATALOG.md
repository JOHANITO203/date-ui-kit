# Monetization Catalog (SWIPE)

Date: 2026-03-28

## 1) Produits Unitaires

- `Boost`  
  Augmente la visibilite du profil pendant une duree definie.

- `Premium`  
  Active un `Premium Status Badge` (Essential/Gold/Platinum/Elite) et les droits associes.
  Le badge `Verified Identity` reste non monnayable (KYC uniquement).

- `SuperLike Token`  
  Permet d'apparaitre en priorite dans les conversations avec message prioritaire.

- `Rewind Token`  
  Permet d'annuler le dernier swipe (inclus en Premium, vendable separement).

---

## 2) Entitlements / Droits Utilisateur

- `premium_active: boolean`
- `premium_status_badge: \"premium\" | \"platinum\" | \"premium_plus\" | null`
- `short_pass_badge: \"day\" | \"week\" | null` (temporaire)
- `verified_identity_badge: boolean` (KYC, non vendable)
- `unlimited_conversations: boolean`
- `boost_active_until: datetime | null`
- `superlike_tokens: number`
- `rewind_tokens: number`

---

## 3) Packs de Jetons

- `SuperLike S` : 5 tokens
- `SuperLike M` : 15 tokens
- `SuperLike L` : 40 tokens

- `Rewind S` : 5 tokens
- `Rewind M` : 20 tokens

- `Mix Pack` : 10 SuperLikes + 10 Rewinds

---

## 4) Packs Temporels

- `Pass Jour (24h)` : no ads + IceBreaker 24h + badge temporaire Day Pass
- `Pass Semaine (7j)` : no ads + IceBreaker + 5 SuperLikes/jour + 2 Boosts total + badge temporaire Week Pass
- `Pass Mois (30j)` : premium complet + quotas inclus
- `Pass Trimestre` / `Annuel` : remises de fidelite
- `Travel Pass` : pass utilitaire geographique (non-badge), 1 ville active max

---

## 5) Bundles Conversion (recommandes)

- `Starter` : 1 Boost + 5 SuperLikes
- `Dating Pro` : 5 Boosts + 20 SuperLikes + 10 Rewinds
- `Premium+` : Premium mensuel + 4 Boosts/mois + dotation mensuelle de tokens

---

## 6) Regles Produit

- Un `Boost` est consomme a l'activation.
- `SuperLike` et `Rewind` sont consommes a l'action.
- `Premium` active `premium_status_badge != null` et `unlimited_conversations = true`.
- Regle UX badge:
  - user `free` => pas de badge premium
  - user payant (`essential`/`gold` + passes courts) => badge `premium`
  - user `platinum` => badge `platinum`
  - user `elite` ou bundle `Premium+` actif => badge `premium_plus`
- `Rewind` est inclus Premium mais reste achetable en jetons.
- Les packs de jetons ne se renouvellent pas automatiquement.
- Les abonnements temporels suivent les regles de renouvellement choisies (auto-renouvellement actif/inactif).

---

## 7) Logique Funnel Cible

`Gratuit -> Premier achat (token/boost) -> Reachat -> Premium -> Premium+`

Objectif:
- reduire la friction du premier achat
- augmenter la frequence d'usage via tokens
- convertir vers revenu recurrent via abonnement
