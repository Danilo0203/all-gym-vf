create extension if not exists pgcrypto;
create extension if not exists unaccent;
create extension if not exists pg_trgm;

create or replace function public.set_row_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

alter table public.profiles
  add column if not exists training_profile_status text not null default 'pending';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_training_profile_status_check'
  ) then
    alter table public.profiles
      add constraint profiles_training_profile_status_check
      check (training_profile_status in ('pending', 'complete'));
  end if;
end $$;

create table if not exists public.training_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  primary_goal text,
  secondary_goal text,
  focus_areas text[] not null default '{}'::text[],
  experience_level text,
  days_per_week integer,
  session_minutes integer,
  training_location text,
  equipment_available text[] not null default '{}'::text[],
  activity_level text,
  cardio_preference text,
  exercise_preferences text,
  exercise_dislikes text,
  injuries_or_pain text,
  restricted_movements text[] not null default '{}'::text[],
  parq_requires_attention boolean,
  medical_clearance_notes text,
  is_complete boolean not null default false,
  created_at timestamp with time zone not null default timezone('utc', now()),
  updated_at timestamp with time zone not null default timezone('utc', now()),
  check (
    primary_goal is null
    or primary_goal in ('fat_loss', 'muscle_gain', 'recomp', 'strength', 'general_fitness', 'cardio')
  ),
  check (
    secondary_goal is null
    or secondary_goal in ('fat_loss', 'muscle_gain', 'recomp', 'strength', 'general_fitness', 'cardio')
  ),
  check (
    experience_level is null
    or experience_level in ('beginner', 'intermediate', 'advanced')
  ),
  check (
    days_per_week is null
    or days_per_week between 2 and 5
  ),
  check (
    session_minutes is null
    or session_minutes between 20 and 180
  ),
  check (
    training_location is null
    or training_location in ('gym', 'home', 'mixed')
  ),
  check (
    activity_level is null
    or activity_level in ('sedentario', '1_3_dias', '3_5_dias', '6_7_dias', '2_veces_dia')
  ),
  check (
    cardio_preference is null
    or cardio_preference in ('none', 'light', 'moderate', 'high')
  )
);

create index if not exists training_profiles_user_id_idx on public.training_profiles(user_id);
create index if not exists training_profiles_is_complete_idx on public.training_profiles(is_complete);

alter table public.training_profiles enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'training_profiles'
      and policyname = 'training_profiles_admin_all'
  ) then
    create policy training_profiles_admin_all
      on public.training_profiles
      for all
      using (
        exists (
          select 1
          from public.profiles p
          where p.id = auth.uid()
            and p.role = 'admin'
        )
      )
      with check (
        exists (
          select 1
          from public.profiles p
          where p.id = auth.uid()
            and p.role = 'admin'
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'training_profiles'
      and policyname = 'training_profiles_owner_select'
  ) then
    create policy training_profiles_owner_select
      on public.training_profiles
      for select
      using (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'set_training_profiles_updated_at'
  ) then
    create trigger set_training_profiles_updated_at
      before update on public.training_profiles
      for each row
      execute function public.set_row_updated_at();
  end if;
end $$;

alter table public.body_assessments
  alter column body_type drop not null;

alter table public.routines
  add column if not exists status text not null default 'active',
  add column if not exists source text not null default 'system',
  add column if not exists training_profile_id uuid references public.training_profiles(id) on delete set null,
  add column if not exists primary_goal text,
  add column if not exists secondary_goal text,
  add column if not exists generation_version text,
  add column if not exists reviewed_by uuid references public.profiles(id) on delete set null,
  add column if not exists reviewed_at timestamp with time zone;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'routines_status_check'
  ) then
    alter table public.routines
      add constraint routines_status_check
      check (status in ('pending_profile', 'draft', 'active', 'archived'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'routines_source_check'
  ) then
    alter table public.routines
      add constraint routines_source_check
      check (source in ('system', 'admin'));
  end if;
end $$;

update public.routines
set
  status = case when coalesce(is_active, false) then 'active' else 'archived' end,
  source = coalesce(source, 'system'),
  generation_version = coalesce(generation_version, 'legacy_v0')
where true;

create index if not exists routines_user_status_idx on public.routines(user_id, status);
create index if not exists routines_training_profile_idx on public.routines(training_profile_id);

alter table public.routine_details
  add column if not exists exercise_order integer,
  add column if not exists block_type text not null default 'strength',
  add column if not exists duration_minutes integer,
  add column if not exists target_rir numeric(3,1),
  add column if not exists exercise_name_snapshot text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'routine_details_block_type_check'
  ) then
    alter table public.routine_details
      add constraint routine_details_block_type_check
      check (block_type in ('warmup', 'strength', 'accessory', 'cardio', 'mobility'));
  end if;
