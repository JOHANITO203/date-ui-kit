# SPEC PRODUIT + ALGORITHME

## Exotic — V1 Master Spec

## 1. Identité produit

### Nom produit

- **Exotic**
- Variante russe : **Экзотик**

### Positionnement

Exotic est une application de rencontre locale en Russie, conçue pour faciliter les rencontres entre personnes d’origines, de langues et de cultures différentes, tout en conservant une logique de proximité réelle, de sécurité et de monétisation maîtrisée.

### Promesse produit

Exotic ne vend pas simplement des profils.  
Exotic optimise la probabilité de :

- découverte pertinente
- match plausible
- conversation utile
- retour utilisateur
- conversion payante sans corruption du feed

### Problème résolu

Exotic répond à 5 frictions majeures :

1. barrière linguistique
2. faible diversité des profils visibles
3. difficulté à initier la conversation
4. faible contrôle sur la visibilité
5. besoin de confidentialité / protection de l’identité

---

## 2. Objectifs du système

### Objectif produit principal

Classer les profils selon leur probabilité de créer une interaction réelle, cohérente, désirée et exploitable commercialement, sans casser la confiance.

### Objectifs stratégiques V1

Priorité recommandée :

1. **rétention**
2. **qualité des conversations**
3. **conversion payante**
4. **sécurité / confiance**
5. **diversité interculturelle**

---

## 3. Périmètre V1

### Villes de lancement

- Voronej
- Moscou
- Saint-Pétersbourg
- Sotchi

### Rayon

- rayon par défaut : **25 km**
- options utilisateur : **25 / 50 / 100 km**

### Âge

- minimum : **18**
- maximum : **99**

### Genres

- Homme
- Femme
- Autre

### Orientations

_(seulement hétéro affiché mais prend en compte toutes les orientations sexuelles ; contexte territorialement censuré en Russie)_

- Hétéro
- Gay
- Lesbienne
- Bi
- Pan
- Autre
- Préfère ne pas dire

---

## 4. Fonctionnalités principales

### 4.1 Matching local

Le feed présente des profils classés selon :

- compatibilité
- proximité
- activité
- qualité du profil
- langue / traduction
- diversité d’origine
- sécurité / confiance
- fiabilité relationnelle
- variété contrôlée

### 4.2 Traduction IA

La conversation peut être traduite automatiquement quand l’utilisateur le souhaite en activant et choisissant la langue cible dans les paramètres de traduction du chat.

#### Règles V1

- traduction activable/désactivable
- traduction prise en compte dans le score d’ouverture de conversation
- la traduction n’annule pas la nécessité de compatibilité

### 4.3 SuperLike

Permet d’envoyer directement une intention forte de contact, et selon le design final, un premier message guidé/direct.

### 4.4 Boost

Augmente temporairement la distribution du profil.

### 4.5 Rewind

Permet de revenir sur un profil rejeté ou manqué.

### 4.6 IceBreaker

Permet de révéler des opportunités sociales cachées, en particulier quand des likes ont été reçus.

### 4.7 ShadowGhost

Mode de protection identitaire.

#### ShadowGhost V1

Quand activé :

- photo remplacée par avatar fantôme
- couleur de l’avatar variable
- prénom masqué partiellement
- distance masquée ou floutée
- origine masquée ou floutée jusqu’à interaction qualifiée

### 4.8 Travel Pass

Permet d’apparaître dans une autre ville.

#### Travel Pass V1

Durées :

- 24h
- 3 jours
- 7 jours

Règle V1 :

- **1 seule ville active à la fois**
- la logique “2 serveurs simultanés” est reportée à V2

### 4.9 Badges

Il faut distinguer :

#### A. Verified Identity Badge

- obtenu après avoir rempli les infos du profile et envoyé un selfie avec le passeport
- impacte la confiance / sécurité

#### B. Statut Premium Badge

