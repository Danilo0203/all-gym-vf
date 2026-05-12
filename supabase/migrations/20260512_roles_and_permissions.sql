-- =============================================================================
-- MIGRATION: Roles & Permissions System
-- =============================================================================
-- Creates internal roles, permission catalog, and role-permission assignments.
-- Updates cash module and RLS policies to use permission-based checks.
-- Backfills existing users and promotes one admin to owner.

-- =============================================================================
-- 1. ROLES TABLE
-- =============================================================================
create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  scope text not null check (scope in ('panel', 'client')),
  is_system boolean not null default false,
  is_protected boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Trigger to auto-update updated_at
create or replace function public.roles_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists roles_set_updated_at_trigger on public.roles;
create trigger roles_set_updated_at_trigger
  before update on public.roles
  for each row
  execute function public.roles_set_updated_at();

alter table public.roles enable row level security;

-- =============================================================================
-- 2. PERMISSIONS CATALOG TABLE
-- =============================================================================
create table if not exists public.permissions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  description text,
  module text not null,
  action text not null,
  created_at timestamptz not null default now()
);

alter table public.permissions enable row level security;

-- =============================================================================
-- 3. ROLE-PERMISSION PIVOT TABLE
-- =============================================================================
create table if not exists public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role_id, permission_id)
);

alter table public.role_permissions enable row level security;

-- =============================================================================
-- 4. INDEXES
-- =============================================================================
create index if not exists roles_scope_idx on public.roles(scope);
create index if not exists permissions_module_idx on public.permissions(module);
create index if not exists role_permissions_role_id_idx on public.role_permissions(role_id);
create index if not exists role_permissions_permission_id_idx on public.role_permissions(permission_id);

-- =============================================================================
-- 5. SEED ROLES
-- =============================================================================
insert into public.roles (slug, name, scope, is_system, is_protected)
values
  ('owner',   'Propietario',    'panel',  true, true),
  ('admin',   'Administrador',  'panel',  true, false),
  ('trainer', 'Entrenador',     'panel',  true, false),
  ('employee','Empleado',       'panel',  true, false),
  ('client',  'Cliente',        'client', true, true)
on conflict (slug) do nothing;

-- =============================================================================
-- 6. SEED PERMISSION CATALOG (v1)
-- =============================================================================
insert into public.permissions (key, description, module, action)
values
  -- Roles
  ('roles.view',            'Ver roles',                       'roles',    'view'),
  ('roles.create',          'Crear roles',                     'roles',    'create'),
  ('roles.update',          'Editar roles',                    'roles',    'update'),
  ('roles.delete',          'Eliminar roles',                  'roles',    'delete'),
  -- Users
  ('users.view',            'Ver usuarios',                    'users',    'view'),
  ('users.create',          'Crear usuarios',                  'users',    'create'),
  ('users.update',          'Editar usuarios',                 'users',    'update'),
  ('users.delete',          'Eliminar usuarios',               'users',    'delete'),
  -- Plans
  ('plans.view',            'Ver planes',                      'plans',    'view'),
  ('plans.create',          'Crear planes',                    'plans',    'create'),
  ('plans.update',          'Editar planes',                   'plans',    'update'),
  ('plans.delete',          'Eliminar planes',                 'plans',    'delete'),
  -- Payments
  ('payments.view',         'Ver pagos',                       'payments', 'view'),
  -- Attendance
  ('attendance.view',       'Ver asistencias',                 'attendance','view'),
  -- Routines
  ('routines.view',         'Ver rutinas',                     'routines', 'view'),
  -- Exercises
  ('exercises.view',        'Ver ejercicios',                  'exercises','view'),
  ('exercises.create',      'Crear ejercicios',                'exercises','create'),
  ('exercises.update',      'Editar ejercicios',               'exercises','update'),
  ('exercises.delete',      'Eliminar ejercicios',             'exercises','delete'),
  -- Cash
  ('cash.view',             'Ver caja',                        'cash',     'view'),
  ('cash.operate',          'Operar caja (abrir/cerrar/movimientos)', 'cash','operate'),
  ('cash.reverse_payment',  'Revertir pagos',                  'cash',     'reverse_payment'),
  -- Customers
  ('customers.view',              'Ver clientes',              'customers','view'),
  ('customers.create',            'Crear clientes',            'customers','create'),
  ('customers.update',            'Editar clientes',           'customers','update'),
  ('customers.manage_membership', 'Gestionar membresías',      'customers','manage_membership'),
  ('customers.manage_routine',    'Gestionar rutinas',         'customers','manage_routine'),
  -- Dashboard
  ('dashboard.view',        'Ver tablero',                     'dashboard','view'),
  -- Profile
  ('profile.view',          'Ver perfil propio',               'profile',  'view'),
  ('profile.update',        'Editar perfil propio',            'profile',  'update')
