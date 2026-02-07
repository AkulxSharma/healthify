create table if not exists public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email_enabled boolean not null default true,
  push_enabled boolean not null default false,
  alert_types jsonb not null default '{"insights": true, "goals": true, "social": true, "reminders": true}'::jsonb,
  frequency text not null default 'weekly',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create index if not exists notification_preferences_user_idx on public.notification_preferences(user_id);

create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  alert_type text not null,
  title text not null,
  message text not null,
  action_link text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists alerts_user_idx on public.alerts(user_id, created_at desc);
create index if not exists alerts_user_unread_idx on public.alerts(user_id, read);