- obtenu via achat d’offre/packs
- impacte le statut visuel
- n’est pas une preuve d’identité

---

## 5. Définition des notions clés

### Profil actif

- **très actif** : dernière activité < 1h
- **actif** : dernière activité < 24h
- **récent** : dernière activité < 72h
- **faible activité** : < 7 jours
- **dormant** : > 30 jours

### Conversation utile

Une conversation utile est définie par :

- **au moins 6 messages échangés au total**
- avec participation des 2 utilisateurs
- et au moins une réponse de chaque côté

### Match plausible

Un match plausible est un duo dont la probabilité de like mutuel + ouverture de conversation + réponse est élevée selon le score R.

---

## 6. Offre business V1

### 6.1 Abonnements

#### Essential — 499 ₽ / mois

Inclut :

- no ads
- voir qui a liké
- badge premium
- traduction du chat
- 5 SuperLikes / jour

#### Gold — 899 ₽ / mois

Inclut :

- tout Essential
- 10 SuperLikes / jour
- 1 Boost / semaine
- 3 Rewinds / jour
- hide age / distance

#### Platinum — 1490 ₽ / mois

Inclut :

- tout Gold
- 20 SuperLikes / jour
- 1 Boost / jour
- 10 Rewinds / jour
- voir membres connectés
- ShadowGhost
- 1 Travel Pass / mois

#### Elite / VIP — 2990 ₽ / mois

Inclut :

- tout Platinum
- badge exclusif
- exposition premium légère
- support prioritaire

### 6.2 Pass courts

#### Day Pass — 99 ₽

- no ads
- IceBreaker 24h
- badge premium temporaire

#### Week Pass — 299 ₽

- no ads
- IceBreaker
- 5 SuperLikes / jour
- 2 Boosts total

### 6.3 Travel Pass

- 24h : 199 ₽
- 3 jours : 399 ₽
- 7 jours : 599 ₽

### 6.4 Packs unitaires

- 1 SuperLike : 49 ₽
- 5 SuperLikes : 199 ₽
- 15 SuperLikes : 499 ₽
- 1 Boost : 149 ₽
- 5 Boosts : 599 ₽
- 15 Boosts : 1490 ₽
- IceBreaker 24h : 149 ₽
- Rewind x10 : 149 ₽

### 6.5 Plafonds business

- boosts inclus max / jour : **1**
- SuperLikes inclus max / jour : **20**
- push IceBreaker : à partir de **3 likes cachés**
- bonus visibilité premium hors boost : **max +12 %**

---

## 7. Doctrine algorithmique

### Principe central

Exotic ne classe pas “les plus beaux profils”.  
Exotic classe les profils selon leur probabilité de créer :

- une rencontre locale
- une interaction cohérente
- une conversation utile
- un retour utilisateur
- une conversion saine

### Règles doctrinales

1. proximité d’abord
2. diversité augmentée, jamais imposée
3. activité réelle prioritaire
4. friction linguistique compensée
5. monétisation légère, jamais corruption
6. sécurité peut couper le ranking
7. variété contrôlée pour éviter la monotonie

---

## 8. Architecture algorithmique

Le système repose sur 3 moteurs.

### 8.1 Moteur 1 — Feed Ranking

Décide :

- quels profils sont montrés
- dans quel ordre
- dans quelle composition de feed

### 8.2 Moteur 2 — Match Likelihood

Estime :

- probabilité de like mutuel
- probabilité d’ouverture de chat
- probabilité de réponse

### 8.3 Moteur 3 — Business Trigger Engine

Détecte :

- opportunité SuperLike
- opportunité Boost
- opportunité Rewind
- opportunité IceBreaker
- opportunité upgrade abonnement

---

## 9. Hard filters

Avant tout calcul de ranking, on applique des filtres durs.

### Exclusions / fortes pénalités

- orientation incompatible
- âge hors préférence dure
- distance hors rayon sans Travel Pass
- profil dormant > 30 jours
- score sécurité critique
- compte signalé / modéré / banni

