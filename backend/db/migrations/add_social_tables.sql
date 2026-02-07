create table if not exists public.shared_goals (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  goal_type text not null check (goal_type in ('savings','wellness','sustainability','habit')),
  target_value numeric not null,
  target_date date,
  participants text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists shared_goals_creator_idx on public.shared_goals(creator_id);

create table if not exists public.goal_participants (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.shared_goals(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  current_progress numeric not null default 0,
  last_updated timestamptz not null default now(),
  unique (goal_id, user_id)
);

create index if not exists goal_participants_goal_idx on public.goal_participants(goal_id);
create index if not exists goal_participants_user_idx on public.goal_participants(user_id);

create table if not exists public.group_challenges (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  challenge_type text not null check (challenge_type in ('savings','wellness','sustainability','habit')),
  start_date date not null,
  end_date date not null,
  participants text[] not null default '{}',
  leaderboard jsonb not null default '[]'::jsonb,
  prize text,
  status text not null default 'active'
);

create index if not exists group_challenges_status_idx on public.group_challenges(status);