on conflict (key) do nothing;

-- =============================================================================
-- 7. ASSIGN PERMISSIONS TO ROLES
-- =============================================================================
do $$
declare
  v_owner_id    uuid;
  v_admin_id    uuid;
  v_trainer_id  uuid;
  v_employee_id uuid;
begin
  select id into v_owner_id    from public.roles where slug = 'owner';
  select id into v_admin_id    from public.roles where slug = 'admin';
  select id into v_trainer_id  from public.roles where slug = 'trainer';
  select id into v_employee_id from public.roles where slug = 'employee';

  -- Owner: ALL permissions
  insert into public.role_permissions (role_id, permission_id)
  select v_owner_id, p.id
  from public.permissions p
  where not exists (
    select 1 from public.role_permissions rp
    where rp.role_id = v_owner_id and rp.permission_id = p.id
  );

  -- Admin: ALL permissions by default (editable)
  insert into public.role_permissions (role_id, permission_id)
  select v_admin_id, p.id
  from public.permissions p
  where not exists (
    select 1 from public.role_permissions rp
    where rp.role_id = v_admin_id and rp.permission_id = p.id
  );

  -- Trainer: limited permissions
  insert into public.role_permissions (role_id, permission_id)
  select v_trainer_id, p.id
  from public.permissions p
  where p.key in (
    'dashboard.view',
    'customers.view',
    'attendance.view',
    'routines.view',
    'exercises.view',
    'profile.view',
    'profile.update'
  )
  and not exists (
    select 1 from public.role_permissions rp
    where rp.role_id = v_trainer_id and rp.permission_id = p.id
  );

  -- Employee: cash + customer ops + basic access
  insert into public.role_permissions (role_id, permission_id)
  select v_employee_id, p.id
  from public.permissions p
  where p.key in (
    'dashboard.view',
    'customers.view',
    'customers.create',
    'customers.manage_membership',
    'cash.view',
    'cash.operate',
    'attendance.view',
    'payments.view',
    'profile.view',
    'profile.update'
  )
  and not exists (
    select 1 from public.role_permissions rp
    where rp.role_id = v_employee_id and rp.permission_id = p.id
  );
end $$;

-- =============================================================================
-- 8. SQL HELPERS
-- =============================================================================

-- Returns the role slug for the authenticated user (via auth.uid())
create or replace function public.get_current_role_slug()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select r.slug
  from public.profiles p
  join public.roles r on r.slug = p.role
  where p.id = auth.uid()
$$;

-- Returns true if the authenticated user is the owner
create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p.role = 'owner'
  from public.profiles p
  where p.id = auth.uid()
$$;

-- Checks if the authenticated user has a specific permission (or is owner)
create or replace function public.has_permission(p_permission_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.role_permissions rp
    join public.permissions perm on perm.id = rp.permission_id
    join public.profiles prof on prof.role = (
      select r.slug from public.roles r where r.id = rp.role_id
    )
    where prof.id = auth.uid()
      and perm.key = p_permission_key
  )
  or public.is_owner()
$$;

-- Returns all permission keys for the authenticated user
create or replace function public.get_current_permissions()
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(perm.key order by perm.key), '{}')
  from public.role_permissions rp
  join public.permissions perm on perm.id = rp.permission_id
  join public.roles r on r.id = rp.role_id
  join public.profiles p on p.role = r.slug
  where p.id = auth.uid()
