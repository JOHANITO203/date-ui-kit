# Exotic — Feuille De Route Workflow Par Écran (V1)

## 1) But Du Document
Ce document transforme le Master Spec en plan d’exécution concret par écran, selon le workflow standard :

`Écran -> Données -> États -> Logique métier -> Algorithme -> API -> Tests -> Prod`

Il sert de base unique pour prioriser le delivery frontend/backend sans régression design, i18n ou business.

---

## 2) Photo Actuelle (Code Aujourd’hui)

### Frontend en place
- Stack active : `React 19`, `Vite`, `TypeScript`, `Tailwind v4`, `motion/react`, `react-router-dom`, `lucide-react`.
- i18n active EN/RU : dictionnaires + tokens (dont onboarding récemment migré).
- Écrans existants et routés : splash, login, onboarding, discover, likes, messages, chat, boost, profile, settings.

### Dette fonctionnelle actuelle
- La plupart des écrans consomment encore des données locales/mock (`MOCK_USERS`, états locaux).
- Pas encore de backend métier branché pour le feed ranking, monétisation réelle, chat temps réel et tracking serveur complet.
- Les algorithmes Master Spec (F, R, O) sont documentés mais non encore implémentés côté API.

---

## 3) Stack Cible (Pour Boucler Le Produit)

## 3.1 Frontend
- `React + TypeScript` (conserver)
- `Tailwind + tokens design` (conserver)
- `i18n tokens EN/RU` avec garde-fou CI (conserver)
- `React Query` recommandé pour cache API/états serveur
- `Zod` recommandé pour validation schémas côté client

## 3.2 Backend API
- `Node.js 20 + TypeScript`
- `Express` (déjà présent) ou `NestJS` si besoin de modularité plus stricte
- API REST V1, versionnée (`/v1/...`)
- Auth par OTP (téléphone/email), OAuth Google en V2

## 3.3 Données
- `Postgres (Supabase recommandé)` pour tables métier Master Spec
- `Redis` pour cache scoring, rate limiting, queues légères
- Stockage objet S3-compatible pour photos et vérification selfie/passeport

## 3.4 Temps Réel & Messaging
- WebSocket/Realtime pour chat, typing, read receipts
- Service de traduction IA asynchrone (toggle ON/OFF par conversation)

## 3.5 Analytics & Observabilité
- Event pipeline server-side (`profile_impression`, `swipe_like`, `purchase_success`, etc.)
- Logs centralisés + dashboards KPI produit/business
- Alerting erreurs API + taux de conversion paywall

## 3.6 Environnements & Serveurs
- `dev`, `staging`, `prod`
- Serveur API principal en région RU centrale (latence globale)
- Réplication lecture + CDN média
- Sharding logique par ville de lancement V1 : Moscou, Voronej, Saint-Pétersbourg, Sotchi

---

## 4) Workflow Par Écran (Roadmap Exécutable)