end $$;

with ranked_details as (
  select
    id,
    row_number() over (partition by routine_id, day_of_week order by id) as exercise_position
  from public.routine_details
)
update public.routine_details rd
set exercise_order = ranked_details.exercise_position
from ranked_details
where rd.id = ranked_details.id
  and rd.exercise_order is null;

alter table public.exercises
  add column if not exists slug text,
  add column if not exists display_name text,
  add column if not exists display_name_es text,
  add column if not exists provider text,
  add column if not exists provider_item_id text,
  add column if not exists image_url text,
  add column if not exists body_parts text[] not null default '{}'::text[],
  add column if not exists target_muscles text[] not null default '{}'::text[],
  add column if not exists secondary_muscles text[] not null default '{}'::text[],
  add column if not exists equipments text[] not null default '{}'::text[],
  add column if not exists exercise_type text,
  add column if not exists instructions text[] not null default '{}'::text[],
  add column if not exists tips text[] not null default '{}'::text[],
  add column if not exists keywords text[] not null default '{}'::text[],
  add column if not exists variations text[] not null default '{}'::text[],
  add column if not exists raw_payload jsonb,
  add column if not exists last_synced_at timestamp with time zone,
  add column if not exists is_active boolean not null default true;

update public.exercises
set
  display_name = coalesce(display_name, name),
  provider = coalesce(provider, 'legacy'),
  image_url = coalesce(image_url, animation_url),
  body_parts = case
    when cardinality(body_parts) > 0 then body_parts
    when target_muscle is not null then array[target_muscle]::text[]
    else '{}'::text[]
  end,
  target_muscles = case
    when cardinality(target_muscles) > 0 then target_muscles
    when target_muscle is not null then array[target_muscle]::text[]
    else '{}'::text[]
  end,
  equipments = case
    when cardinality(equipments) > 0 then equipments
    when equipment_needed is not null then array[equipment_needed]::text[]
    else '{}'::text[]
  end,
  raw_payload = coalesce(raw_payload, '{}'::jsonb),
  is_active = coalesce(is_active, true)
where true;

with base_slugs as (
  select
    id,
    coalesce(
      nullif(slug, ''),
      trim(both '-' from regexp_replace(lower(unaccent(coalesce(display_name, name, 'exercise'))), '[^a-z0-9]+', '-', 'g'))
    ) as raw_slug
  from public.exercises
),
ranked_slugs as (
  select
    id,
    raw_slug,
    row_number() over (partition by raw_slug order by id) as slug_rank
  from base_slugs
)
update public.exercises e
set slug = case
  when ranked_slugs.slug_rank = 1 then ranked_slugs.raw_slug
  else ranked_slugs.raw_slug || '-' || ranked_slugs.slug_rank
end
from ranked_slugs
where e.id = ranked_slugs.id
  and (e.slug is null or e.slug = '');

create unique index if not exists exercises_slug_uidx on public.exercises(slug);
create index if not exists exercises_provider_item_idx on public.exercises(provider, provider_item_id);
create index if not exists exercises_active_idx on public.exercises(is_active);
create index if not exists exercises_body_parts_gin_idx on public.exercises using gin(body_parts);
create index if not exists exercises_target_muscles_gin_idx on public.exercises using gin(target_muscles);
create index if not exists exercises_equipments_gin_idx on public.exercises using gin(equipments);
create index if not exists exercises_display_name_trgm_idx on public.exercises using gin(lower(coalesce(display_name, name)) gin_trgm_ops);
create index if not exists exercises_display_name_es_trgm_idx on public.exercises using gin(lower(coalesce(display_name_es, '')) gin_trgm_ops);

