create table if not exists public.risk_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  burnout_risk numeric,
  injury_risk numeric,
  isolation_risk numeric,
  financial_risk numeric,
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

create index if not exists risk_history_user_date_idx on public.risk_history(user_id, date);