$$;

-- =============================================================================
-- 9. UPDATE CASH MODULE SQL FUNCTIONS
-- =============================================================================

-- Updated require_cash_operator: uses permission check
create or replace function public.require_cash_operator(p_user_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  if p_user_id is null then
    raise exception 'Usuario no autenticado';
  end if;

  v_role := public.get_profile_role(p_user_id);

  if v_role is null then
    raise exception 'Perfil no encontrado';
  end if;

  -- Owner bypasses all checks
  if v_role = 'owner' then
    return v_role;
  end if;

  -- Check for cash.operate permission
  if not exists (
    select 1
    from public.role_permissions rp
    join public.permissions perm on perm.id = rp.permission_id
    join public.roles r on r.id = rp.role_id
    where r.slug = v_role
      and perm.key = 'cash.operate'
  ) then
    raise exception 'No autorizado para operar caja';
  end if;

  return v_role;
end;
$$;

-- Updated close_cash_session: permission-based session ownership check
create or replace function public.close_cash_session(
  p_session_id uuid,
  p_counted_amount numeric(12,2),
  p_notes text default null
)
returns public.cash_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_role text;
  v_session public.cash_sessions%rowtype;
  v_expected_amount numeric(12,2);
  v_difference_amount numeric(12,2);
begin
  v_user_id := auth.uid();
  v_role := public.require_cash_operator(v_user_id);

  if p_counted_amount is null or p_counted_amount < 0 then
    raise exception 'Debe ingresar el monto contado';
  end if;

  select *
  into v_session
  from public.cash_sessions
  where id = p_session_id
  for update;

  if not found then
    raise exception 'Sesión de caja no encontrada';
  end if;

  if v_session.status <> 'open' then
    raise exception 'La sesión ya no está abierta';
  end if;

  -- Only session owner or users with cash.reverse_payment (admin-level) can close
  if v_session.opened_by_user_id <> v_user_id then
    if v_role <> 'owner' and not exists (
      select 1
      from public.role_permissions rp
      join public.permissions perm on perm.id = rp.permission_id
      join public.roles r on r.id = rp.role_id
      where r.slug = v_role
        and perm.key = 'cash.reverse_payment'
    ) then
      raise exception 'No autorizado para cerrar esta sesión';
    end if;
  end if;

  select
    v_session.opening_amount + coalesce(sum(cm.cash_effect_amount), 0)
  into v_expected_amount
  from public.cash_movements cm
  where cm.cash_session_id = v_session.id
    and cm.session_link_status = 'assigned'
    and cm.voided_at is null;

  v_difference_amount := p_counted_amount - v_expected_amount;

  if v_difference_amount <> 0 and nullif(trim(coalesce(p_notes, '')), '') is null then
    raise exception 'Debe agregar una observación cuando exista diferencia';
  end if;

  update public.cash_sessions
  set closed_by_user_id = v_user_id,
      closed_at = now(),
      expected_amount = v_expected_amount,
      counted_amount = p_counted_amount,
      difference_amount = v_difference_amount,
      status = case
        when v_difference_amount = 0 then 'closed'
        else 'closed_with_difference'
      end,
      notes = case
        when v_difference_amount = 0 then v_session.notes
        else nullif(trim(coalesce(p_notes, '')), '')
      end
  where id = v_session.id
  returning *
  into v_session;

  return v_session;
end;
$$;

-- Updated record_manual_cash_movement: permission-based session ownership
create or replace function public.record_manual_cash_movement(
  p_session_id uuid,
  p_movement_type text,
  p_category text,
  p_amount numeric(12,2),
  p_payment_method text default null,
  p_note text default null,
  p_customer_id uuid default null,
  p_cash_effect_amount numeric(12,2) default null
)
returns public.cash_movements
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_role text;
  v_session public.cash_sessions%rowtype;
  v_cash_effect numeric(12,2);
  v_payment_method text;
  v_movement public.cash_movements%rowtype;
begin
  v_user_id := auth.uid();
  v_role := public.require_cash_operator(v_user_id);

  if p_movement_type not in ('manual_income', 'withdrawal', 'refund', 'adjustment') then
    raise exception 'Tipo de movimiento manual inválido';
  end if;

  if p_category not in ('membership', 'product', 'enrollment', 'service', 'other') then
    raise exception 'Categoría inválida';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'El monto debe ser mayor a 0';
  end if;

  if p_payment_method is not null and p_payment_method not in ('cash', 'card', 'transfer') then
    raise exception 'Método de pago inválido';
  end if;

  select *
  into v_session
  from public.cash_sessions
  where id = p_session_id
  for update;

  if not found then
    raise exception 'Sesión de caja no encontrada';
  end if;

  if v_session.status <> 'open' then
    raise exception 'No se pueden registrar movimientos sobre una caja cerrada';
  end if;

  -- Session owner OR users with cash.reverse_payment can operate
  if v_session.opened_by_user_id <> v_user_id then
    if v_role <> 'owner' and not exists (
      select 1
      from public.role_permissions rp
      join public.permissions perm on perm.id = rp.permission_id
      join public.roles r on r.id = rp.role_id
      where r.slug = v_role
        and perm.key = 'cash.reverse_payment'
    ) then
      raise exception 'No autorizado para registrar movimientos en esta caja';
    end if;
  end if;

  if p_movement_type = 'manual_income' then
    v_cash_effect := p_amount;
    v_payment_method := coalesce(p_payment_method, 'cash');
  elsif p_movement_type = 'withdrawal' then
    v_cash_effect := p_amount * -1;
    v_payment_method := coalesce(p_payment_method, 'cash');
  elsif p_movement_type = 'refund' then
    v_payment_method := coalesce(p_payment_method, 'cash');
    v_cash_effect := case when v_payment_method = 'cash' then p_amount * -1 else 0 end;
  else
    if p_cash_effect_amount is null or p_cash_effect_amount = 0 then
      raise exception 'Los ajustes requieren cash_effect_amount firmado';
    end if;

    if abs(p_cash_effect_amount) <> p_amount then
      raise exception 'En ajustes, amount debe coincidir con el valor absoluto de cash_effect_amount';
    end if;

    v_cash_effect := p_cash_effect_amount;
    v_payment_method := p_payment_method;
  end if;

  insert into public.cash_movements (
    cash_session_id,
    movement_type,
    category,
    payment_method,
    amount,
    cash_effect_amount,
    session_link_status,
    origin,
    customer_id,
    created_by_user_id,
    note
  )
  values (
    v_session.id,
    p_movement_type,
    p_category,
    v_payment_method,
    p_amount,
    v_cash_effect,
    'assigned',
    'manual',
    p_customer_id,
    v_user_id,
    nullif(trim(coalesce(p_note, '')), '')
  )
  returning *
  into v_movement;

  return v_movement;
end;
$$;

-- Updated attach_payment_to_cash: permission-based
create or replace function public.attach_payment_to_cash(
  p_payment_id uuid,
  p_actor_user_id uuid default null,
  p_source_category text default 'membership',
  p_note text default null
)
returns public.cash_movements
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request_user_id uuid;
  v_actor_user_id uuid;
  v_role text;
  v_payment public.payments%rowtype;
  v_existing_movement public.cash_movements%rowtype;
  v_session public.cash_sessions%rowtype;
  v_movement public.cash_movements%rowtype;
  v_cash_effect numeric(12,2);
begin
  v_request_user_id := auth.uid();
  v_role := public.require_cash_operator(v_request_user_id);
  v_actor_user_id := coalesce(p_actor_user_id, v_request_user_id);

  -- Only users with cash.reverse_payment (admin-level) or acting on own session
  if v_role <> 'owner' and v_actor_user_id <> v_request_user_id then
    if not exists (
      select 1
      from public.role_permissions rp
      join public.permissions perm on perm.id = rp.permission_id
      join public.roles r on r.id = rp.role_id
      where r.slug = v_role
        and perm.key = 'cash.reverse_payment'
    ) then
      raise exception 'No autorizado para asignar pagos a otra caja';
    end if;
  end if;

  if p_source_category not in ('membership', 'product', 'enrollment', 'service', 'other') then
    raise exception 'Categoría inválida';
  end if;

  select *
  into v_existing_movement
  from public.cash_movements
  where source_payment_id = p_payment_id;

  if found then
    return v_existing_movement;
  end if;

  select *
  into v_payment
  from public.payments
  where id = p_payment_id;

  if not found then
    raise exception 'Pago no encontrado';
  end if;

  if v_payment.status <> 'posted' then
    raise exception 'Solo se pueden asociar pagos publicados';
  end if;

  select *
  into v_session
  from public.find_open_cash_session_for_user(v_actor_user_id);

  v_cash_effect := case
    when v_payment.method = 'cash' then v_payment.amount_paid
    else 0
  end;

  insert into public.cash_movements (
    cash_session_id,
    movement_type,
    category,
    payment_method,
    amount,
    cash_effect_amount,
    session_link_status,
    origin,
    source_payment_id,
    source_subscription_id,
    customer_id,
    created_by_user_id,
    note
  )
  values (
    v_session.id,
    'sale',
    p_source_category,
    v_payment.method,
    v_payment.amount_paid,
    v_cash_effect,
    case when v_session.id is null then 'out_of_session' else 'assigned' end,
    'system',
    v_payment.id,
    v_payment.subscription_id,
    v_payment.user_id,
    v_actor_user_id,
    nullif(trim(coalesce(p_note, '')), '')
  )
  returning *
  into v_movement;

  return v_movement;
end;
$$;

-- Updated create_subscription_payment_for_existing_customer: uses customers.manage_membership
create or replace function public.create_subscription_payment_for_existing_customer(
  p_customer_id uuid,
  p_plan_id integer default null,
  p_start_date date default null,
  p_end_date date default null,
  p_final_price numeric(12,2) default null,
  p_discount_amount numeric(12,2) default 0,
  p_payment_method text default 'cash',
  p_created_by_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request_user_id uuid;
  v_role text;
  v_created_by_user_id uuid;
  v_plan public.plans%rowtype;
  v_subscription_id uuid;
  v_payment_id uuid;
  v_movement public.cash_movements%rowtype;
  v_start_date date;
  v_end_date date;
  v_amount_original numeric(12,2);
  v_amount_paid numeric(12,2);
begin
  v_request_user_id := auth.uid();
  v_role := public.require_cash_operator(v_request_user_id);

  -- Check for customers.manage_membership permission (or owner)
  if v_role <> 'owner' and not exists (
    select 1
    from public.role_permissions rp
    join public.permissions perm on perm.id = rp.permission_id
    join public.roles r on r.id = rp.role_id
    where r.slug = v_role
      and perm.key = 'customers.manage_membership'
  ) then
    raise exception 'Solo administradores pueden registrar altas con pago';
  end if;

  v_created_by_user_id := coalesce(p_created_by_user_id, v_request_user_id);

  if p_plan_id is null then
    return jsonb_build_object(
      'subscription_id', null,
      'payment_id', null,
      'cash_movement_id', null,
      'session_link_status', null
    );
  end if;

  if p_payment_method not in ('cash', 'card', 'transfer') then
    raise exception 'Método de pago inválido';
  end if;

  select *
  into v_plan
  from public.plans
  where id = p_plan_id;

  if not found then
    raise exception 'Plan no encontrado';
  end if;

  v_start_date := coalesce(p_start_date, timezone('America/Guatemala', now())::date);
  v_end_date := coalesce(p_end_date, (v_start_date + coalesce(v_plan.duration_days, 30)));
  v_amount_original := v_plan.price;
  v_amount_paid := coalesce(p_final_price, v_amount_original - coalesce(p_discount_amount, 0));

  insert into public.subscriptions (
    user_id,
    plan_id,
    start_date,
    end_date,
    status,
    discount_amount
  )
  values (
    p_customer_id,
    p_plan_id,
    v_start_date,
    v_end_date,
    'active',
    coalesce(p_discount_amount, 0)
  )
  returning id
  into v_subscription_id;

  insert into public.payments (
    subscription_id,
    user_id,
    amount_original,
    discount_amount,
    amount_paid,
    method,
    payment_date,
    created_by_user_id,
    status
  )
  values (
    v_subscription_id,
    p_customer_id,
    v_amount_original,
    coalesce(p_discount_amount, 0),
    v_amount_paid,
    p_payment_method,
    now(),
    v_created_by_user_id,
    'posted'
  )
  returning id
  into v_payment_id;

  select *
  into v_movement
  from public.attach_payment_to_cash(
    v_payment_id,
    v_created_by_user_id,
    'membership',
    null
  );

  return jsonb_build_object(
    'subscription_id', v_subscription_id,
    'payment_id', v_payment_id,
    'cash_movement_id', v_movement.id,
    'session_link_status', v_movement.session_link_status
  );
end;
$$;

-- Updated reverse_and_recreate_payment: uses cash.reverse_payment permission
create or replace function public.reverse_and_recreate_payment(
  p_payment_id uuid,
  p_amount_original numeric(12,2),
  p_discount_amount numeric(12,2),
  p_amount_paid numeric(12,2),
  p_payment_method text,
  p_reason text,
  p_source_category text default 'membership',
  p_note text default null,
  p_actor_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request_user_id uuid;
  v_role text;
  v_actor_user_id uuid;
  v_original_payment public.payments%rowtype;
  v_reversal_movement public.cash_movements%rowtype;
  v_replacement_movement public.cash_movements%rowtype;
  v_replacement_payment_id uuid;
begin
  v_request_user_id := auth.uid();
  v_role := public.require_cash_operator(v_request_user_id);

  -- Check for cash.reverse_payment permission (or owner)
  if v_role <> 'owner' and not exists (
    select 1
    from public.role_permissions rp
    join public.permissions perm on perm.id = rp.permission_id
    join public.roles r on r.id = rp.role_id
    where r.slug = v_role
      and perm.key = 'cash.reverse_payment'
  ) then
    raise exception 'Solo administradores pueden revertir pagos';
  end if;

  v_actor_user_id := coalesce(p_actor_user_id, v_request_user_id);

  if p_payment_method not in ('cash', 'card', 'transfer') then
    raise exception 'Método de pago inválido';
  end if;

  if p_source_category not in ('membership', 'product', 'enrollment', 'service', 'other') then
    raise exception 'Categoría inválida';
  end if;

  if nullif(trim(coalesce(p_reason, '')), '') is null then
    raise exception 'Debe indicar el motivo del reverso';
  end if;

  select *
  into v_original_payment
  from public.payments
  where id = p_payment_id
  for update;

  if not found then
    raise exception 'Pago no encontrado';
  end if;

  if v_original_payment.status <> 'posted' then
    raise exception 'Solo se pueden revertir pagos publicados';
  end if;

  select *
  into v_reversal_movement
  from public.insert_reversal_cash_movement(
    p_payment_id,
    v_actor_user_id,
    p_source_category,
    coalesce(p_note, format('Reverso administrativo del pago %s', p_payment_id))
  );

  insert into public.payments (
    subscription_id,
    user_id,
    amount_original,
    discount_amount,
    amount_paid,
    method,
    payment_date,
    created_by_user_id,
    status
  )
  values (
    v_original_payment.subscription_id,
    v_original_payment.user_id,
    p_amount_original,
    coalesce(p_discount_amount, 0),
    p_amount_paid,
    p_payment_method,
    now(),
    v_actor_user_id,
    'posted'
  )
  returning id
  into v_replacement_payment_id;

  update public.payments
  set status = 'reversed',
      reversed_at = now(),
      reversed_by_user_id = v_actor_user_id,
      replacement_payment_id = v_replacement_payment_id,
      reversal_reason = nullif(trim(coalesce(p_reason, '')), '')
  where id = p_payment_id;

  select *
  into v_replacement_movement
  from public.attach_payment_to_cash(
    v_replacement_payment_id,
    v_actor_user_id,
    p_source_category,
    p_note
  );

  return jsonb_build_object(
    'reversed_payment_id', p_payment_id,
    'replacement_payment_id', v_replacement_payment_id,
    'reversal_movement_id', v_reversal_movement.id,
    'replacement_movement_id', v_replacement_movement.id
  );
end;
$$;

-- =============================================================================
-- 10. UPDATE RLS POLICIES
-- =============================================================================

-- Training profiles: was p.role = 'admin', now uses permission or owner
drop policy if exists training_profiles_admin_all on public.training_profiles;
create policy training_profiles_admin_all on public.training_profiles
  for all
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and (
          p.role = 'owner'
          or exists (
            select 1
            from public.role_permissions rp
            join public.permissions perm on perm.id = rp.permission_id
            join public.roles r on r.id = rp.role_id
            where r.slug = p.role
              and perm.key = 'customers.manage_routine'
          )
        )
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and (
          p.role = 'owner'
          or exists (
            select 1
            from public.role_permissions rp
            join public.permissions perm on perm.id = rp.permission_id
            join public.roles r on r.id = rp.role_id
            where r.slug = p.role
              and perm.key = 'customers.manage_routine'
          )
        )
    )
  );

-- Routine blueprints: was p.role in ('admin', 'trainer'), now uses routines.view
drop policy if exists routine_blueprints_admin_trainer_all on public.routine_blueprints;
create policy routine_blueprints_admin_trainer_all on public.routine_blueprints
  for all
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and (
          p.role = 'owner'
          or exists (
            select 1
            from public.role_permissions rp
            join public.permissions perm on perm.id = rp.permission_id
            join public.roles r on r.id = rp.role_id
            where r.slug = p.role
              and perm.key = 'routines.view'
          )
        )
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and (
          p.role = 'owner'
          or exists (
            select 1
            from public.role_permissions rp
            join public.permissions perm on perm.id = rp.permission_id
            join public.roles r on r.id = rp.role_id
            where r.slug = p.role
              and perm.key = 'routines.view'
          )
        )
    )
  );

