alter table public.bank_accounts
  add column if not exists include_in_net_worth boolean not null default true,
  add column if not exists include_in_cash_position boolean not null default true;

create index if not exists bank_accounts_include_flags_idx
  on public.bank_accounts (user_id, status, include_in_net_worth, include_in_cash_position);