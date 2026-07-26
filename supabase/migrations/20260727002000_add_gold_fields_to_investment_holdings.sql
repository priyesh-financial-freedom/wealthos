alter table public.investment_holdings
  add column if not exists gold_type text,
  add column if not exists gold_unit text,
  add column if not exists storage_location text;

alter table public.investment_holdings
  drop constraint if exists investment_holdings_gold_unit_chk;

alter table public.investment_holdings
  add constraint investment_holdings_gold_unit_chk
  check (
    investment_type <> 'Gold'
    or gold_unit is null
    or gold_unit in ('Gram', 'Kilogram', 'Tola')
  ) not valid;

alter table public.investment_holdings
  drop constraint if exists investment_holdings_gold_units_nonnegative_chk;

alter table public.investment_holdings
  add constraint investment_holdings_gold_units_nonnegative_chk
  check (
    investment_type <> 'Gold'
    or units is null
    or units >= 0
  ) not valid;