drop policy if exists routine_blueprint_details_admin_trainer_all on public.routine_blueprint_details;
create policy routine_blueprint_details_admin_trainer_all on public.routine_blueprint_details
  for all
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and (
          p.role = 'owner'
          or exists (
            select 1
            from public.role_permissions rp
            join public.permissions perm on perm.id = rp.permission_id
            join public.roles r on r.id = rp.role_id
            where r.slug = p.role
              and perm.key = 'routines.view'
          )
        )
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and (
          p.role = 'owner'
          or exists (
            select 1
            from public.role_permissions rp
            join public.permissions perm on perm.id = rp.permission_id
            join public.roles r on r.id = rp.role_id
            where r.slug = p.role
              and perm.key = 'routines.view'
          )
        )
    )
  );

drop policy if exists routine_blueprint_assignments_admin_trainer_all on public.routine_blueprint_assignments;
create policy routine_blueprint_assignments_admin_trainer_all on public.routine_blueprint_assignments
  for all
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and (
          p.role = 'owner'
          or exists (
            select 1
            from public.role_permissions rp
            join public.permissions perm on perm.id = rp.permission_id
            join public.roles r on r.id = rp.role_id
            where r.slug = p.role
              and perm.key = 'routines.view'
          )
        )
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and (
          p.role = 'owner'
          or exists (
            select 1
            from public.role_permissions rp
            join public.permissions perm on perm.id = rp.permission_id
            join public.roles r on r.id = rp.role_id
            where r.slug = p.role
              and perm.key = 'routines.view'
          )
        )
    )
  );

