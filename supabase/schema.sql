create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.workouts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  performed_on date not null,
  session_id text not null check (session_id in ('A','B','C','D')),
  duration_minutes integer,
  notes text,
  completed boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.workout_sets (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workouts(id) on delete cascade,
  exercise_id text not null,
  set_number integer not null,
  weight_kg numeric(7,2),
  reps integer,
  rir numeric(3,1),
  completed boolean not null default true,
  created_at timestamptz not null default now(),
  unique(workout_id, exercise_id, set_number)
);

create table if not exists public.body_metrics (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  measured_on date not null,
  weight_kg numeric(6,2) not null,
  waist_cm numeric(6,2),
  created_at timestamptz not null default now()
);

create table if not exists public.equipment_preferences (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  equipment_name text not null,
  available boolean not null default true,
  unique(profile_id, equipment_name)
);

create index if not exists workouts_profile_date_idx on public.workouts(profile_id, performed_on desc);
create index if not exists workout_sets_workout_idx on public.workout_sets(workout_id);
create index if not exists body_metrics_profile_date_idx on public.body_metrics(profile_id, measured_on desc);

alter table public.profiles enable row level security;
alter table public.workouts enable row level security;
alter table public.workout_sets enable row level security;
alter table public.body_metrics enable row level security;
alter table public.equipment_preferences enable row level security;

revoke all on public.profiles, public.workouts, public.workout_sets, public.body_metrics, public.equipment_preferences from anon;
grant select, insert, update, delete on public.profiles, public.workouts, public.workout_sets, public.body_metrics, public.equipment_preferences to authenticated;

drop policy if exists "profiles own row" on public.profiles;
drop policy if exists "workouts own rows" on public.workouts;
drop policy if exists "sets own rows" on public.workout_sets;
drop policy if exists "body metrics own rows" on public.body_metrics;
drop policy if exists "equipment own rows" on public.equipment_preferences;

create policy "profiles own row" on public.profiles
  for all to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "workouts own rows" on public.workouts
  for all to authenticated
  using ((select auth.uid()) = profile_id)
  with check ((select auth.uid()) = profile_id);

create policy "sets own rows" on public.workout_sets
  for all to authenticated
  using (
    exists (
      select 1 from public.workouts w
      where w.id = workout_sets.workout_id
        and w.profile_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.workouts w
      where w.id = workout_sets.workout_id
        and w.profile_id = (select auth.uid())
    )
  );

create policy "body metrics own rows" on public.body_metrics
  for all to authenticated
  using ((select auth.uid()) = profile_id)
  with check ((select auth.uid()) = profile_id);

create policy "equipment own rows" on public.equipment_preferences
  for all to authenticated
  using ((select auth.uid()) = profile_id)
  with check ((select auth.uid()) = profile_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();
