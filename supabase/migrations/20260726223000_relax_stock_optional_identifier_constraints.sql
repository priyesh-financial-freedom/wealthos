alter table public.investment_holdings
  drop constraint if exists investment_holdings_stock_isin_required_chk;

alter table public.investment_holdings
  drop constraint if exists investment_holdings_stock_demat_required_chk;
