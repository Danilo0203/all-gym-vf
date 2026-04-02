create extension if not exists pgcrypto;

alter table public.payments
  add column if not exists created_by_user_id uuid references public.profiles(id) on delete set null,
  add column if not exists status text not null default 'posted',
  add column if not exists reversed_at timestamptz,
  add column if not exists reversed_by_user_id uuid references public.profiles(id) on delete set null,
  add column if not exists replacement_payment_id uuid references public.payments(id) on delete set null,
  add column if not exists reversal_reason text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'payments_status_check'
      and conrelid = 'public.payments'::regclass
  ) then
    alter table public.payments
      add constraint payments_status_check
      check (status in ('posted', 'reversed'));
  end if;
end $$;

create index if not exists payments_status_idx on public.payments(status);
create index if not exists payments_created_by_user_id_idx on public.payments(created_by_user_id);
create index if not exists payments_replacement_payment_id_idx on public.payments(replacement_payment_id);

create table if not exists public.cash_registers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.cash_sessions (
  id uuid primary key default gen_random_uuid(),
  session_number text not null unique,
  cash_register_id uuid not null references public.cash_registers(id) on delete restrict,
  opened_by_user_id uuid not null references public.profiles(id) on delete restrict,
  closed_by_user_id uuid references public.profiles(id) on delete set null,
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  opening_amount numeric(12,2) not null check (opening_amount >= 0),
  expected_amount numeric(12,2),
  counted_amount numeric(12,2),
  difference_amount numeric(12,2),
  status text not null,
  notes text,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'cash_sessions_status_check'
      and conrelid = 'public.cash_sessions'::regclass
  ) then
    alter table public.cash_sessions
      add constraint cash_sessions_status_check
      check (status in ('open', 'closed', 'closed_with_difference', 'cancelled'));
  end if;
end $$;

create unique index if not exists cash_sessions_opened_by_open_unique
  on public.cash_sessions(opened_by_user_id)
  where status = 'open';

create unique index if not exists cash_sessions_register_open_unique
  on public.cash_sessions(cash_register_id)
  where status = 'open';

create index if not exists cash_sessions_status_opened_at_idx
  on public.cash_sessions(status, opened_at desc);

