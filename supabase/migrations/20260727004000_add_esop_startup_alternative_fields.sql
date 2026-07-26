alter table public.investment_holdings
  add column if not exists esop_vested_shares numeric(18, 4),
  add column if not exists esop_current_share_price numeric(18, 4),
  add column if not exists esop_grant_status text,
  add column if not exists startup_funding_round text,
  add column if not exists startup_ownership_percent numeric(8, 4),
  add column if not exists alternative_category text;

alter table public.investment_holdings
  drop constraint if exists investment_holdings_esop_grant_status_chk;

alter table public.investment_holdings
  add constraint investment_holdings_esop_grant_status_chk
  check (
    investment_type <> 'ESOPs'
    or esop_grant_status is null
    or esop_grant_status in ('Active', 'Fully Vested', 'Exercised', 'Expired')
  ) not valid;

alter table public.investment_holdings
  drop constraint if exists investment_holdings_esop_vested_nonnegative_chk;

alter table public.investment_holdings
  add constraint investment_holdings_esop_vested_nonnegative_chk
  check (
    investment_type <> 'ESOPs'
    or esop_vested_shares is null
    or esop_vested_shares >= 0
  ) not valid;

alter table public.investment_holdings
  drop constraint if exists investment_holdings_startup_ownership_percent_chk;

alter table public.investment_holdings
  add constraint investment_holdings_startup_ownership_percent_chk
  check (
    investment_type <> 'Startup Investments'
    or startup_ownership_percent is null
    or (startup_ownership_percent >= 0 and startup_ownership_percent <= 100)
  ) not valid;
