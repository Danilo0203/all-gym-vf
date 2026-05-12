-- Allow owner to read customer data through RLS-backed views.

drop policy if exists "Admins can view all profiles" on public.profiles;
create policy "Admins can view all profiles"
  on public.profiles
  for select
  using (
    get_my_role() = any (array['admin'::user_role, 'owner'::user_role])
  );

drop policy if exists "Staff can view client profiles" on public.profiles;
create policy "Staff can view client profiles"
  on public.profiles
  for select
  using (
    get_my_role() = any (array['admin'::user_role, 'trainer'::user_role, 'employee'::user_role, 'owner'::user_role])
    and role = 'client'::user_role
  );

drop policy if exists "Admins can update any profile" on public.profiles;
create policy "Admins can update any profile"
  on public.profiles
  for update
  using (
    get_my_role() = any (array['admin'::user_role, 'owner'::user_role])
  )
  with check (
    get_my_role() = any (array['admin'::user_role, 'owner'::user_role])
  );

drop policy if exists "Only admins can manage subscriptions" on public.subscriptions;
create policy "Only admins can manage subscriptions"
  on public.subscriptions
  for all
  using (
    get_my_role() = any (array['admin'::user_role, 'owner'::user_role])
  )
  with check (
    get_my_role() = any (array['admin'::user_role, 'owner'::user_role])
  );

drop policy if exists "Users can view own subscriptions" on public.subscriptions;
create policy "Users can view own subscriptions"
  on public.subscriptions
  for select
  using (
    user_id = auth.uid()
    or get_my_role() = any (array['admin'::user_role, 'trainer'::user_role, 'employee'::user_role, 'owner'::user_role])
  );