insert into public.exercises (
  slug,
  name,
  display_name,
  display_name_es,
  provider,
  provider_item_id,
  body_parts,
  target_muscles,
  secondary_muscles,
  equipments,
  exercise_type,
  instructions,
  tips,
  keywords,
  variations,
  raw_payload,
  last_synced_at,
  is_active
)
values
  (
    'starter-bodyweight-squat',
    'Bodyweight Squat',
    'Bodyweight Squat',
    'Sentadilla con peso corporal',
    'starter_pack',
    null,
    array['lower legs']::text[],
    array['quadriceps']::text[],
    array['glutes', 'core']::text[],
    array['body weight']::text[],
    'compound',
    array['Stand with feet shoulder-width apart.', 'Sit back and down keeping the chest proud.', 'Drive through the feet to return to standing.']::text[],
    array['Keep the knees tracking over the toes.', 'Control the descent before pushing up.']::text[],
    array['legs', 'squat', 'bodyweight', 'beginner']::text[],
    array['Goblet Squat', 'Split Squat']::text[],
    '{}'::jsonb,
    timezone('utc', now()),
    true
  ),
  (
    'starter-goblet-squat',
    'Goblet Squat',
    'Goblet Squat',
    'Sentadilla Goblet',
    'starter_pack',
    null,
    array['lower legs']::text[],
    array['quadriceps']::text[],
    array['glutes', 'core']::text[],
    array['dumbbell']::text[],
    'compound',
    array['Hold a dumbbell close to the chest.', 'Lower into a squat with the elbows inside the knees.', 'Stand back up without losing posture.']::text[],
    array['Use a box as depth target if needed.', 'Brace the core before each rep.']::text[],
    array['legs', 'squat', 'dumbbell', 'glutes']::text[],
    array['Bodyweight Squat', 'Leg Press']::text[],
    '{}'::jsonb,
    timezone('utc', now()),
    true
  ),
  (
    'starter-leg-press',
    'Leg Press',
    'Leg Press',
    'Prensa de pierna',
    'starter_pack',
    null,
    array['lower legs']::text[],
    array['quadriceps']::text[],
    array['glutes', 'hamstrings']::text[],
    array['machine']::text[],
    'compound',
    array['Set the seat so the knees can bend comfortably.', 'Press the platform without locking the knees.', 'Lower slowly until control starts to fade.']::text[],
    array['Use full-foot pressure.', 'Do not round the lower back at the bottom.']::text[],
    array['legs', 'machine', 'quadriceps']::text[],
    array['Goblet Squat', 'Split Squat']::text[],
    '{}'::jsonb,
    timezone('utc', now()),
    true
  ),
  (
    'starter-dumbbell-romanian-deadlift',
    'Dumbbell Romanian Deadlift',
    'Dumbbell Romanian Deadlift',
    'Peso muerto rumano con mancuernas',
    'starter_pack',
    null,
    array['upper legs']::text[],
    array['hamstrings']::text[],
    array['glutes', 'lower back']::text[],
    array['dumbbell']::text[],
    'compound',
    array['Hold dumbbells at the sides.', 'Push the hips back while keeping the spine neutral.', 'Stand tall by squeezing the glutes.']::text[],
    array['Keep the dumbbells close to the legs.', 'Stop when hamstring tension peaks.']::text[],
    array['hinge', 'posterior chain', 'hamstrings']::text[],
    array['Hip Thrust', 'Glute Bridge']::text[],
    '{}'::jsonb,
    timezone('utc', now()),
    true
  ),
  (
    'starter-barbell-romanian-deadlift',
    'Barbell Romanian Deadlift',
    'Barbell Romanian Deadlift',
    'Peso muerto rumano con barra',
    'starter_pack',
    null,
    array['upper legs']::text[],
    array['hamstrings']::text[],
    array['glutes', 'lower back']::text[],
    array['barbell']::text[],
    'compound',
    array['Grip the bar just outside the thighs.', 'Push the hips back and lower the bar under control.', 'Stand tall by extending the hips.']::text[],
    array['Maintain a soft bend in the knees.', 'Do not let the bar drift away from the body.']::text[],
    array['hinge', 'barbell', 'hamstrings']::text[],
    array['Dumbbell Romanian Deadlift', 'Hip Thrust']::text[],
    '{}'::jsonb,
    timezone('utc', now()),
    true
  ),
  (
    'starter-hip-thrust',
    'Hip Thrust',
    'Hip Thrust',
    'Hip thrust',
    'starter_pack',
    null,
    array['upper legs']::text[],
    array['glutes']::text[],
    array['hamstrings', 'core']::text[],
    array['barbell', 'body weight']::text[],
    'compound',
    array['Rest the upper back on a bench or support.', 'Drive the hips up until the torso is parallel to the floor.', 'Lower slowly with control.']::text[],
    array['Keep the chin tucked.', 'Pause for a second at the top.']::text[],
    array['glutes', 'posterior chain', 'hip hinge']::text[],
    array['Glute Bridge', 'Romanian Deadlift']::text[],
    '{}'::jsonb,
    timezone('utc', now()),
    true
  ),
  (
    'starter-split-squat',
    'Split Squat',
    'Split Squat',
    'Zancada estática',
    'starter_pack',
    null,
    array['upper legs']::text[],
    array['quadriceps']::text[],
    array['glutes', 'hamstrings']::text[],
    array['body weight', 'dumbbell']::text[],
    'compound',
    array['Take a split stance.', 'Lower the back knee toward the floor under control.', 'Drive through the front foot to return up.']::text[],
    array['Use support if balance is limited.', 'Keep the torso tall.']::text[],
    array['unilateral', 'legs', 'glutes']::text[],
    array['Walking Lunge', 'Goblet Squat']::text[],
    '{}'::jsonb,
    timezone('utc', now()),
    true
  ),
  (
    'starter-walking-lunge',
    'Walking Lunge',
    'Walking Lunge',
    'Zancadas caminando',
    'starter_pack',
    null,
    array['upper legs']::text[],
    array['quadriceps']::text[],
    array['glutes', 'hamstrings']::text[],
    array['body weight', 'dumbbell']::text[],
    'compound',
    array['Step forward into a lunge.', 'Lower with control and push off the front foot.', 'Repeat by alternating legs.']::text[],
    array['Keep the steps controlled.', 'Reduce stride length if the knees feel stressed.']::text[],
    array['legs', 'conditioning', 'glutes']::text[],
    array['Split Squat', 'Bodyweight Squat']::text[],
    '{}'::jsonb,
    timezone('utc', now()),
    true
  ),
  (
    'starter-push-up',
    'Push-Up',
    'Push-Up',
    'Flexiones',
    'starter_pack',
    null,
    array['chest']::text[],
    array['pectorals']::text[],
    array['triceps', 'shoulders', 'core']::text[],
    array['body weight']::text[],
    'compound',
    array['Start in a plank position.', 'Lower the chest between the hands.', 'Push back up while keeping the body rigid.']::text[],
    array['Elevate the hands to make it easier.', 'Do not let the hips sag.']::text[],
    array['push', 'chest', 'bodyweight']::text[],
    array['Bench Press', 'Incline Dumbbell Press']::text[],
    '{}'::jsonb,
    timezone('utc', now()),
    true
  ),
  (
    'starter-barbell-bench-press',
    'Barbell Bench Press',
    'Barbell Bench Press',
    'Press de banca con barra',
    'starter_pack',
    null,
    array['chest']::text[],
    array['pectorals']::text[],
    array['triceps', 'shoulders']::text[],
    array['barbell']::text[],
    'compound',
    array['Unrack the bar with the shoulders set.', 'Lower to the mid chest under control.', 'Press back up keeping the wrists stacked.']::text[],
    array['Use a spotter when possible.', 'Keep the shoulder blades pinned.']::text[],
    array['press', 'chest', 'barbell']::text[],
    array['Push-Up', 'Incline Dumbbell Press']::text[],
    '{}'::jsonb,
    timezone('utc', now()),
    true
  ),
  (
    'starter-incline-dumbbell-press',
    'Incline Dumbbell Press',
    'Incline Dumbbell Press',
    'Press inclinado con mancuernas',
    'starter_pack',
    null,
    array['chest']::text[],
    array['pectorals']::text[],
    array['triceps', 'shoulders']::text[],
    array['dumbbell']::text[],
    'compound',
    array['Set the bench to a slight incline.', 'Lower the dumbbells toward the upper chest.', 'Press up and slightly together.']::text[],
    array['Keep the elbows stacked under the wrists.', 'Control the lowering phase.']::text[],
    array['press', 'upper chest', 'dumbbell']::text[],
    array['Push-Up', 'Barbell Bench Press']::text[],
    '{}'::jsonb,
    timezone('utc', now()),
    true
  ),
  (
    'starter-dumbbell-overhead-press',
    'Dumbbell Overhead Press',
    'Dumbbell Overhead Press',
    'Press militar con mancuernas',
    'starter_pack',
    null,
    array['shoulders']::text[],
    array['delts']::text[],
    array['triceps', 'upper chest']::text[],
    array['dumbbell']::text[],
    'compound',
    array['Start with the dumbbells at shoulder height.', 'Press overhead without shrugging excessively.', 'Lower under control back to the shoulders.']::text[],
    array['Brace the core to avoid leaning back.', 'Use a seated version if needed.']::text[],
    array['shoulders', 'press', 'dumbbell']::text[],
    array['Lateral Raise', 'Push-Up']::text[],
    '{}'::jsonb,
    timezone('utc', now()),
    true
  ),
  (
    'starter-lat-pulldown',
    'Lat Pulldown',
    'Lat Pulldown',
    'Jalón al pecho',
    'starter_pack',
    null,
    array['back']::text[],
    array['lats']::text[],
    array['biceps', 'rear delts']::text[],
    array['machine']::text[],
    'compound',
    array['Set the thighs under the pad.', 'Pull the bar toward the upper chest.', 'Return slowly until the elbows are straight.']::text[],
    array['Keep the ribs down.', 'Do not yank the bar with momentum.']::text[],
    array['back', 'pull', 'lats', 'machine']::text[],
    array['Seated Row', 'Assisted Pull-Up']::text[],
    '{}'::jsonb,
    timezone('utc', now()),
    true
  ),
  (
    'starter-seated-row',
    'Seated Row',
    'Seated Row',
    'Remo sentado',
    'starter_pack',
    null,
    array['back']::text[],
    array['mid back']::text[],
    array['lats', 'biceps', 'rear delts']::text[],
    array['machine']::text[],
    'compound',
    array['Sit tall and hold the handle.', 'Row the handle toward the lower ribs.', 'Extend the arms slowly without losing posture.']::text[],
    array['Lead with the elbows.', 'Pause briefly when the shoulder blades meet.']::text[],
    array['back', 'row', 'machine']::text[],
    array['Dumbbell Row', 'Lat Pulldown']::text[],
    '{}'::jsonb,
    timezone('utc', now()),
    true
  ),
  (
    'starter-dumbbell-row',
    'Dumbbell Row',
    'Dumbbell Row',
    'Remo con mancuerna',
    'starter_pack',
    null,
    array['back']::text[],
    array['lats']::text[],
    array['mid back', 'biceps']::text[],
    array['dumbbell']::text[],
    'compound',
    array['Support the body on a bench or stable surface.', 'Pull the dumbbell toward the hip.', 'Lower slowly without twisting the torso.']::text[],
    array['Think of driving the elbow back.', 'Keep the neck neutral.']::text[],
    array['back', 'row', 'dumbbell']::text[],
    array['Seated Row', 'Lat Pulldown']::text[],
    '{}'::jsonb,
    timezone('utc', now()),
    true
  ),
  (
    'starter-assisted-pull-up',
    'Assisted Pull-Up',
    'Assisted Pull-Up',
    'Dominada asistida',
    'starter_pack',
    null,
    array['back']::text[],
    array['lats']::text[],
    array['biceps', 'mid back']::text[],
    array['machine', 'bands']::text[],
    'compound',
    array['Grip the bar slightly wider than shoulder width.', 'Pull the chest toward the bar.', 'Lower under control to full arm extension.']::text[],
    array['Use the assistance that allows clean reps.', 'Avoid kicking the legs.']::text[],
    array['vertical pull', 'back', 'lats']::text[],
    array['Lat Pulldown', 'Seated Row']::text[],
    '{}'::jsonb,
    timezone('utc', now()),
    true
  ),
  (
    'starter-lateral-raise',
    'Lateral Raise',
    'Lateral Raise',
    'Elevaciones laterales',
    'starter_pack',
    null,
    array['shoulders']::text[],
    array['delts']::text[],
    array['upper traps']::text[],
    array['dumbbell']::text[],
    'isolation',
    array['Hold dumbbells at the sides.', 'Raise the arms until they are near shoulder height.', 'Lower slowly without swinging.']::text[],
    array['Use soft elbows.', 'Keep the shoulders down away from the ears.']::text[],
    array['shoulders', 'delts', 'isolation']::text[],
    array['Dumbbell Overhead Press']::text[],
    '{}'::jsonb,
    timezone('utc', now()),
    true
  ),
  (
    'starter-biceps-curl',
    'Biceps Curl',
    'Biceps Curl',
    'Curl de bíceps',
    'starter_pack',
    null,
    array['upper arms']::text[],
    array['biceps']::text[],
    array['forearms']::text[],
    array['dumbbell', 'barbell']::text[],
    'isolation',
    array['Start with the arms extended.', 'Curl the weight without moving the shoulders forward.', 'Lower under control.']::text[],
    array['Keep the elbows close to the torso.', 'Avoid swinging the body.']::text[],
    array['arms', 'biceps', 'curl']::text[],
    array['Seated Row']::text[],
    '{}'::jsonb,
    timezone('utc', now()),
    true
  ),
  (
    'starter-triceps-pushdown',
    'Triceps Pushdown',
    'Triceps Pushdown',
    'Jalón de tríceps',
    'starter_pack',
    null,
    array['upper arms']::text[],
    array['triceps']::text[],
    array['shoulders']::text[],
    array['machine']::text[],
    'isolation',
    array['Hold the cable attachment with the elbows near the body.', 'Extend the arms until the elbows are straight.', 'Return slowly to the start.']::text[],
    array['Keep the shoulders quiet.', 'Use a range of motion you can control.']::text[],
    array['arms', 'triceps', 'cable']::text[],
    array['Push-Up', 'Overhead Press']::text[],
    '{}'::jsonb,
    timezone('utc', now()),
    true
  ),
  (
    'starter-plank',
    'Plank',
    'Plank',
    'Plancha',
    'starter_pack',
    null,
    array['waist']::text[],
    array['core']::text[],
    array['shoulders', 'glutes']::text[],
    array['body weight']::text[],
    'stability',
    array['Set the forearms on the floor.', 'Create a straight line from shoulders to ankles.', 'Hold while breathing steadily.']::text[],
    array['Brace the abs as if expecting a punch.', 'Stop if the lower back sags.']::text[],
    array['core', 'stability', 'bodyweight']::text[],
    array['Dead Bug']::text[],
    '{}'::jsonb,
    timezone('utc', now()),
    true
  ),
  (
    'starter-dead-bug',
    'Dead Bug',
    'Dead Bug',
    'Dead bug',
    'starter_pack',
    null,
    array['waist']::text[],
    array['core']::text[],
    array['hips']::text[],
    array['body weight']::text[],
    'stability',
    array['Lie on the back with the knees and arms up.', 'Lower the opposite arm and leg slowly.', 'Return and alternate sides.']::text[],
    array['Keep the lower back gently pressed into the floor.', 'Move slowly and breathe out on the reach.']::text[],
    array['core', 'stability', 'beginner']::text[],
    array['Plank']::text[],
    '{}'::jsonb,
    timezone('utc', now()),
    true
  ),
  (
    'starter-glute-bridge',
    'Glute Bridge',
    'Glute Bridge',
    'Puente de glúteo',
    'starter_pack',
    null,
    array['upper legs']::text[],
    array['glutes']::text[],
    array['hamstrings', 'core']::text[],
    array['body weight']::text[],
    'compound',
    array['Lie on the back with knees bent.', 'Drive through the heels to lift the hips.', 'Lower under control.']::text[],
    array['Do not overextend the lower back.', 'Pause at the top.']::text[],
    array['glutes', 'posterior chain', 'bodyweight']::text[],
    array['Hip Thrust', 'Romanian Deadlift']::text[],
    '{}'::jsonb,
    timezone('utc', now()),
    true
  ),
  (
    'starter-treadmill-incline-walk',
    'Treadmill Incline Walk',
    'Treadmill Incline Walk',
    'Caminata en banda con inclinación',
    'starter_pack',
    null,
    array['cardio']::text[],
    array['conditioning']::text[],
    array['glutes', 'calves']::text[],
    array['treadmill']::text[],
    'cardio',
    array['Set a moderate pace and incline.', 'Walk tall with a natural arm swing.', 'Maintain breathing that still allows short phrases.']::text[],
    array['Do not hold the rails unless needed for safety.', 'Start with a lower incline if new to cardio.']::text[],
    array['cardio', 'steady state', 'treadmill']::text[],
    array['Cycling Intervals']::text[],
    '{}'::jsonb,
    timezone('utc', now()),
    true
  ),
  (
    'starter-cycling-intervals',
    'Cycling Intervals',
    'Cycling Intervals',
    'Intervalos en bicicleta',
    'starter_pack',
    null,
    array['cardio']::text[],
    array['conditioning']::text[],
    array['quadriceps', 'glutes']::text[],
    array['bike']::text[],
    'cardio',
    array['Alternate hard efforts with easy recovery pedaling.', 'Keep posture stable and cadence controlled.', 'Cool down at the end.']::text[],
    array['Begin with short work intervals if you are new to intervals.', 'Keep resistance manageable enough to sustain quality efforts.']::text[],
    array['cardio', 'intervals', 'bike']::text[],
    array['Treadmill Incline Walk', 'Jump Rope']::text[],
    '{}'::jsonb,
    timezone('utc', now()),
    true
  ),
  (
    'starter-jump-rope',
    'Jump Rope',
    'Jump Rope',
    'Cuerda',
    'starter_pack',
    null,
    array['cardio']::text[],
    array['conditioning']::text[],
    array['calves', 'shoulders']::text[],
    array['body weight']::text[],
    'cardio',
    array['Jump lightly while turning the rope from the wrists.', 'Keep the torso tall and land softly.', 'Use short rounds with rest as needed.']::text[],
    array['Choose a forgiving surface when possible.', 'Avoid if high impact is not tolerated.']::text[],
    array['cardio', 'conditioning', 'high impact']::text[],
    array['Cycling Intervals', 'Treadmill Incline Walk']::text[],
    '{}'::jsonb,
    timezone('utc', now()),
    true
  )
on conflict (slug) do update
set
  name = excluded.name,
  display_name = excluded.display_name,
  display_name_es = excluded.display_name_es,
  provider = excluded.provider,
  body_parts = excluded.body_parts,
  target_muscles = excluded.target_muscles,
  secondary_muscles = excluded.secondary_muscles,
  equipments = excluded.equipments,
  exercise_type = excluded.exercise_type,
  instructions = excluded.instructions,
  tips = excluded.tips,
  keywords = excluded.keywords,
  variations = excluded.variations,
  raw_payload = excluded.raw_payload,
  last_synced_at = excluded.last_synced_at,
  is_active = excluded.is_active;

update public.routine_details rd
set exercise_name_snapshot = coalesce(rd.exercise_name_snapshot, e.display_name, e.name)
from public.exercises e
where rd.exercise_id = e.id
  and rd.exercise_name_snapshot is null;
