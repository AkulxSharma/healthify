create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  profile_type text not null default 'Student',
  email_verified boolean not null default false,
  email_verified_at timestamptz,
  email_verification_token text,
  email_verification_expires_at timestamptz,
  email_verification_last_sent_at timestamptz,
  email_verification_send_count int not null default 0,
  email_verification_send_window_started_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  timestamp timestamptz not null,
  created_at timestamptz not null default now(),
  event_type text not null,
  category text not null,
  title text not null,
  amount numeric,
  metadata jsonb,
  scores jsonb
);

create index if not exists events_user_id_idx on public.events(user_id);
create index if not exists events_timestamp_idx on public.events(timestamp desc);
create index if not exists events_event_type_idx on public.events(event_type);

create table if not exists public.movement_patterns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  steps int not null default 0,
  active_minutes int not null default 0,
  sedentary_minutes int not null default 0,
  workout_count int not null default 0,
  total_movement_score int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);

create index if not exists movement_patterns_user_date_idx on public.movement_patterns(user_id, date);