| Écran | Données V1 | États Clés | Logique Métier | Algo | API V1 | Tests | Priorité |
|---|---|---|---|---|---|---|---|
| Splash | branding, locale active, route CTA | load/success | choix `Commencer` vs `Se connecter` | n/a | `GET /v1/app-config` | UI + i18n | P0 |
| Login | méthode auth, OTP, device trust | idle/loading/error/success | login rapide, one-click device connu | n/a | `POST /v1/auth/request-otp`, `POST /v1/auth/verify-otp`, `POST /v1/auth/device-login` | unit validation + integration auth | P0 |
| Onboarding | profil de base, ville, nationalité, langues, préférences | 12 étapes + validation | collecte minimale pour feed pertinent | prépare sous-scores C/P/L/Q/I | `POST /v1/onboarding`, `PATCH /v1/profile`, `POST /v1/media` | step flow + i18n + responsive + validation 18+ | P0 |
| Discover | candidats feed, filtres, swipes, superlike, rewind | loading/empty/success/error/match overlay | décision rapide, filtres rapides, no hard block UX | Feed Score F + composition fenêtre 20 | `GET /v1/feed`, `POST /v1/swipes`, `POST /v1/superlikes`, `POST /v1/rewind` | swipe flow, algorithme mock vs réel, non-régression responsive | P0 |
| Likes | likes reçus (locked/unlocked), upsell premium | loading/locked/unlocked/error | gating monétisation non toxique | trigger IceBreaker/premium | `GET /v1/likes/received`, `POST /v1/paywall/click` | états locked/unlocked + conversion events | P1 |
| Messages | matches list + conversations list | loading/empty/success/error | navigation conversation + priorité social cues | priorisation par activité/récence | `GET /v1/matches`, `GET /v1/conversations` | split layout tablet/desktop + scroll rails | P1 |
| Chat | messages, traduction toggle, typing, read states | loading/sending/sent/error | chat naturel, traduction discrète activable | Open Score O + traduction confiance | `GET /v1/chats/:id/messages`, `POST /v1/chats/:id/messages`, `POST /v1/chats/:id/translation-toggle` | realtime + clavier mobile + i18n | P0 |
| Boost | catalog produits, tiers, bundles, timer boost | idle/active/expired/error | conversion orientée conséquence, offres packagées | triggers business (boost, superlike, upgrade) | `GET /v1/monetization/catalog`, `POST /v1/boost/activate`, `POST /v1/purchases` | pricing rendering + devise + events | P0 |
| Profile | identité, stats, premium state, actions | loading/success/error | hub personnel : visibilité, statut, actions | lecture score profil Q/S/I | `GET /v1/profile/me`, `PATCH /v1/profile/me` | edit flow + états premium/verified | P1 |
| Settings | compte, confidentialité, notifications, préférences | loading/success/error | contrôle utilisateur (privacy, langue, recherche) | impacte règles feed et chat | `GET /v1/settings`, `PATCH /v1/settings` | persistence + i18n + navigation | P1 |

---

## 5) Mapping Données (Master Spec -> Implémentation)

## 5.1 Tables Backend à créer d’abord
- `users`
- `profile_stats`
- `feed_impressions`
- `swipe_events`
- `match_events`
- `message_events`
- `moderation_events`
- `paywall_events`
- `purchase_events`

## 5.2 Événements analytics obligatoires (minimum V1)
- `profile_impression`
- `swipe_like`
- `swipe_dislike`
- `superlike_used`
- `rewind_used`
- `match_created`
- `first_message_sent`
- `first_message_reply`
- `paywall_view`
- `paywall_click`
- `purchase_success`
- `boost_activated`

---

## 6) Roadmap Technique Par Phases

## Phase 0 — Fondations (1 sprint)
- Contrats API JSON + schémas TypeScript partagés
- Mise en place Postgres + migrations initiales
- Auth OTP + session
- Event logger backend

## Phase 1 — Core Product (2 à 3 sprints)
- Onboarding branché API
- Discover branché feed réel + events swipes
- Chat branché messages + traduction toggle
- Boost branché catalog + activation + purchase mock paiement

## Phase 2 — Conversion & Confiance (1 à 2 sprints)
- Likes locked/unlocked
- Premium tiers/rules côté backend
- Verified identity workflow (upload + review)
- Privacy controls (ShadowGhost V1)

## Phase 3 — Optimisation (continue)
- Calibration pondérations F/R/O par ville
- A/B tests paywall et triggers
- Monitoring KPI rétention, conversation utile, conversion

---

## 7) Définition De Fini (DoD) Par Écran
- Données branchées API (pas de mock pour le flux principal)
- États UI complets (`loading`, `empty`, `error`, `success`, `locked` si applicable)
- i18n EN/RU sans hardcode
- Responsive validé mobile/tablette/desktop
- Tests unit + integration + UI critiques
- Events analytics envoyés côté serveur
- Feature flag + rollback plan prêt

---

## 8) Risques À Gérer
- Corruption i18n (mojibake, hardcode) -> garder `i18n:check` en CI
- Algorithme trop biaisé premium -> plafonner poids monétisation (Master Spec)
- Régression design cross-device -> snapshot visuel par écran critique
- Paiement trop tôt sans métriques -> déclencher catalog/push seulement après events de friction

---

## 9) Décision Opérationnelle
Le prochain bloc recommandé est :
1. Finaliser contrats API V1 (`auth`, `onboarding`, `feed`, `chat`, `boost`)
2. Créer schéma Postgres + migrations
3. Brancher `Onboarding`, `Discover`, `Chat`, `Boost` en priorité P0
4. Activer dashboards KPI V1 (rétention, conversation utile, conversion payante)
