# DETTE - DONNEES

Date: 2026-04-06

- Remplacer la persistence locale mock restante par backend source-of-truth.
- Appliquer les migrations Supabase en production dans l'ordre:
  - `backend/supabase/migrations/20260406_000001_profiles_settings.sql`
  - `backend/supabase/migrations/20260406_000002_onboarding_v1_fields.sql`
  - `backend/supabase/migrations/20260406_000003_payments_entitlements.sql`
  - `backend/supabase/migrations/20260406_000004_chat_safety.sql`
  - `backend/supabase/migrations/20260406_000005_wave_b_security_baseline.sql`
- Verifier le schema final:
  - `profiles`, `settings`, `chat_conversations`, `chat_messages`
  - `safety_blocks`, `safety_reports`
  - `payments_checkouts`, `user_entitlements`
- Dette RLS/roles:
  - auditer que les policies sont strictement scopees par `auth.uid()`
  - confirmer zero ecriture directe `anon/authenticated` sur tables server-owned
- Dette de modelisation `user_id`:
  - unifier le type (`uuid` vs `text`) sur toutes les tables metier
  - planifier migration + retrocompatibilite backend
- Dette referentielle:
  - ajouter FK manquantes sur paiements/entitlements/securite apres unification de `user_id`
- Dette de validation runtime:
  - completer les checks d'expiration entitlement (edges temporels)
  - ajouter checks post-migration (tables, policies, indexes, triggers `updated_at`)