-- =============================================================================
-- 11. RLS POLICIES FOR NEW TABLES
-- =============================================================================

-- Roles: internal users can view; only users with roles.* permissions can modify
create policy roles_view_all on public.roles
  for select
  using (
    exists (
      select 1 from public.profiles p
      join public.roles r on r.slug = p.role
      where p.id = auth.uid()
        and r.scope = 'panel'
    )
  );

create policy roles_insert_admin on public.roles
  for insert
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and (
          p.role = 'owner'
          or exists (
            select 1 from public.role_permissions rp
            join public.permissions perm on perm.id = rp.permission_id
            join public.roles r on r.id = rp.role_id
            where r.slug = p.role and perm.key = 'roles.create'
          )
        )
    )
  );

create policy roles_update_admin on public.roles
  for update
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and (
          p.role = 'owner'
          or exists (
            select 1 from public.role_permissions rp
            join public.permissions perm on perm.id = rp.permission_id
            join public.roles r on r.id = rp.role_id
            where r.slug = p.role and perm.key = 'roles.update'
          )
        )
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and (
          p.role = 'owner'
          or exists (
            select 1 from public.role_permissions rp
            join public.permissions perm on perm.id = rp.permission_id
            join public.roles r on r.id = rp.role_id
            where r.slug = p.role and perm.key = 'roles.update'
          )
        )
    )
  );

