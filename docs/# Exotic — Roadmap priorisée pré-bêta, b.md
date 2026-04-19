# Exotic — Roadmap priorisée pré-bêta, bêta et go-to-market

## Objectif de ce document

Cette roadmap sert de source de pilotage pour les prochaines étapes du produit Exotic.

Elle a 4 objectifs :

1. Prioriser les chantiers réellement critiques avant bêta
2. Éviter la dispersion entre produit, technique, sécurité et business
3. Donner un ordre d’exécution clair à suivre avec Codex
4. Préparer une transition propre vers la bêta testeurs puis vers la distribution stores / investisseurs

---

# 1. Principes de pilotage

## 1.1. Règle générale

Avant la bêta, on ne cherche plus seulement à ajouter des features.  
On cherche à rendre le produit :

- fiable
- cohérent
- sécurisé
- maintenable
- présentable

## 1.2. Règle de priorité

Ordre de priorité :

1. **fiabilité produit**
2. **source of truth / cohérence des données**
3. **confidentialité / suppression des données**
4. **stabilité des services**
5. **internationalisation / traduction**
6. **sécurité**
7. **paiement**
8. **polish UI/UX**
9. **documentation stores**
10. **pitch deck / business plan**

## 1.3. Règle d’exécution avec Codex

Pour chaque chantier important :

1. audit
2. diagnostic
3. correction ciblée
4. validation runtime réelle
5. verdict honnête
6. clôture propre

On évite :
- les refactors aveugles
- les conclusions sans preuve
- les changements dispersés sans roadmap

---

# 2. État actuel — blocs déjà bien avancés / fermés

## 2.1. Discover
Blocs considérés comme fermés ou bien avancés :
- perf backend principale
- pipeline image structurelle
- correction du faux signed fallback
- reset feed backend métier
- purge d’assets legacy

## 2.2. Likes
Blocs déjà avancés / validés :
- perf backend principale
- split en 2 surfaces :
  - They liked me
  - I liked
- conversion SuperLike depuis I liked
- validation runtime live du flow principal

## 2.3. Produits boutique
Blocs déjà traités ou validés :
- Gold
- Boost
- Travel Pass préparé mais volontairement désactivé
- une partie de la logique boutique / inventory / runtime validation déjà couverte

## 2.4. Messages / Chat
Bloc principal déjà avancé :
- goulot principal de GET /chat/conversations corrigé
- latence ramenée dans une zone prod-ready
- optimisations secondaires encore possibles mais non bloquantes

---

# 3. Prochain grand bloc prioritaire avant bêta

# PRIORITÉ 1 — Audit prod-ready global des services + suppression définitive des données + audit des doubles vérités

C’est le prochain bloc recommandé avant toute autre expansion.

## Pourquoi c’est prioritaire
Parce qu’avant la bêta, il faut verrouiller :
- la fiabilité des services
- la confidentialité utilisateur
- la cohérence des données
- la suppression définitive des données personnelles
- les vraies sources canoniques par domaine

## Sous-bloc 1A — Audit prod-ready service par service

### Services à auditer
- auth-bff
- discover-service
- chat-service
- payments-service
- service de traduction futur
- storage/media
- notifications si présentes

### Questions à poser pour chaque service
- Quelle est sa responsabilité exacte ?
- Quelle est sa source of truth ?
- Quels endpoints sont critiques ?
- Quels scripts/dev hooks subsistent encore ?
- Quels flags de dev restent actifs ?
- Y a-t-il des logs sensibles ?
- Quels sont les risques connus ?
- Le service est-il réellement prod-ready ?
- Quelle est sa stratégie d’erreur / retry / observabilité ?

### Résultat attendu
Pour chaque service :
- statut
- problèmes
- risques
- niveau de readiness
- correctifs restants

---

## Sous-bloc 1B — Suppression définitive des données utilisateur

### Objectif
Permettre à un utilisateur de supprimer définitivement ses données personnelles s’il le souhaite.

### Cela doit couvrir
- profil
- photos
- likes
- matches
- conversations
- messages
- settings
- entitlements
- sessions/tokens
- logs contenant des données personnelles
- analytics / traces si concernées
- storage objects
- stratégie de backup / anonymisation si besoin

