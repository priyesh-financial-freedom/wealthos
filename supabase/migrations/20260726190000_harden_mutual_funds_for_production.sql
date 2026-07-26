alter table public.investment_holdings
  add column if not exists amc text,
  add column if not exists amfi_scheme_code text,
  add column if not exists folio_number text,
  add column if not exists nominee text,
  add column if not exists investment_mode text check (investment_mode in ('Direct', 'Regular')),
  add column if not exists option_type text check (option_type in ('Growth', 'IDCW')),
  add column if not exists broker_platform text,
  add column if not exists region text not null default 'Domestic' check (region in ('Domestic', 'International')),
  add column if not exists sector text,
  add column if not exists units numeric(18, 6) not null default 0 check (units >= 0),
  add column if not exists nav_price numeric(16, 4) not null default 0 check (nav_price >= 0),
  add column if not exists sip_amount numeric(16, 2),
  add column if not exists sip_date integer check (sip_date between 1 and 31),
  add column if not exists purchase_date date;

create unique index if not exists investment_holdings_mf_business_key_idx
  on public.investment_holdings (user_id, lower(owner), lower(folio_number), lower(amfi_scheme_code))
  where investment_type = 'Mutual Funds'
    and owner is not null
    and folio_number is not null
    and amfi_scheme_code is not null;

create table if not exists public.mutual_fund_scheme_master (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scheme_name text not null,
  amc text not null,
  amfi_scheme_code text not null,
  investment_mode text check (investment_mode in ('Direct', 'Regular')),
  option_type text check (option_type in ('Growth', 'IDCW')),
  category text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, amfi_scheme_code)
);

create index if not exists mutual_fund_scheme_master_lookup_idx
  on public.mutual_fund_scheme_master (user_id, amc, scheme_name);

alter table public.mutual_fund_scheme_master enable row level security;

drop policy if exists mutual_fund_scheme_master_select_own on public.mutual_fund_scheme_master;
create policy mutual_fund_scheme_master_select_own on public.mutual_fund_scheme_master
  for select using (auth.uid() = user_id);

drop policy if exists mutual_fund_scheme_master_insert_own on public.mutual_fund_scheme_master;
create policy mutual_fund_scheme_master_insert_own on public.mutual_fund_scheme_master
  for insert with check (auth.uid() = user_id);

drop policy if exists mutual_fund_scheme_master_update_own on public.mutual_fund_scheme_master;
create policy mutual_fund_scheme_master_update_own on public.mutual_fund_scheme_master
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists mutual_fund_scheme_master_delete_own on public.mutual_fund_scheme_master;
create policy mutual_fund_scheme_master_delete_own on public.mutual_fund_scheme_master
  for delete using (auth.uid() = user_id);

drop trigger if exists mutual_fund_scheme_master_set_updated_at on public.mutual_fund_scheme_master;
create trigger mutual_fund_scheme_master_set_updated_at
before update on public.mutual_fund_scheme_master
for each row
execute function public.handle_updated_at();
