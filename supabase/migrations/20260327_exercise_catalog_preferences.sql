alter table public.exercises
  add column if not exists is_favorite boolean not null default false,
  add column if not exists is_preview_hidden boolean not null default false;

create index if not exists exercises_active_favorite_idx
  on public.exercises (is_favorite)
  where is_active = true;

create index if not exists exercises_active_preview_hidden_idx
  on public.exercises (is_preview_hidden)
  where is_active = true;
