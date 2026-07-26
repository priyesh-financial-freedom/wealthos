create table if not exists public.investment_holdings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  owner text not null,
  institution text not null,
  investment_name text not null,
  investment_type text not null check (
    investment_type in (
      'Mutual Funds',
      'Stocks',
      'Bonds',
      'Fixed Deposits',
      'Gold',
      'ESOPs',
      'Startup Investments',
      'Other Investments',
      'ETFs',
      'EPF',
      'PPF',
      'NPS',
      'Silver',
      'Sovereign Gold Bonds',
      'Crypto',
      'Cash Equivalents'
    )
  ),
  acquisition_date date,
  cost_value numeric(16,2) not null default 0 check (cost_value >= 0),
  current_value numeric(16,2) not null default 0 check (current_value >= 0),
  status text not null default 'active' check (status in ('active', 'inactive', 'closed')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists investment_holdings_user_type_idx
  on public.investment_holdings (user_id, investment_type, status);

create table if not exists public.investment_monthly_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  investment_id uuid not null references public.investment_holdings(id) on delete cascade,
  month_end_date date not null,
  closing_value numeric(16,2) not null check (closing_value >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, investment_id, month_end_date)
);

create index if not exists investment_monthly_history_user_date_idx
  on public.investment_monthly_history (user_id, month_end_date desc);

alter table public.investment_holdings enable row level security;
alter table public.investment_monthly_history enable row level security;

drop policy if exists investment_holdings_select_own on public.investment_holdings;
create policy investment_holdings_select_own on public.investment_holdings
  for select using (auth.uid() = user_id);

drop policy if exists investment_holdings_insert_own on public.investment_holdings;
create policy investment_holdings_insert_own on public.investment_holdings
  for insert with check (auth.uid() = user_id);

drop policy if exists investment_holdings_update_own on public.investment_holdings;
create policy investment_holdings_update_own on public.investment_holdings
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists investment_holdings_delete_own on public.investment_holdings;
create policy investment_holdings_delete_own on public.investment_holdings
  for delete using (auth.uid() = user_id);

drop policy if exists investment_monthly_history_select_own on public.investment_monthly_history;
create policy investment_monthly_history_select_own on public.investment_monthly_history
  for select using (auth.uid() = user_id);

drop policy if exists investment_monthly_history_insert_own on public.investment_monthly_history;
create policy investment_monthly_history_insert_own on public.investment_monthly_history
  for insert with check (auth.uid() = user_id);

drop policy if exists investment_monthly_history_update_own on public.investment_monthly_history;
create policy investment_monthly_history_update_own on public.investment_monthly_history
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists investment_monthly_history_delete_own on public.investment_monthly_history;
create policy investment_monthly_history_delete_own on public.investment_monthly_history
  for delete using (auth.uid() = user_id);

drop trigger if exists investment_holdings_set_updated_at on public.investment_holdings;
create trigger investment_holdings_set_updated_at
before update on public.investment_holdings
for each row
execute function public.handle_updated_at();

drop trigger if exists investment_monthly_history_set_updated_at on public.investment_monthly_history;
create trigger investment_monthly_history_set_updated_at
before update on public.investment_monthly_history
for each row
execute function public.handle_updated_at();
