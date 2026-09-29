create extension if not exists "pgcrypto";

create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists workouts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) on delete cascade,
  performed_on date not null,
  session_id text not null check (session_id in ('A','B','C','D')),
  duration_minutes integer,
  notes text,
  completed boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists workout_sets (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references workouts(id) on delete cascade,
  exercise_id text not null,
  set_number integer not null,
  weight_kg numeric(7,2),
  reps integer,
  rir numeric(3,1),
  completed boolean not null default true,
  created_at timestamptz not null default now(),
  unique(workout_id, exercise_id, set_number)
);

create table if not exists body_metrics (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) on delete cascade,
  measured_on date not null,
  weight_kg numeric(6,2) not null,
  waist_cm numeric(6,2),
  created_at timestamptz not null default now()
);

create table if not exists equipment_preferences (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) on delete cascade,
  equipment_name text not null,
  available boolean not null default true,
  unique(profile_id, equipment_name)
);

create index if not exists workouts_profile_date_idx on workouts(profile_id, performed_on desc);
create index if not exists workout_sets_workout_idx on workout_sets(workout_id);
create index if not exists body_metrics_profile_date_idx on body_metrics(profile_id, measured_on desc);

alter table profiles enable row level security;
alter table workouts enable row level security;
alter table workout_sets enable row level security;
alter table body_metrics enable row level security;
alter table equipment_preferences enable row level security;

create policy "profiles own row" on profiles
  for all using (auth.uid() = auth_user_id)
  with check (auth.uid() = auth_user_id);

create policy "workouts own rows" on workouts
  for all using (
    exists (
      select 1 from profiles p
      where p.id = workouts.profile_id and p.auth_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from profiles p
      where p.id = workouts.profile_id and p.auth_user_id = auth.uid()
    )
  );

create policy "sets own rows" on workout_sets
  for all using (
    exists (
      select 1
      from workouts w
      join profiles p on p.id = w.profile_id
      where w.id = workout_sets.workout_id and p.auth_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from workouts w
      join profiles p on p.id = w.profile_id
      where w.id = workout_sets.workout_id and p.auth_user_id = auth.uid()
    )
  );

create policy "body metrics own rows" on body_metrics
  for all using (
    exists (
      select 1 from profiles p
      where p.id = body_metrics.profile_id and p.auth_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from profiles p
      where p.id = body_metrics.profile_id and p.auth_user_id = auth.uid()
    )
  );

create policy "equipment own rows" on equipment_preferences
  for all using (
    exists (
      select 1 from profiles p
      where p.id = equipment_preferences.profile_id and p.auth_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from profiles p
      where p.id = equipment_preferences.profile_id and p.auth_user_id = auth.uid()
    )
  );
