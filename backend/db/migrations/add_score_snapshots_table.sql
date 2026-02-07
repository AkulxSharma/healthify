create table if not exists public.score_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  wallet_score numeric,
  wellness_score numeric,
  sustainability_score numeric,
  movement_score numeric,
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

create index if not exists score_snapshots_user_date_idx on public.score_snapshots(user_id, date);