create policy roles_delete_admin on public.roles
  for delete
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and (
          p.role = 'owner'
          or exists (
            select 1 from public.role_permissions rp
            join public.permissions perm on perm.id = rp.permission_id
            join public.roles r on r.id = rp.role_id
            where r.slug = p.role and perm.key = 'roles.delete'
          )
        )
    )
  );

-- Permissions: internal users can view; only owner can modify catalog
create policy permissions_view_panel on public.permissions
  for select
  using (
    exists (
      select 1 from public.profiles p
      join public.roles r on r.slug = p.role
      where p.id = auth.uid()
        and r.scope = 'panel'
    )
  );

-- Role permissions: internal users can view; users with roles.update can modify
create policy role_permissions_view_panel on public.role_permissions
  for select
  using (
    exists (
      select 1 from public.profiles p
      join public.roles r on r.slug = p.role
      where p.id = auth.uid()
        and r.scope = 'panel'
    )
  );

create policy role_permissions_insert_admin on public.role_permissions
  for insert
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and (
          p.role = 'owner'
          or exists (
            select 1 from public.role_permissions rp
            join public.permissions perm on perm.id = rp.permission_id
            join public.roles r on r.id = rp.role_id
            where r.slug = p.role and perm.key = 'roles.update'
          )
        )
    )
  );