create table if not exists public.cash_movements (
  id uuid primary key default gen_random_uuid(),
  cash_session_id uuid references public.cash_sessions(id) on delete set null,
  movement_type text not null,
  category text not null,
  payment_method text,
  amount numeric(12,2) not null check (amount > 0),
  cash_effect_amount numeric(12,2) not null,
  session_link_status text not null,
  origin text not null,
  source_payment_id uuid references public.payments(id) on delete set null,
  source_subscription_id uuid references public.subscriptions(id) on delete set null,
  customer_id uuid references public.profiles(id) on delete set null,
  created_by_user_id uuid not null references public.profiles(id) on delete restrict,
  note text,
  created_at timestamptz not null default now(),
  voided_at timestamptz,
  voided_by_user_id uuid references public.profiles(id) on delete set null
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'cash_movements_movement_type_check'
      and conrelid = 'public.cash_movements'::regclass
  ) then
    alter table public.cash_movements
      add constraint cash_movements_movement_type_check
      check (movement_type in ('sale', 'manual_income', 'withdrawal', 'refund', 'adjustment', 'void'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'cash_movements_category_check'
      and conrelid = 'public.cash_movements'::regclass
  ) then
    alter table public.cash_movements
      add constraint cash_movements_category_check
      check (category in ('membership', 'product', 'enrollment', 'service', 'other'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'cash_movements_payment_method_check'
      and conrelid = 'public.cash_movements'::regclass
  ) then
    alter table public.cash_movements
      add constraint cash_movements_payment_method_check
      check (payment_method is null or payment_method in ('cash', 'card', 'transfer'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'cash_movements_session_link_status_check'
      and conrelid = 'public.cash_movements'::regclass
  ) then
    alter table public.cash_movements
      add constraint cash_movements_session_link_status_check
      check (session_link_status in ('assigned', 'out_of_session'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'cash_movements_origin_check'
      and conrelid = 'public.cash_movements'::regclass
  ) then
    alter table public.cash_movements
      add constraint cash_movements_origin_check
      check (origin in ('system', 'manual'));
  end if;
end $$;

create unique index if not exists cash_movements_source_payment_unique
  on public.cash_movements(source_payment_id)
  where source_payment_id is not null;

create index if not exists cash_movements_session_created_at_idx
  on public.cash_movements(cash_session_id, created_at desc);

create index if not exists cash_movements_out_of_session_idx
  on public.cash_movements(session_link_status, created_at desc);

create index if not exists cash_movements_created_by_user_id_idx
  on public.cash_movements(created_by_user_id, created_at desc);

alter table public.cash_registers enable row level security;
alter table public.cash_sessions enable row level security;
alter table public.cash_movements enable row level security;

insert into public.cash_registers (name)
select 'Caja principal'
where not exists (
  select 1
  from public.cash_registers
  where name = 'Caja principal'
);

create or replace function public.get_profile_role(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.role
  from public.profiles p
  where p.id = p_user_id
$$;

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
  if v_role not in ('admin', 'employee') then
    raise exception 'No autorizado para operar caja';
  end if;

  return v_role;
end;
$$;

create or replace function public.build_cash_session_number()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_date_key text;
  v_next_number integer;
begin
  v_date_key := to_char(timezone('America/Guatemala', now()), 'YYYYMMDD');
  perform pg_advisory_xact_lock(hashtext('cash-session-' || v_date_key));

  select coalesce(
    max(
      substring(session_number from 'CJ-\d{8}-(\d{4})$')::integer
    ),
    0
  ) + 1
  into v_next_number
  from public.cash_sessions
  where session_number like ('CJ-' || v_date_key || '-%');

  return format('CJ-%s-%s', v_date_key, lpad(v_next_number::text, 4, '0'));
end;
$$;

create or replace function public.find_open_cash_session_for_user(p_user_id uuid)
returns public.cash_sessions
language sql
stable
security definer
set search_path = public
as $$
  select cs.*
  from public.cash_sessions cs
  where cs.opened_by_user_id = p_user_id
    and cs.status = 'open'
  order by cs.opened_at desc
  limit 1
$$;

create or replace function public.insert_reversal_cash_movement(
  p_payment_id uuid,
  p_actor_user_id uuid,
  p_category text,
  p_note text default null
)
returns public.cash_movements
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payments%rowtype;
  v_session public.cash_sessions%rowtype;
  v_category text;
  v_movement public.cash_movements%rowtype;
  v_cash_effect numeric(12,2);
begin
  select *
  into v_payment
  from public.payments
  where id = p_payment_id;

  if not found then
    raise exception 'Pago no encontrado';
  end if;

  v_category := coalesce(p_category, 'other');
  if v_category not in ('membership', 'product', 'enrollment', 'service', 'other') then
    raise exception 'Categoría inválida';
  end if;

  select *
  into v_session
  from public.find_open_cash_session_for_user(p_actor_user_id);

  v_cash_effect := case
    when v_payment.method = 'cash' then v_payment.amount_paid * -1
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
    source_subscription_id,
    customer_id,
    created_by_user_id,
    note
  )
  values (
    v_session.id,
    'void',
    v_category,
    v_payment.method,
    v_payment.amount_paid,
    v_cash_effect,
    case when v_session.id is null then 'out_of_session' else 'assigned' end,
    'system',
    v_payment.subscription_id,
    v_payment.user_id,
    p_actor_user_id,
    coalesce(p_note, format('Reverso del pago %s', p_payment_id))
  )
  returning *
  into v_movement;

  return v_movement;
end;
$$;

create or replace function public.open_cash_session(
  p_register_id uuid,
  p_opening_amount numeric(12,2),
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
begin
  v_user_id := auth.uid();
  v_role := public.require_cash_operator(v_user_id);

  if p_opening_amount is null or p_opening_amount < 0 then
    raise exception 'El monto inicial debe ser mayor o igual a 0';
  end if;

  if not exists (
    select 1
    from public.cash_registers cr
    where cr.id = p_register_id
      and cr.is_active = true
  ) then
    raise exception 'Caja no disponible';
  end if;

  if exists (
    select 1
    from public.cash_sessions cs
    where cs.opened_by_user_id = v_user_id
      and cs.status = 'open'
  ) then
    raise exception 'El usuario ya tiene una caja abierta';
  end if;

  if exists (
    select 1
    from public.cash_sessions cs
    where cs.cash_register_id = p_register_id
      and cs.status = 'open'
  ) then
    raise exception 'La caja ya tiene una sesión abierta';
  end if;

  insert into public.cash_sessions (
    session_number,
    cash_register_id,
    opened_by_user_id,
    opened_at,
    opening_amount,
    status,
    notes
  )
  values (
    public.build_cash_session_number(),
    p_register_id,
    v_user_id,
    now(),
    p_opening_amount,
    'open',
    nullif(trim(coalesce(p_notes, '')), '')
  )
  returning *
  into v_session;

  return v_session;
end;
$$;

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

  if v_role <> 'admin' and v_session.opened_by_user_id <> v_user_id then
    raise exception 'No autorizado para cerrar esta sesión';
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

  if v_role <> 'admin' and v_session.opened_by_user_id <> v_user_id then
    raise exception 'No autorizado para registrar movimientos en esta caja';
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

  if v_role <> 'admin' and v_actor_user_id <> v_request_user_id then
    raise exception 'No autorizado para asignar pagos a otra caja';
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
  if v_role <> 'admin' then
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

create or replace function public.renew_subscription_with_payment(
  p_customer_id uuid,
  p_plan_id integer,
  p_start_date date,
  p_end_date date,
  p_price numeric(12,2),
  p_discount_amount numeric(12,2),
  p_amount_paid numeric(12,2),
  p_payment_method text,
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
  v_subscription_id uuid;
  v_payment_id uuid;
  v_movement public.cash_movements%rowtype;
begin
  v_request_user_id := auth.uid();
  v_role := public.require_cash_operator(v_request_user_id);
  v_created_by_user_id := coalesce(p_created_by_user_id, v_request_user_id);

  if p_payment_method not in ('cash', 'card', 'transfer') then
    raise exception 'Método de pago inválido';
  end if;

  if not exists (
    select 1
    from public.plans
    where id = p_plan_id
  ) then
    raise exception 'Plan no encontrado';
  end if;

  update public.subscriptions
  set status = 'expired'
  where user_id = p_customer_id
    and status = 'active';

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
    p_start_date,
    p_end_date,
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
    p_price,
    coalesce(p_discount_amount, 0),
    p_amount_paid,
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
  if v_role <> 'admin' then
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

create or replace function public.prevent_locked_payment_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if exists (
      select 1
      from public.cash_movements cm
      join public.cash_sessions cs on cs.id = cm.cash_session_id
      where cm.source_payment_id = old.id
        and cs.status in ('closed', 'closed_with_difference')
    ) then
      raise exception 'No se puede eliminar un pago vinculado a una caja cerrada';
    end if;
    return old;
  end if;

  if exists (
    select 1
    from public.cash_movements cm
    join public.cash_sessions cs on cs.id = cm.cash_session_id
    where cm.source_payment_id = old.id
      and cs.status in ('closed', 'closed_with_difference')
  ) then
    if (to_jsonb(new) - array['status', 'reversed_at', 'reversed_by_user_id', 'replacement_payment_id', 'reversal_reason'])
       <> (to_jsonb(old) - array['status', 'reversed_at', 'reversed_by_user_id', 'replacement_payment_id', 'reversal_reason']) then
      raise exception 'No se puede modificar el núcleo de un pago vinculado a una caja cerrada';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_locked_payment_mutation on public.payments;

create trigger prevent_locked_payment_mutation
before update or delete on public.payments
for each row
execute function public.prevent_locked_payment_mutation();

create or replace view public.payments_overview as
select
  p.id,
  p.payment_date,
  p.amount_paid,
  p.method,
  p.user_id,
  p.subscription_id,
  pr.full_name as user_name,
  pr.avatar_url,
  pl.name as plan_name,
  s.status as subscription_status,
  s.end_date as subscription_end_date
from public.payments p
left join public.profiles pr on pr.id = p.user_id
left join public.subscriptions s on s.id = p.subscription_id
left join public.plans pl on pl.id = s.plan_id
where p.status = 'posted';

grant execute on function public.open_cash_session(uuid, numeric, text) to authenticated;
grant execute on function public.close_cash_session(uuid, numeric, text) to authenticated;
grant execute on function public.record_manual_cash_movement(uuid, text, text, numeric, text, text, uuid, numeric) to authenticated;
grant execute on function public.attach_payment_to_cash(uuid, uuid, text, text) to authenticated;
grant execute on function public.create_subscription_payment_for_existing_customer(uuid, integer, date, date, numeric, numeric, text, uuid) to authenticated;
grant execute on function public.renew_subscription_with_payment(uuid, integer, date, date, numeric, numeric, numeric, text, uuid) to authenticated;
grant execute on function public.reverse_and_recreate_payment(uuid, numeric, numeric, numeric, text, text, text, text, uuid) to authenticated;
