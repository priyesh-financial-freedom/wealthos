create table if not exists public.investments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  investment_name text not null,
  category text not null check (
    category in (
      'Mutual Funds',
      'Stocks',
      'ETFs',
      'Bonds',
      'Fixed Deposits',
      'EPF',
      'PPF',
      'NPS',
      'Gold',
      'Silver',
      'Sovereign Gold Bonds',
      'Crypto',
      'Cash Equivalents'
    )
  ),
  units numeric(18,4) not null default 0 check (units >= 0),
  nav_price numeric(18,4) not null default 0 check (nav_price >= 0),
  cost_basis numeric(14,2) not null default 0 check (cost_basis >= 0),
  today_gain_loss numeric(14,2) not null default 0,
  sector text,
  amc text,
  region text not null default 'Domestic' check (region in ('Domestic', 'International')),
  purchase_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.investments enable row level security;

drop policy if exists investments_select_own on public.investments;
create policy investments_select_own on public.investments
  for select using (auth.uid() = user_id);

drop policy if exists investments_insert_own on public.investments;
create policy investments_insert_own on public.investments
  for insert with check (auth.uid() = user_id);

drop policy if exists investments_update_own on public.investments;
create policy investments_update_own on public.investments
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists investments_delete_own on public.investments;
create policy investments_delete_own on public.investments
  for delete using (auth.uid() = user_id);

create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger investments_set_updated_at
before update on public.investments
for each row
execute function public.handle_updated_at();