create policy role_permissions_delete_admin on public.role_permissions
  for delete
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and (
          p.role = 'owner'
          or exists (
            select 1 from public.role_permissions rp
            join public.permissions perm on perm.id = rp.permission_id
            join public.roles r on r.id = rp.role_id
            where r.slug = p.role and perm.key = 'roles.update'
          )
        )
    )
  );

-- =============================================================================
-- 12. GRANTS
-- =============================================================================
grant execute on function public.get_current_role_slug() to authenticated;
grant execute on function public.is_owner() to authenticated;
grant execute on function public.has_permission(text) to authenticated;
grant execute on function public.get_current_permissions() to authenticated;

-- Re-grant updated cash functions (ensure authenticated can still execute)
grant execute on function public.open_cash_session(uuid, numeric, text) to authenticated;
grant execute on function public.close_cash_session(uuid, numeric, text) to authenticated;
grant execute on function public.record_manual_cash_movement(uuid, text, text, numeric, text, text, uuid, numeric) to authenticated;
grant execute on function public.attach_payment_to_cash(uuid, uuid, text, text) to authenticated;
grant execute on function public.create_subscription_payment_for_existing_customer(uuid, integer, date, date, numeric, numeric, text, uuid) to authenticated;
grant execute on function public.renew_subscription_with_payment(uuid, integer, date, date, numeric, numeric, numeric, text, uuid) to authenticated;
grant execute on function public.reverse_and_recreate_payment(uuid, numeric, numeric, numeric, text, text, text, text, uuid) to authenticated;

-- =============================================================================
-- 13. BACKFILL: Add missing role_protection to profiles (no change needed for role column)
--     Profiles already store the role slug in the `role` column.
--     The roles table now holds the authoritative role definitions.
--     To promote an existing admin to owner, run:
--
--     UPDATE public.profiles SET role = 'owner'
--     WHERE id = '<put-admin-user-uuid-here>';
--
--     Make sure the admin user exists and currently has role = 'admin'.
-- =============================================================================
