create table if not exists public.integrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('google_calendar','plaid','stripe')),
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  last_sync timestamptz,
  unique (user_id, provider)
);

create index if not exists integrations_user_provider_idx on public.integrations(user_id, provider);

create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  key_hash text not null unique,
  name text not null,
  scopes text[] not null default '{}',
  rate_limit integer not null default 1000,
  created_at timestamptz not null default now(),
  last_used timestamptz,
  status text not null default 'active'
);

create index if not exists api_keys_user_idx on public.api_keys(user_id);
create index if not exists api_keys_status_idx on public.api_keys(status);

create table if not exists public.webhooks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  url text not null,
  events text[] not null default '{}',
  secret text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  last_triggered timestamptz
);

create index if not exists webhooks_user_idx on public.webhooks(user_id);
create index if not exists webhooks_status_idx on public.webhooks(status);