---

## 10. Scores principaux

### 10.1 Feed Score

[
F = 0.26C + 0.18P + 0.12A + 0.10Q + 0.10L + 0.07D + 0.09S + 0.05I + 0.03N
]

### 10.2 Match Score

[
R = 0.24C + 0.14P + 0.12A + 0.10L + 0.08D + 0.08Q + 0.12I + 0.12S
]

### 10.3 Open Conversation Score

[
O = 0.18A + 0.18L + 0.16C + 0.08D + 0.08Q + 0.10S + 0.22I
]

---

## 11. Définition des sous-scores

### 11.1 C — CompatibilityScore

[
C = 0.22G + 0.18O + 0.16Age + 0.12DistPref + 0.12LangPref + 0.10Interests + 0.06Intent + 0.04Z
]

#### Variables

- **G** : genre compatible
- **O** : orientation compatible
- **Age** : proximité avec la tranche d’âge souhaitée
- **DistPref** : adéquation au rayon souhaité
- **LangPref** : langues préférées
- **Interests** : intérêts communs
- **Intent** : intention de rencontre compatible
- **Z** : zodiaque

#### Règles

- si genre/orientation incompatibles : filtre dur
- zodiaque = micro-signal, pas plus de 4 %

### 11.2 P — ProximityScore

Barème :

- 0–3 km = 100
- 3–10 km = 90
- 10–25 km = 75
- 25–50 km = 55
- 50–100 km = 30
- > 100 km = 10
- hors Travel Pass = 0–5

#### Bonus

- même quartier : +5
- même ville : +3
- Travel Pass ville active : +10

Cap max : 100

### 11.3 A — ActivityScore

[
A = 0.35Recency + 0.20Sessions + 0.15Swipes + 0.15Replies + 0.15Presence
]

#### Recency

- online now = 100
- <1h = 95
- <6h = 85
- <24h = 70
- <72h = 50
- <7 jours = 25
- <30 jours = 10
- > 30 jours = 0

#### Seuils

- A < 20 : hors feed principal
- A > 80 : profil très vivant

### 11.4 Q — ProfileQualityScore

[
Q = 0.25Photos + 0.15Bio + 0.10City + 0.10Origin + 0.10Languages + 0.10Interests + 0.10Verification + 0.10Completeness
]

#### Photos

- 1 photo = 25
- 2 photos = 50
- 3 photos = 75
- 4+ photos = 100

#### Bio

- vide = 0
- 1–30 caractères = 20
- 31–80 = 60
- 80+ = 100

#### Seuils

- Q < 30 : exposition réduite
- Q < 15 : exposition quasi nulle

### 11.5 L — LanguageBridgeScore

[
L = 0.40CommonLanguage + 0.25TranslationPossible + 0.20TranslationConfidence + 0.15CrossLangReplyHistory
]

#### Barème

- langue commune = 100
- pas de langue commune mais traduction bonne = 75
- traduction possible mais fragile = 55
- peu de chances d’échange = 35

### 11.6 D — DiversityBoostScore

Barème V1 :

- même origine = 20
- origine différente = 55
- origine différente + historique positif = 70
- origine différente + bonnes réponses observées = 85

#### Règles

- D est un bonus de découverte
- D ne compense jamais une mauvaise sécurité
- D n’exclut jamais une origine
- D ne doit jamais devenir un score de “valeur humaine”

### 11.7 S — SafetyTrustScore

[
S = 100 - Penalties + TrustSignals
]

#### TrustSignals

- verified identity réel : +12
- ancienneté saine : +5
- faible taux de report : +5

#### Penalties

- reports élevés
- blocks élevés
- spam suspicion
- device / géoloc incohérents
- activité anormale
- comportement agressif

#### Seuils

- S ≥ 80 : très fiable
- 60–79 : fiable
- 35–59 : surveillance
- 20–34 : exposition minimale
- <20 : quasi retrait

