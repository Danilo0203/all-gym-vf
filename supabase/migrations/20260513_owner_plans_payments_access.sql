-- Keep owner aligned with app permissions for finance and plan screens.

drop policy if exists "Admins can view all plans" on public.plans;
create policy "Admins can view all plans"
  on public.plans
  for select
  using (
    get_my_role() = any (array['admin'::user_role, 'owner'::user_role])
  );

drop policy if exists "Only admins can manage plans" on public.plans;
create policy "Only admins can manage plans"
  on public.plans
  for all
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = any (array['admin'::user_role, 'owner'::user_role])
    )
  );

drop policy if exists "Users can view own payments and admins can view all" on public.payments;
create policy "Users can view own payments and admins can view all"
  on public.payments
  for select
  using (
    user_id = auth.uid()
    or get_my_role() = any (array['admin'::user_role, 'owner'::user_role])
  );
