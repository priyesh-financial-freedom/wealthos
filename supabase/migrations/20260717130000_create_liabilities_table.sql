create table if not exists public.liabilities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  liability_type text not null check (
    liability_type in ('Home Loan', 'Car Loan', 'Personal Loan', 'Education Loan', 'Credit Card', 'Other')
  ),
  lender text not null,
  account_name text not null,
  outstanding_amount numeric(12,2) not null check (outstanding_amount >= 0),
  original_amount numeric(12,2) check (original_amount is null or original_amount >= 0),
  interest_rate numeric(5,2) check (interest_rate is null or interest_rate >= 0),
  emi numeric(12,2) check (emi is null or emi >= 0),
  start_date date,
  end_date date,
  due_day integer check (due_day is null or due_day between 1 and 31),
  status text not null default 'active' check (
    status in ('active', 'paid_off', 'pending', 'closed')
  ),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.liabilities enable row level security;

create policy if not exists liabilities_select_own on public.liabilities
  for select using (auth.uid() = user_id);

create policy if not exists liabilities_insert_own on public.liabilities
  for insert with check (auth.uid() = user_id);

create policy if not exists liabilities_update_own on public.liabilities
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy if not exists liabilities_delete_own on public.liabilities
  for delete using (auth.uid() = user_id);

create or replace function public.update_liabilities_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger liabilities_set_updated_at
before update on public.liabilities
for each row
execute function public.update_liabilities_updated_at();