### 11.8 I — IntentReliabilityScore

[
I = 0.25ReplyRate + 0.20MatchToMessage + 0.20ConversationDepth + 0.15SessionConsistency + 0.10ProfileViewDepth + 0.10BehaviorConsistency
]

#### Rôle

Mesure si le profil est réellement conversationnel.

#### Règle V1

Comme il n’y a pas encore de données :

- nouveau compte = **I = 50 par défaut**
- recalcul après 30 à 50 interactions significatives

### 11.9 N — NoveltyScore

Petit correcteur anti-répétition :

- profil jamais vu
- profil différent des précédents
- profil récent sain
- variété du feed

Poids volontairement faible.

---

## 12. Règles premium / visibilité

### Multiplicateurs

- Free = x1.00
- Essential = x1.03
- Gold = x1.07
- Platinum = x1.11
- Boost actif = x1.90 temporaire

### Règles strictes

- ne bypass jamais sécurité
- ne bypass jamais orientation
- ne bypass jamais âge
- ne bypass jamais distance dure
- agit uniquement comme amplification de distribution

---

## 13. Règles de composition du feed

Dans une fenêtre de **20 profils** :

- au moins 6 profils actifs <24h
- au moins 3 profils actifs <1h si inventaire suffisant
- au plus 5 profils premium
- au plus 6 profils de même origine
- au moins 4 profils “découverte” si historique compatible
- au plus 2 profils à faible sécurité
- au plus 4 profils de faible qualité

### Objectif

Éviter :

- feed monotone
- feed premium-only
- feed mort
- feed ethniquement répétitif
- feed de profils pauvres

---

## 14. Cold start policy

### 14.1 Nouveau profil

Pendant 48h :

- bonus d’exploration léger
- exposition augmentée max +8 %
- seulement si Q ≥ 40 et S ≥ 60

### 14.2 Nouvel utilisateur viewer

Pendant les 100 premières impressions :

- plus de variété
- plus de proximité
- plus de profils actifs
- collecte rapide de signaux de goût

---

## 15. Triggers business

### 15.1 SuperLike

Pousser si :

- O > 70
- activité du receveur > 65
- distance dans le rayon
- profil regardé > 6 sec
- pas encore de match

### 15.2 Boost

Pousser si :

- vues 24h trop faibles
- Q > 55
- A utilisateur > 50
- ville concurrentielle

#### Seuils de vues / 24h

- petite ville : <15
- ville moyenne : <30
- grande ville : <60

### 15.3 IceBreaker

Pousser si :

- likes cachés ≥ 3
- activité récente <24h
- inventaire local vivant

### 15.4 Rewind

Pousser si :

- profil regardé > 5 sec puis rejeté
- ou profil manqué avec R > 72

### 15.5 Upgrade Gold / Platinum

Pousser si :

- usage fréquent de SuperLike
- frustration récurrente sur visibilité
- intérêt pour membres connectés
- usage de traduction élevé
- intérêt pour confidentialité

---

## 16. Règles anti-biais

Le système ne doit jamais :

- exclure une origine
- déclasser une nationalité par principe
- survaloriser une origine comme “supérieure”
- imposer la diversité contre l’usage réel

Le système peut :

- favoriser légèrement la découverte interculturelle
- apprendre des comportements réels
- équilibrer proximité, activité, langue et diversité

---

## 17. Données à stocker

### 17.1 Table `users`

- id
- age
- gender
- orientation
- city
- lat
- lng
- country_of_origin
- current_country
- languages
- zodiac_sign
- interests
- premium_plan
- shadow_mode
- travel_pass_city
- verified_identity
- created_at
- last_seen_at

### 17.2 Table `profile_stats`

- user_id
- photo_count
- bio_length
- completion_rate
- quality_score_cached
- safety_score_cached
- intent_score_cached

### 17.3 Table `feed_impressions`

