create table if not exists public.user_activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_type text not null check (activity_type in ('goal_completed','milestone','swap_accepted','streak')),
  title text not null,
  description text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  visibility text not null default 'friends' check (visibility in ('public','friends','private'))
);

create index if not exists user_activities_user_time_idx on public.user_activities(user_id, created_at desc);

create table if not exists public.achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  badge_type text not null check (badge_type in ('savings_master','wellness_warrior','eco_champion','streak_king','swap_expert')),
  badge_name text not null,
  earned_at timestamptz not null default now(),
  progress_current numeric not null default 0,
  progress_target numeric not null default 0,
  unique (user_id, badge_name)
);

create index if not exists achievements_user_idx on public.achievements(user_id);

create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  friend_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted')),
  created_at timestamptz not null default now(),
  unique (user_id, friend_id)
);

create index if not exists friendships_user_status_idx on public.friendships(user_id, status);
