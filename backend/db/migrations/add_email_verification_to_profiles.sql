alter table profiles
  add column if not exists email_verified boolean not null default false,
  add column if not exists email_verified_at timestamptz,
  add column if not exists email_verification_token text,
  add column if not exists email_verification_expires_at timestamptz;
