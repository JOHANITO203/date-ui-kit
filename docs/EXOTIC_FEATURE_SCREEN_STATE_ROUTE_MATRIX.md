# Exotic V1 - Feature x Ecrans x Etats x Routes

Date: 2026-03-30
Source: `docs/EXOTIC_V1_MASTER_SPEC.md`
Mode: matrice produit cible (design-first), avant data/metier/algo

## 1) Routes de reference

1. `/discover`
2. `/likes`
3. `/messages`
4. `/chat/:userId`
5. `/boost`
6. `/profile`
7. `/profile/edit`
8. `/settings/privacy`
9. `/settings/preferences`
10. `/settings/account`
11. `/onboarding`

## 2) Matrice cible

| Feature | Role produit (non-dit) | Ecrans obligatoires | Etats visibles obligatoires | Routes cle |
|---|---|---|---|---|
| `SuperLike` | Initiative prioritaire et acceleration du premier contact, pas juste un "like fort" | Discover, Likes, Messages, Boost, Profile (stock) | `available`, `low_stock`, `out_of_tokens`, `action_success`, `paywall_offer` | `/discover`, `/likes`, `/messages`, `/boost`, `/profile` |
| `Boost` | Fenetre de visibilite temporaire liee au timing local | Boost, Discover, Profile (entry), Settings (etat), Likes (upsell contextuel) | `inactive`, `active_with_timer`, `expired`, `token_balance`, `purchase_prompt` | `/boost`, `/discover`, `/profile`, `/settings/preferences` |
| `Rewind` | Reduction du regret et recuperation d'opportunites ratees | Discover, Boost (achat token), Settings (info plan) | `available`, `out_of_tokens`, `rewind_applied`, `upsell_token` | `/discover`, `/boost`, `/settings/preferences` |
| `IceBreaker` | Conversion contextuelle quand des likes caches existent | Likes (principal), Boost (achat), Discover (hint contextuel), Messages (hint) | `eligible_likes_hidden>=3`, `active_24h`, `inactive`, `consumed`, `paywall_offer` | `/likes`, `/boost`, `/discover`, `/messages` |
| `Hide age/distance` | Controle de l'exposition sociale, pas simple preference cosmétique | Settings privacy, Discover, Likes cards, Profile preview, Chat header/preview | `off`, `hide_age_only`, `hide_distance_only`, `hide_both`, `viewer_mask_applied` | `/settings/privacy`, `/discover`, `/likes`, `/profile`, `/chat/:userId` |
| `ShadowGhost` | Mode de protection identitaire forte pour profils sensibles | Settings privacy (master), Discover, Likes, Messages list, Profile public preview, Boost (upsell) | `off`, `on_masking`, `on_limited_reveal_after_qualified_interaction`, `premium_required` | `/settings/privacy`, `/discover`, `/likes`, `/messages`, `/profile`, `/boost` |
| `Travel Pass` | Changement de contexte geographique avec 1 ville active max | Boost (achat/activation), Discover (city context), Profile (etat), Settings preferences (gestion) | `inactive`, `active_city`, `time_left`, `expired`, `switch_city_blocked_if_active` | `/boost`, `/discover`, `/profile`, `/settings/preferences` |
| `Who liked you` | Levier principal de conversion freemium vers payant | Likes, Boost, Profile (upsell), Discover (teaser) | `locked_count`, `unlock_preview`, `unlocked_list`, `empty`, `paywall_clicked` | `/likes`, `/boost`, `/profile`, `/discover` |
| `Verified Identity Badge` | Confiance/safety reelle, distinct du premium | Onboarding verify step, Profile, Discover card, Likes card, Messages list, Chat header | `not_verified`, `verification_pending`, `verified_identity`, `verification_failed` | `/onboarding`, `/profile`, `/discover`, `/likes`, `/messages`, `/chat/:userId` |
| `Premium Badge` | Statut visuel monétise, non confondu avec identite verifiee | Boost, Profile, Discover card, Messages list, Likes card | `free`, `essential`, `gold`, `platinum`, `elite` | `/boost`, `/profile`, `/discover`, `/messages`, `/likes` |
| `Chat auto-translation` | Suppression de la barriere linguistique, coeur de proposition de valeur | Chat, Messages, Settings preferences, Onboarding translation step | `auto_detect_on`, `auto_detect_off`, `translated_visible`, `original_only`, `manual_toggle` | `/chat/:userId`, `/messages`, `/settings/preferences`, `/onboarding` |
| `See online members` (Platinum+) | Avantage de vitesse relationnelle, pas domination totale | Discover filters, Messages list, Chat header, Boost (explain value) | `feature_locked`, `feature_active`, `online_indicator_visible`, `offline_fallback` | `/discover`, `/messages`, `/chat/:userId`, `/boost` |
| `No ads` | Confort premium transverse | App shell global, Boost, Profile | `ads_enabled`, `ads_disabled_by_plan`, `trial_day_pass` | `/boost`, `/profile` |
| `Purchase transparency` | Donner controle et confiance avant achat (ROI percu) | Boost (principal), Profile (resume), Settings account (historique) | `current_plan`, `resource_balance`, `last_30d_usage`, `next_renewal`, `consumption_projection`, `locked_without_plan` | `/boost`, `/profile`, `/settings/account` |
| `Selected pack visual inheritance` | Rendre premium et compréhensible: la couleur du pack pilote ses CTA/accents | Boost (cards + CTA + section active) | `essential_theme`, `gold_theme`, `platinum_theme`, `elite_theme`, `inactive_default_theme` | `/boost` |
| `Received SuperLike trace` | Un SuperLike recu ouvre un chat direct mais doit laisser une trace prioritaire | Messages list, Chat header/thread, Likes activity timeline, Discover hint | `received_superlike_unread`, `direct_chat_opened`, `trace_pinned_24h`, `trace_archived`, `consumed` | `/messages`, `/chat/:userId`, `/likes`, `/discover` |

