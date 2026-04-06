# WAVE A — ELEMENTS RESTANTS

Document de suivi des éléments **non terminés** pour clôturer Wave A.

## 1) Credentials réels à injecter
- [ ] Supabase: `URL`, `anon key`, `service role`, `JWT settings`.
- [ ] Google OAuth: `client id`, `client secret`, `redirect URIs`.
- [ ] YooKassa: `shop id`, `secret key`, `webhook secret`.

## 2) Activation infra réelle
- [ ] Exécuter les migrations SQL sur l’instance Supabase réelle.
- [ ] Vérifier schéma final: `profiles`, `settings`, `blocks`, `reports`, `payments/entitlements`.
- [ ] Confirmer RLS/politiques minimales côté tables sensibles.

## 3) Paiement réel de bout en bout
- [ ] Activer webhook callback en environnement réel.
- [ ] Vérifier signature webhook + idempotence.
- [ ] Vérifier attribution d’entitlement backend après paiement validé.
- [ ] Vérifier expiration/état final côté frontend (Boost/entitlements).

## 4) Sécurité routes protégées
- [ ] Vérifier toutes les protected routes frontend.
- [ ] Vérifier redirection `from` sur login/callback.
- [ ] Vérifier comportement session expirée + refresh + fallback.

## 5) QA E2E Wave A (obligatoire)
- [ ] Auth: signup/login/password, magic link, Google OAuth, logout.
- [ ] Onboarding: reprise draft, retry API, submit final, retour sans régression.
- [ ] Profile/Settings: lecture/écriture, erreurs API, retry, blocked list.
- [ ] Safety: block/unblock/report depuis liste messages + chat ouvert.
- [ ] Boost checkout: redirection PSP, polling statut, état erreur/retry.

## 6) Observabilité minimale
- [ ] Brancher Sentry (frontend + backend).
- [ ] Logs runtime backend exploitables en prod/staging.
- [ ] Traces de base pour auth, onboarding submit, payment webhook.

## 7) Go/No-Go release Wave A
- [ ] Aucun bug P1 ouvert.
- [ ] Pas de régression P2 bloquante sur mobile.
- [ ] Smoke test desktop + mobile validé.
- [ ] Plan rollback documenté (build précédent + variables).
- [ ] Validation finale “Wave A = DONE”.

## Définition de terminé (Wave A)
Wave A est terminée quand toutes les cases ci-dessus sont cochées en environnement réel (pas uniquement local/mock).
