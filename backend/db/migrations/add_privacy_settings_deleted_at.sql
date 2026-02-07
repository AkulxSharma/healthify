create table if not exists public.privacy_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_visibility text not null default 'friends' check (profile_visibility in ('public','friends','private')),
  activity_sharing boolean not null default true,
  data_analytics_consent boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create index if not exists privacy_settings_user_idx on public.privacy_settings(user_id);

create table if not exists public.data_export_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'processing' check (status in ('processing','completed','failed')),
  file_path text,
  download_url text,
  expires_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists data_export_jobs_user_idx on public.data_export_jobs(user_id, created_at desc);

alter table public.profiles add column if not exists deleted_at timestamptz;
alter table public.profiles add column if not exists deletion_scheduled_for timestamptz;
alter table public.profiles add column if not exists deletion_token text;
alter table public.profiles add column if not exists deletion_token_expires_at timestamptz;
alter table public.profiles add column if not exists is_active boolean not null default true;
