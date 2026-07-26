alter table public.investment_holdings
  add column if not exists broker text,
  add column if not exists exchange text,
  add column if not exists isin text,
  add column if not exists average_purchase_price numeric(18, 4),
  add column if not exists demat_account_provider text,
  add column if not exists demat_account_number text;

alter table public.investment_holdings
  drop constraint if exists investment_holdings_stock_isin_required_chk;

alter table public.investment_holdings
  add constraint investment_holdings_stock_isin_required_chk
  check (
    investment_type <> 'Stocks'
    or (isin is not null and btrim(isin) <> '')
  ) not valid;

alter table public.investment_holdings
  drop constraint if exists investment_holdings_stock_demat_required_chk;

alter table public.investment_holdings
  add constraint investment_holdings_stock_demat_required_chk
  check (
    investment_type <> 'Stocks'
    or (demat_account_number is not null and btrim(demat_account_number) <> '')
  ) not valid;

create unique index if not exists investment_holdings_stock_business_key_idx
  on public.investment_holdings (user_id, lower(owner), lower(demat_account_number), upper(isin))
  where investment_type = 'Stocks'
    and owner is not null
    and demat_account_number is not null
    and isin is not null;

create index if not exists investment_holdings_stock_isin_lookup_idx
  on public.investment_holdings (user_id, upper(isin))
  where investment_type = 'Stocks' and isin is not null;
