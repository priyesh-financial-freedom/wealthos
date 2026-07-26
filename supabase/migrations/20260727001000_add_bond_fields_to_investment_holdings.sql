alter table public.investment_holdings
  add column if not exists issuer text,
  add column if not exists bond_name text,
  add column if not exists bond_type text,
  add column if not exists face_value numeric(16, 2),
  add column if not exists coupon_rate numeric(10, 4),
  add column if not exists coupon_frequency text,
  add column if not exists purchase_price numeric(16, 4),
  add column if not exists current_market_price numeric(16, 4);

alter table public.investment_holdings
  drop constraint if exists investment_holdings_bond_face_value_nonnegative_chk;

alter table public.investment_holdings
  add constraint investment_holdings_bond_face_value_nonnegative_chk
  check (
    investment_type <> 'Bonds'
    or face_value is null
    or face_value >= 0
  ) not valid;

alter table public.investment_holdings
  drop constraint if exists investment_holdings_bond_coupon_rate_nonnegative_chk;

alter table public.investment_holdings
  add constraint investment_holdings_bond_coupon_rate_nonnegative_chk
  check (
    investment_type <> 'Bonds'
    or coupon_rate is null
    or coupon_rate >= 0
  ) not valid;

alter table public.investment_holdings
  drop constraint if exists investment_holdings_bond_purchase_price_nonnegative_chk;

alter table public.investment_holdings
  add constraint investment_holdings_bond_purchase_price_nonnegative_chk
  check (
    investment_type <> 'Bonds'
    or purchase_price is null
    or purchase_price >= 0
  ) not valid;

alter table public.investment_holdings
  drop constraint if exists investment_holdings_bond_current_market_price_nonnegative_chk;

alter table public.investment_holdings
  add constraint investment_holdings_bond_current_market_price_nonnegative_chk
  check (
    investment_type <> 'Bonds'
    or current_market_price is null
    or current_market_price >= 0
  ) not valid;

create unique index if not exists investment_holdings_bond_owner_isin_business_key_idx
  on public.investment_holdings (user_id, lower(owner), upper(isin))
  where investment_type = 'Bonds'
    and owner is not null
    and isin is not null
    and btrim(isin) <> '';

create unique index if not exists investment_holdings_bond_owner_issuer_name_business_key_idx
  on public.investment_holdings (user_id, lower(owner), lower(issuer), lower(bond_name))
  where investment_type = 'Bonds'
    and owner is not null
    and issuer is not null
    and bond_name is not null
    and (isin is null or btrim(isin) = '');
