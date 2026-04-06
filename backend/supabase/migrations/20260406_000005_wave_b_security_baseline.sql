-- Wave B security baseline:
-- - tighten grants on sensitive monetization/safety tables
-- - enforce RLS for authenticated reads only
-- - keep write-path server-owned via service-role microservices

alter table if exists public.payments_checkouts force row level security;
alter table if exists public.user_entitlements force row level security;
alter table if exists public.safety_blocks force row level security;
alter table if exists public.safety_reports force row level security;

revoke all on table public.payments_checkouts from anon, authenticated;
revoke all on table public.user_entitlements from anon, authenticated;
revoke all on table public.safety_blocks from anon, authenticated;
revoke all on table public.safety_reports from anon, authenticated;

grant select on table public.payments_checkouts to authenticated;
grant select on table public.user_entitlements to authenticated;
grant select on table public.safety_blocks to authenticated;
grant select on table public.safety_reports to authenticated;

drop policy if exists "payments_checkouts_select_own" on public.payments_checkouts;
create policy "payments_checkouts_select_own"
  on public.payments_checkouts
  for select
  to authenticated
  using (auth.uid()::text = user_id);

drop policy if exists "user_entitlements_select_own" on public.user_entitlements;
create policy "user_entitlements_select_own"
  on public.user_entitlements
  for select
  to authenticated
  using (auth.uid()::text = user_id);

drop policy if exists "safety_blocks_select_own" on public.safety_blocks;
create policy "safety_blocks_select_own"
  on public.safety_blocks
  for select
  to authenticated
  using (auth.uid()::text = user_id);

drop policy if exists "safety_reports_select_own" on public.safety_reports;
create policy "safety_reports_select_own"
  on public.safety_reports
  for select
  to authenticated
  using (auth.uid()::text = user_id);

