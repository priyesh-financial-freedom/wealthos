alter table public.month_end_closes
  add column if not exists reopen_reason text,
  add column if not exists reopened_at timestamptz;
