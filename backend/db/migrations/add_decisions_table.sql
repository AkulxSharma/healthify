create table if not exists public.decisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  query text not null,
  item text not null,
  original_cost numeric,
  decision_type text not null check (decision_type in ('did_it','took_alternative','skipped')),
  alternative_taken boolean not null default false,
  cost_actual numeric,
  logged_at timestamptz not null default now(),
  impacts jsonb not null default '{}'::jsonb
);

create index if not exists decisions_user_time_idx on public.decisions(user_id, logged_at);
