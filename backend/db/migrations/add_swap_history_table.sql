create table if not exists public.swap_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  original_event_id uuid,
  swap_type text not null check (swap_type in ('healthier','cheaper','eco')),
  original_data jsonb not null,
  alternative_data jsonb not null,
  accepted_at timestamptz not null default now()
);

create index if not exists swap_history_user_time_idx on public.swap_history(user_id, accepted_at);
