create table if not exists public.swap_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  swap_id uuid not null,
  original_meal jsonb not null,
  suggested_alternative jsonb not null,
  swap_type text not null check (swap_type in ('healthier','cheaper','eco')),
  rejected_at timestamptz not null default now(),
  rejection_reason text not null check (rejection_reason in ('taste_preference','availability','too_expensive','dietary_restriction','time_constraint','not_realistic','other')),
  custom_reason text,
  would_try_modified boolean not null default false
);

create index if not exists swap_feedback_user_time_idx on public.swap_feedback(user_id, rejected_at);
