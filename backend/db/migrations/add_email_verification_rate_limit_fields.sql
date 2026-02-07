alter table profiles
  add column if not exists email_verification_last_sent_at timestamptz,
  add column if not exists email_verification_send_count int not null default 0,
  add column if not exists email_verification_send_window_started_at timestamptz;