## 3) Regles de coherence visibles a verrouiller (design-only)

1. `Verified Identity Badge` et `Premium Badge` doivent etre differencies visuellement partout.
2. Si `ShadowGhost` est `on`, les zones publiques doivent afficher masquage coherent sur tous les ecrans (pas seulement un ecran).
3. `Hide age/distance` doit modifier le rendu carte sur Discover/Likes/Profile preview, pas seulement exister en settings.
4. `Travel Pass` doit afficher une ville active + temps restant sur Discover et Boost.
5. `IceBreaker` doit apparaitre seulement en contexte utile (`likes_hidden >= 3`), pas en CTA permanent.
6. `SuperLike/Boost/Rewind` doivent toujours exposer un etat de stock ou token visible.
7. Les CTA de monetisation doivent pointer vers `/boost` depuis tous les points d'entree.
8. La couleur du pack selectionne (`Essential/Gold/Platinum/Elite`) doit se propager visuellement aux CTA et highlights de la zone active.
9. Les pages monetisation doivent afficher des stats compréhensibles de consommation/valeur (pas de chiffres mensongers, mais un etat transparent).
10. Un `SuperLike` recu doit etre identifiable comme evenement distinct (badge/thread/tag) meme apres ouverture de chat.

## 3.1) Etats statistiques minimaux a afficher (design-only)

1. Solde visible: `superlikes_left`, `boosts_left`, `rewinds_left`.
2. Statut plan: `free|essential|gold|platinum|elite`.
3. Periode: `next_renewal_date` (si abonnement) ou `valid_until` (pass/token).
4. Activite recente (30j): `boosts_used`, `superlikes_sent`, `rewinds_used`.
5. Indication de valeur: `recommended_pack` + raison courte (ex: "meilleur rapport", "usage intensif").

## 3.2) Trace SuperLike recu (design-only)

1. Dans `Messages`: conversation marquee par un indicateur specifique `SuperLike`.
2. Dans `Chat`: bandeau d'entree "Cette conversation a ete ouverte par un SuperLike".
3. Dans `Likes`: ligne d'activite "SuperLike recu" avec timestamp.
4. Duree de prominence recommandee: 24h puis archivage visuel.
5. Le flux reste sans match prealable, mais l'historique d'origine doit rester visible.

## 4) Ce que cette matrice fixe pour la suite workflow

Ordre de traitement par ecran:

1. design visible conforme a cette matrice
2. donnees d'entree/sortie par feature
3. etats metier persistants
4. regles algo/triggers
5. contrats API
6. tests
7. production
