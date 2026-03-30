begin;

alter table public.training_profiles
  alter column training_location set default 'gym';

update public.training_profiles
set training_location = 'gym'
where training_location is distinct from 'gym';

alter table public.training_profiles
  alter column equipment_available set default array[
    'full_gym',
    'body_weight',
    'dumbbell',
    'barbell',
    'machine',
    'treadmill',
    'bike',
    'rower'
  ]::text[];

update public.training_profiles
set equipment_available = array[
  'full_gym',
  'body_weight',
  'dumbbell',
  'barbell',
  'machine',
  'treadmill',
  'bike',
  'rower'
]::text[]
where equipment_available is null
   or coalesce(array_length(equipment_available, 1), 0) = 0;

alter table public.training_profiles
  drop constraint if exists training_profiles_days_per_week_check;

alter table public.training_profiles
  add constraint training_profiles_days_per_week_check
  check (
    days_per_week is null
    or (days_per_week >= 1 and days_per_week <= 7)
  );

alter table public.training_profiles
  drop constraint if exists training_profiles_session_minutes_check;

alter table public.training_profiles
  add constraint training_profiles_session_minutes_check
  check (
    session_minutes is null
    or (session_minutes >= 1 and session_minutes <= 480)
  );

alter table public.body_assessments
  drop column if exists notes;

alter table public.training_nutrition_snapshots
  drop column if exists notes;

commit;
