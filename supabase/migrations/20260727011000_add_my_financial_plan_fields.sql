alter table public.planning_assumptions
  add column if not exists monthly_sip_amount numeric(18, 2),
  add column if not exists annual_prepayment_amount numeric(18, 2);

alter table public.planning_assumptions
  drop constraint if exists planning_assumptions_monthly_sip_amount_nonnegative_chk;

alter table public.planning_assumptions
  add constraint planning_assumptions_monthly_sip_amount_nonnegative_chk
  check (monthly_sip_amount is null or monthly_sip_amount >= 0) not valid;

alter table public.planning_assumptions
  drop constraint if exists planning_assumptions_annual_prepayment_amount_nonnegative_chk;

alter table public.planning_assumptions
  add constraint planning_assumptions_annual_prepayment_amount_nonnegative_chk
  check (annual_prepayment_amount is null or annual_prepayment_amount >= 0) not valid;

update public.planning_assumptions
set monthly_sip_amount = coalesce(monthly_sip_amount, 0),
    annual_prepayment_amount = coalesce(annual_prepayment_amount, 0)
where monthly_sip_amount is null
   or annual_prepayment_amount is null;
