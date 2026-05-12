-- Message templates for WhatsApp campaigns

create table if not exists public.message_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  content text not null default '',
  is_active boolean not null default true,
  created_by uuid not null references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

alter table public.message_templates enable row level security;

-- Allow read to anyone with messages.view permission (via admin client bypasses RLS, but keep RLS for safety)
create policy message_templates_admin_all on public.message_templates
  for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and (p.role = 'owner' or p.role = 'admin')
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and (p.role = 'owner' or p.role = 'admin')
    )
  );

-- Seed permissions for messages module
insert into public.permissions (key, description, module, action)
values
  ('messages.view',   'Ver mensajes',                     'messages', 'view'),
  ('messages.create', 'Crear mensajes',                   'messages', 'create'),
  ('messages.update', 'Editar mensajes',                  'messages', 'update'),
  ('messages.delete', 'Eliminar mensajes',                'messages', 'delete'),
  ('messages.use',    'Usar mensajes (enviar a clientes)','messages', 'use')
on conflict (key) do nothing;

-- Assign to owner and admin by default
do $$
declare
  v_owner_id uuid;
  v_admin_id uuid;
begin
  select id into v_owner_id from public.roles where slug = 'owner';
  select id into v_admin_id from public.roles where slug = 'admin';

  insert into public.role_permissions (role_id, permission_id)
  select v_owner_id, p.id
  from public.permissions p
  where p.key like 'messages.%'
    and not exists (
      select 1 from public.role_permissions rp
      where rp.role_id = v_owner_id and rp.permission_id = p.id
    );

  insert into public.role_permissions (role_id, permission_id)
  select v_admin_id, p.id
  from public.permissions p
  where p.key like 'messages.%'
    and not exists (
      select 1 from public.role_permissions rp
      where rp.role_id = v_admin_id and rp.permission_id = p.id
    );
end $$;
