alter table public.investment_holdings
  add column if not exists fd_number text,
  add column if not exists interest_rate numeric(10, 4),
  add column if not exists compounding_frequency text,
  add column if not exists payout_type text,
  add column if not exists maturity_date date,
  add column if not exists maturity_value numeric(16, 2);

alter table public.investment_holdings
  drop constraint if exists investment_holdings_fd_compounding_frequency_chk;

alter table public.investment_holdings
  add constraint investment_holdings_fd_compounding_frequency_chk
  check (
    investment_type <> 'Fixed Deposits'
    or compounding_frequency is null
    or compounding_frequency in ('monthly', 'quarterly', 'half-yearly', 'yearly')
  ) not valid;

alter table public.investment_holdings
  drop constraint if exists investment_holdings_fd_payout_type_chk;

alter table public.investment_holdings
  add constraint investment_holdings_fd_payout_type_chk
  check (
    investment_type <> 'Fixed Deposits'
    or payout_type is null
    or payout_type in ('cumulative', 'monthly-payout', 'quarterly-payout', 'annual-payout')
  ) not valid;

alter table public.investment_holdings
  drop constraint if exists investment_holdings_fd_interest_rate_nonnegative_chk;

alter table public.investment_holdings
  add constraint investment_holdings_fd_interest_rate_nonnegative_chk
  check (
    investment_type <> 'Fixed Deposits'
    or interest_rate is null
    or interest_rate >= 0
  ) not valid;

alter table public.investment_holdings
  drop constraint if exists investment_holdings_fd_maturity_value_nonnegative_chk;

alter table public.investment_holdings
  add constraint investment_holdings_fd_maturity_value_nonnegative_chk
  check (
    investment_type <> 'Fixed Deposits'
    or maturity_value is null
    or maturity_value >= 0
  ) not valid;

create unique index if not exists investment_holdings_fd_business_key_idx
  on public.investment_holdings (user_id, lower(owner), lower(institution), lower(fd_number))
  where investment_type = 'Fixed Deposits'
    and owner is not null
    and institution is not null
    and fd_number is not null;
