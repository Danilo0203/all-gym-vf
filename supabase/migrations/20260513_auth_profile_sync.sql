-- Keep public.profiles in sync with auth.users so admin listings stay complete.

create or replace function public.sync_profile_from_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_full_name text;
  v_role user_role;
begin
  v_full_name := nullif(
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(coalesce(new.email, ''), '@', 1)
    ),
    ''
  );

  v_role := case lower(coalesce(new.raw_user_meta_data->>'role', 'client'))
    when 'owner' then 'owner'::user_role
    when 'admin' then 'admin'::user_role
    when 'trainer' then 'trainer'::user_role
    when 'employee' then 'employee'::user_role
    when 'client' then 'client'::user_role
    else 'client'::user_role
  end;

  insert into public.profiles (id, full_name, phone, birth_date, role, created_at, updated_at)
  values (
    new.id,
    coalesce(v_full_name, 'Sin nombre'),
    coalesce(nullif(new.raw_user_meta_data->>'phone', ''), ''),
    current_date,
    v_role,
    coalesce(new.created_at, timezone('utc'::text, now())),
    timezone('utc'::text, now())
  )
  on conflict (id) do update
    set full_name = excluded.full_name,
        role = coalesce(public.profiles.role, excluded.role),
        updated_at = timezone('utc'::text, now());

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.sync_profile_from_auth_user();

insert into public.profiles (id, full_name, phone, birth_date, role, created_at, updated_at)
select
  au.id,
  coalesce(
    nullif(au.raw_user_meta_data->>'full_name', ''),
    nullif(au.raw_user_meta_data->>'name', ''),
    split_part(coalesce(au.email, ''), '@', 1),
    'Sin nombre'
  ) as full_name,
  coalesce(nullif(au.raw_user_meta_data->>'phone', ''), '') as phone,
  current_date as birth_date,
  case lower(coalesce(au.raw_user_meta_data->>'role', 'client'))
    when 'owner' then 'owner'::user_role
    when 'admin' then 'admin'::user_role
    when 'trainer' then 'trainer'::user_role
    when 'employee' then 'employee'::user_role
    when 'client' then 'client'::user_role
    else 'client'::user_role
  end as role,
  coalesce(au.created_at, timezone('utc'::text, now())),
  timezone('utc'::text, now())
from auth.users au
left join public.profiles p on p.id = au.id
where p.id is null
on conflict (id) do nothing;

update auth.users au
set raw_user_meta_data = jsonb_set(
  coalesce(au.raw_user_meta_data, '{}'::jsonb),
  '{role}',
  to_jsonb(p.role::text),
  true
)
from public.profiles p
where p.id = au.id
  and coalesce(au.raw_user_meta_data->>'role', '') is distinct from p.role::text;
