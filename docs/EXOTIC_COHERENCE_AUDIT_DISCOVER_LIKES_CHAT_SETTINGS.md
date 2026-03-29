# Audit de Coherence — Discover / Likes / Chat / Parametres + Routes

Date: 2026-03-30  
Reference spec: `docs/EXOTIC_V1_MASTER_SPEC.md`

## 1) Cartographie routes actuelles

Routes principales detectees:

- `GET /discover` -> ecran Discover (`SwipeScreen`)
- `GET /likes` -> ecran Likes (`MatchesScreen`)
- `GET /messages` -> ecran Messages (liste + detail embarque en tablette/desktop)
- `GET /chat/:userId` -> ecran Chat dedie (`ChatScreen`) hors `AppShell`
- `GET /settings` -> hub parametres
- `GET /settings/:category` -> section parametres
- `GET /settings/:category/:sub` -> detail parametre

Constat coherence routes:

- Le flux Messages -> Chat est implemente.
- Le flux Chat -> Messages est partiellement implicite (`navigate(-1)`), pas route-cible explicite.
- Le flux Likes -> Match -> Chat n'est pas implemente au niveau donnees (UI verrouillee/premium placeholder).
- Le chat est hors shell (`/chat/:userId`), donc sans nav globale sur mobile.

## 2) Discover — Coherence avec la spec

Points conformes:

- UX swipe centrale et lisible.
- Actions coeur/nope/superlike presentes.
- Overlay match presente.
- Quick filters visibles et interactifs en UI.
- Route Boost reliee via CTA.

Ecarts spec critiques:

- Feed base sur mock local (`MOCK_USERS`), pas sur moteur ranking V1.
- Pas de hard filters metier (orientation/age/distance/safety).
- Match declenche aleatoirement (`Math.random()`), non pilote par score R/O.
- Aucune instrumentation events spec (`profile_impression`, `swipe_like`, `superlike_used`, etc.).
- Pas de separation claire entre logique feed, logique business trigger et rendu.

Points a traiter (Discover):

- P0: remplacer la logique aleatoire par decision basee sur donnees/backend.
- P0: integrer tracking des evenements swipe/impression/match.
- P1: brancher quick filters sur preferences reelles utilisateur.
- P1: preparer contrat API feed (scores, raisons, flags premium/boost).
- P2: ajouter garde-fous anti-repetition (Novelty score N cote backend).

## 3) Likes — Coherence avec la spec

Points conformes:

- Positionnement premium/locked coherent pour "voir qui a like".
- UI mobile/tablette/desktop propre.
- Section premium et proposition de valeur visibles.

Ecarts spec critiques:

- Liste likes entierement hardcodee (`lockedLikes`).
- Pas de logique IceBreaker conditionnelle (`likes caches >= 3`).
- Pas de transition donnees likes -> match -> chat.
- Pas de journalisation `paywall_view`, `paywall_click`, `purchase_success`.
- CTA premium non relies a un tunnel d'achat reel.

Points a traiter (Likes):

- P0: connecter la liste likes a une source backend (reelle ou mock API structuree).
- P0: tracer les events paywall/achat spec.
- P1: integrer trigger IceBreaker selon regles V1.
- P1: relier unlock likes a state abonnement et inventaire produits.
- P2: exposer "likes caches" dans un format compatible business engine.

## 4) Chat — Coherence avec la spec

Points conformes:

- Ecran chat premium lisible.
- Toggle traduction disponible.
- Input + typing indicator + read-state visuels presents.
- Bon comportement master-detail sur grand ecran via `MessagesScreen`.

Ecarts spec critiques:

- Messages et utilisateurs encore bases sur mocks.
- Toggle traduction local UI, pas relie a un moteur traduction reel.
- Pas de modele message original/traduit persiste.
- Pas d'events conversation spec (`first_message_sent`, `first_message_reply`, `conversation_reached_6_messages`).
- Retour chat non deterministic (`navigate(-1)`), fragile selon historique.

Points a traiter (Chat):

- P0: brancher conversation/messages sur API persistante.
- P0: modeliser `original_text`, `translated_text`, `translated`, `target_locale`.
- P0: tracer events conversation utiles.
- P1: remplacer `navigate(-1)` par fallback route explicite `/messages` si historique absent.
- P1: synchroniser option traduction avec preferences utilisateur (settings).

## 5) Parametres — Coherence avec la spec

Points conformes:

- Arborescence claire: compte, confidentialite, notifications, preferences.
- Routes imbriquees actives (`/settings/:category/:sub`).
- Changement de langue UI deja supporte.

Ecarts spec critiques:

- Tous les controles sont majoritairement statiques/local UI (toggle/input/slider mock).
- Pas de persistence backend des preferences critiques (distance, age range, genre recherche).
- Pas de module traduction parametres chat conforme a la spec produit.
- Pas de lien fonctionnel vers privacy strategique V1 (ShadowGhost, hide age/distance avec regles plan).
- Pas de tests de non-regression pour i18n/settings.

Points a traiter (Parametres):

- P0: persister les preferences profil/recherche/confidentialite via API.
- P0: ajouter schema strict pour settings utilisateurs (validation + valeurs par defaut).
- P1: brancher settings traduction sur chat runtime.
- P1: controler exposition features premium selon plan actif.
- P2: ajouter feedback de sauvegarde/retry offline.

## 6) Coherence transversale des routes (a verrouiller)

Points sensibles:

- Chat hors `AppShell` casse la continuite de navigation mobile.
- Selection d'onglet active basee sur egalite stricte pathname dans `BottomNav` (pas d'etat actif pour sous-routes).
- Absence de convention route fallback quand un parametre est invalide (`/chat/:userId`, `/settings/:category`).

Actions recommandees:

- P0: definir politique route fallback:
  - `/chat/:userId` invalide -> `/messages`
  - `/settings/:category` invalide -> `/settings/account`
- P1: decider si chat doit vivre dans shell sur mobile pour coherence nav.
- P1: normaliser route transitions spec:
  - Discover -> Match overlay -> retour feed
  - Likes -> Match -> Chat
  - Chat -> Messages (route explicite)

## 7) Priorisation globale

Priorite immediate (P0):

- Sortir Discover/Likes/Chat des mocks critiques.
- Instrumenter events analytics obligatoires spec.
- Persist settings structurants (preferences + traduction + confidentialite).
- Stabiliser fallback routing.

Priorite produit (P1):

- Connecter triggers business (Boost, IceBreaker, SuperLike, Upgrade) aux regles V1.
- Rendre les flux inter-ecrans strictement conformes a la spec.
- Aligner chat traduction avec parametres utilisateurs persistants.

Priorite durabilite (P2):

- Tests de non-regression i18n/routes.
- Telemetrie UX navigation cross-device.
- Hardening erreurs API/offline.

## 8) Livrable suivant recommande

Creer un dossier `contracts/` avec:

- `feed.contract.ts`
- `likes.contract.ts`
- `chat.contract.ts`
- `settings.contract.ts`
- `events.contract.ts`

Objectif:

- verrouiller la coherence entre UX actuelle et backend V1 avant implementation serveur.