### Questions produit / technique à trancher
- suppression immédiate ou différée ?
- anonymisation partielle ou suppression totale selon les tables ?
- que faire des conversations bilatérales ?
- que faire des données nécessaires à la comptabilité/paiement ?
- quelle traçabilité interne garder ?

### Résultat attendu
- flow utilisateur propre
- logique backend fiable
- suppression cohérente
- politique documentée

---

## Sous-bloc 1C — Audit des doubles vérités

### Objectif
Éliminer les domaines où plusieurs sources peuvent se contredire.

### Domaines à auditer
- profil
- onboarding
- edit profile
- likes
- conversations
- entitlements
- inventory
- settings
- langue
- ville / serveur
- photos
- discover state
- i liked / they liked me

### Question centrale
Pour chaque domaine :
> Quelle est la source canonique, et quelles copies/fallback/cache peuvent l’écraser ou la contredire ?

### Résultat attendu
- cartographie claire des SOT
- sources secondaires identifiées
- fallbacks dangereux supprimés
- logique plus stable avant bêta

---

# 4. PRIORITÉ 2 — Traduction temps réel des chats + correction i18n RU / EN

## 4.1. Service dédié de traduction temps réel des chats

### Objectif
Créer un service dédié à la traduction temps réel des messages chat.

### Pourquoi c’est stratégique
C’est un des piliers différenciants d’Exotic :
- rencontres interculturelles
- réduction des barrières linguistiques
- augmentation de la probabilité de conversation utile

### Ce que le service doit respecter
- séparation claire du frontend
- latence raisonnable
- logs minimisés
- pas de stockage inutile du texte source/traduit
- fallback clair en cas d’échec
- gestion propre des langues source/cible
- feature flag de contrôle

### À définir
- traduction à l’envoi
- traduction à la lecture
- affichage original + traduit
- mode auto / manuel
- langue de l’utilisateur vs langue UI vs langue de chat

### Résultat attendu
- service dédié
- flow intégré au chat
- tests runtime
- contrôle produit propre

---

## 4.2. Audit et correction i18n RU / EN

### Problème constaté
Certains fallbacks apparaissent dans une autre langue alors que l’utilisateur est dans une langue précise.

### Ce qu’il faut auditer
- clés manquantes
- fallback chain
- chaînes hardcodées
- textes frontend/backend
- toasts
- erreurs
- labels boutique
- flows critiques
- surfaces Discover / Likes / Chat / Profile / Shop

### Résultat attendu
- zéro fallback surprise
- RU propre
- EN propre
- comportement prévisible

---

# 5. PRIORITÉ 3 — Nettoyage repo / scripts dev / hygiene de release

## Objectif
Nettoyer le repo et les services avant bêta.

## À vérifier
- scripts injectés en mode dev
- mocks runtime
- seeds parasites
- endpoints test-only
- artefacts temporaires
- JWT de test
- fichiers debug
- traces locales
- flags E2E actifs
- logs trop verbeux
- console.logs non voulus

## Résultat attendu
- repo plus propre
- services plus propres
- moins de dette technique visible
- base saine pour release bêta

---

# 6. PRIORITÉ 4 — Audit sécurité backend + frontend

## Objectif
Faire un audit sécurité minimal sérieux avant exposition à des bêta testeurs.

## Backend
- auth / session / token
- contrôle d’accès
- fuites d’ID
- stockage public/privé
- uploads
- idempotency paiements
- rate limiting
- abuse prevention
- PII dans logs
- secrets / env
- validation input

## Frontend
- XSS
- gestion tokens
- erreurs exposées
- stockage local
- données sensibles dans le client
- surfaces pouvant divulguer des infos privées

## Résultat attendu
- liste des failles/risques
- correctifs critiques
- niveau de readiness minimum pour bêta

---

# 7. PRIORITÉ 5 — PSP (paiement)

## Objectif
Ajouter le service PSP pour rendre la boutique réellement exploitable.

## Condition préalable
Ne pas brancher le PSP tant que :
- entitlements sont stables
- flows d’achat sont propres
- suppression données est cadrée
- sécurité minimale est faite
- logs et erreurs sont sains