- viewer_id
- candidate_id
- shown_at
- feed_score
- rank_position
- city_context

### 17.4 Table `swipe_events`

- viewer_id
- candidate_id
- action
- action_at
- dwell_time_ms
- superlike_used
- rewind_used

### 17.5 Table `match_events`

- user_a
- user_b
- matched_at

### 17.6 Table `message_events`

- sender_id
- receiver_id
- sent_at
- translated
- replied
- response_delay_sec

### 17.7 Table `moderation_events`

- reporter_id
- reported_id
- reason
- created_at

### 17.8 Table `paywall_events`

- user_id
- paywall_type
- shown_at
- clicked
- converted

### 17.9 Table `purchase_events`

- user_id
- product_type
- product_name
- amount_rub
- purchased_at

---

## 18. Événements analytics obligatoires

À tracker dès le jour 1 :

- `profile_impression`
- `profile_open`
- `swipe_like`
- `swipe_dislike`
- `superlike_used`
- `rewind_used`
- `match_created`
- `first_message_sent`
- `first_message_reply`
- `conversation_reached_6_messages`
- `report_submitted`
- `block_user`
- `paywall_view`
- `paywall_click`
- `purchase_success`
- `boost_activated`
- `travel_pass_activated`
- `shadowghost_enabled`

---

## 19. KPI à suivre

### KPI produit

- taux de swipe positif
- taux de match mutuel
- taux d’ouverture de conversation
- taux de réponse au premier message
- nombre de conversations utiles
- rétention J1 / J7 / J30

### KPI algo

- score moyen F des profils servis
- score moyen R des profils likés
- score moyen O des profils superlikés
- exposition free vs premium
- répétition de profils
- part de profils actifs dans le feed

### KPI business

- conversion free → payant
- conversion Day Pass → mensuel
- conversion IceBreaker
- conversion SuperLike
- conversion Boost
- revenu par utilisateur actif
- revenu par payeur
- revenu par mille impressions feed

---

## 20. Pseudo-pipeline backend

### Étape 1

Charger inventaire local :

- ville
- rayon
- Travel Pass si actif

### Étape 2

Appliquer hard filters

### Étape 3

Calculer sous-scores :

- C, P, A, Q, L, D, S, I, N

### Étape 4

Calculer F

### Étape 5

Appliquer bonus statut / boost

### Étape 6

Composer le feed avec contraintes de diversité / activité / premium

### Étape 7

Logger impression

### Étape 8

Observer action utilisateur :

- vue
- like
- dislike
- dwell time
- superlike
- rewind

### Étape 9

Déclencher moteur business si conditions remplies

### Étape 10

Mettre à jour caches de score

---

## 21. Règles d’implémentation

### V1

- heuristique
- pondérations fixes
- peu de machine learning
- scores recalculés régulièrement
- sous-scores mis en cache

### V2

- calibration à partir des données réelles
- ajustement des poids
- segmentation par ville
- segmentation par genre / orientation / activité

### V3

- apprentissage plus fin
- ranking prédictif
- personnalisation avancée

---

## 22. Décisions finales à ne pas casser

1. ne jamais vendre un faux “verified” comme preuve d’identité
2. ne jamais laisser le premium corrompre le matching
3. ne jamais laisser la diversité devenir discrimination
4. ne jamais faire dominer des profils morts
5. ne jamais lancer sans tracking d’événements

---

## 23. Conclusion opérationnelle

**Exotic V1** doit être construit comme :

- une app de rencontre locale
- interculturelle
- traduite
- sécurisée
- monétisée par accélération et contrôle
- pilotée par un ranking heuristique stable

Le système final V1 est donc :

- **produit compatible**
- **monétisable**
- **scalable**
- **défendable**
- **prêt à être transformé en spec backend**

Étape suivante la plus utile : **schéma Supabase/Postgres + pseudo-code backend complet du ranking engine**.