## Résultat attendu
- intégration PSP fiable
- attribution propre
- gestion erreurs / retries / idempotency
- conformité minimum

---

# 8. PRIORITÉ 6 — Polish visuel UI/UX final

## Objectif
Faire les derniers polish visuels avant bêta.

## Chantiers recommandés
- icônes propres à Exotic pour l’UI
- cohérence du set iconographique
- uniformisation des surfaces
- cohérence des badges
- cohérence locked / ghost / reveal
- détail des états de carte
- éventuelles dernières harmonies colorimétriques

## Important
Ce bloc vient après les sujets critiques de fiabilité / sécurité / SOT.  
Il ne doit pas passer devant eux.

---

# 9. PRIORITÉ 7 — Documentation produit / conformité stores

## Objectif
Préparer les documents nécessaires au passage en store et à la confiance produit.

## Documents à préparer
- Privacy Policy
- Terms of Service
- Politique de suppression des données
- Safety / moderation policy
- Community guidelines
- Support / contact
- Description des permissions
- Description des flows de blocage / signalement
- Documents d’assets stores (captures, textes, descriptions)

## Résultat attendu
- dossier propre
- prêt pour review classique
- aligné avec les vrais comportements du produit

---

# 10. PRIORITÉ 8 — Pitch deck et business plan

## Objectif
Préparer un dossier investisseur cohérent avec l’avancement réel du produit.

## Axes différenciants crédibles à mettre en avant
- GhostMode comme mode de discrétion et contrôle de visibilité
- traduction temps réel des chats
- algorithme favorisant les rencontres interculturelles
- pipeline relationnel plus riche :
  - Like
  - SuperLike
  - I liked / They liked me
  - IceBreaker
- logique produit visant à augmenter la conversation utile

## Positionnement recommandé
Éviter de positionner GhostMode comme outil d’espionnage ou d’enquête conjugale.

Positionnement propre recommandé :
- discrétion
- contrôle de visibilité
- sécurité psychologique
- navigation privée dans l’expérience dating

## Livrables
- pitch deck
- business plan
- vision produit
- avantage technologique
- potentiel marché
- feuille de route

---

# 11. Recommandations produit / technique complémentaires

## 11.1. Feature flags
À généraliser pour :
- traduction temps réel
- GhostMode
- Travel Pass
- nouveaux flows sensibles
- expériences bêta

## 11.2. Observabilité minimale
Il faut mesurer :
- erreurs frontend
- erreurs backend
- temps endpoints critiques
- échecs paiements
- échecs traduction
- erreurs uploads
- erreurs Discover / Likes / Chat

## 11.3. Abuse / moderation readiness
Avant bêta :
- report
- block
- signalement message
- suppression compte
- support clair

---

# 12. Ordre recommandé d’exécution

## Bloc 1 — Avant bêta (priorité absolue)
1. audit prod-ready service par service
2. suppression définitive des données utilisateur
3. audit des doubles vérités
4. correction i18n RU / EN
5. service de traduction temps réel des chats
6. nettoyage repo / scripts dev
7. audit sécurité backend/frontend

## Bloc 2 — Ensuite
8. PSP
9. polish UI/UX final + icônes propres

## Bloc 3 — Go-to-market
10. documentation stores / conformité
11. pitch deck
12. business plan

---

# 13. Ce qu’on suit avec Codex

Pour chaque bloc, avec Codex :

1. audit
2. diagnostic
3. implémentation ciblée
4. validation runtime réelle
5. preuve
6. clôture
7. mise à jour de la documentation / roadmap

---

# 14. Décision actuelle recommandée

## Prochain bloc conseillé à lancer maintenant
**Audit prod-ready de tous les services + suppression définitive des données + audit des doubles vérités**

## Puis enchaîner avec
**Service dédié de traduction temps réel des chats + correction i18n RU / EN**

---

# 15. Statut de cette roadmap

Ce document sert de base de pilotage interne.
Il doit être mis à jour au fur et à mesure :
- des validations runtime
- des chantiers clôturés
- des arbitrages produit
- de la préparation à la bêta