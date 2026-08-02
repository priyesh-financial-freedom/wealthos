do $$
begin
  if to_regclass('public.month_end_close_items') is not null then
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'month_end_close_items' and column_name = 'opening_value') then
      alter table public.month_end_close_items alter column opening_value type numeric(20,2);
    end if;
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'month_end_close_items' and column_name = 'projected_value') then
      alter table public.month_end_close_items alter column projected_value type numeric(20,2);
    end if;
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'month_end_close_items' and column_name = 'actual_value') then
      alter table public.month_end_close_items alter column actual_value type numeric(20,2);
    end if;
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'month_end_close_items' and column_name = 'actual_balance') then
      alter table public.month_end_close_items alter column actual_balance type numeric(20,2);
    end if;
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'month_end_close_items' and column_name = 'absolute_variance') then
      alter table public.month_end_close_items alter column absolute_variance type numeric(20,2);
    end if;
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'month_end_close_items' and column_name = 'percentage_variance') then
      alter table public.month_end_close_items alter column percentage_variance type numeric(24,4);
    end if;
  end if;
end
$$;

do $$
begin
  if to_regclass('public.monthly_snapshots') is not null then
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'monthly_snapshots' and column_name = 'assets_total') then
      alter table public.monthly_snapshots alter column assets_total type numeric(20,2);
    end if;
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'monthly_snapshots' and column_name = 'liabilities_total') then
      alter table public.monthly_snapshots alter column liabilities_total type numeric(20,2);
    end if;
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'monthly_snapshots' and column_name = 'investments_total') then
      alter table public.monthly_snapshots alter column investments_total type numeric(20,2);
    end if;
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'monthly_snapshots' and column_name = 'net_worth') then
      alter table public.monthly_snapshots alter column net_worth type numeric(20,2);
    end if;
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'monthly_snapshots' and column_name = 'growth_from_previous_month') then
      alter table public.monthly_snapshots alter column growth_from_previous_month type numeric(20,2);
    end if;
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'monthly_snapshots' and column_name = 'growth_from_previous_year') then
      alter table public.monthly_snapshots alter column growth_from_previous_year type numeric(20,2);
    end if;
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'monthly_snapshots' and column_name = 'cash_and_bank_total') then
      alter table public.monthly_snapshots alter column cash_and_bank_total type numeric(20,2);
    end if;
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'monthly_snapshots' and column_name = 'retirement_total') then
      alter table public.monthly_snapshots alter column retirement_total type numeric(20,2);
    end if;
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'monthly_snapshots' and column_name = 'fixed_deposits_total') then
      alter table public.monthly_snapshots alter column fixed_deposits_total type numeric(20,2);
    end if;
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'monthly_snapshots' and column_name = 'gold_silver_total') then
      alter table public.monthly_snapshots alter column gold_silver_total type numeric(20,2);
    end if;
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'monthly_snapshots' and column_name = 'real_estate_total') then
      alter table public.monthly_snapshots alter column real_estate_total type numeric(20,2);
    end if;
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'monthly_snapshots' and column_name = 'vehicles_total') then
      alter table public.monthly_snapshots alter column vehicles_total type numeric(20,2);
    end if;
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'monthly_snapshots' and column_name = 'other_assets_total') then
      alter table public.monthly_snapshots alter column other_assets_total type numeric(20,2);
    end if;
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'monthly_snapshots' and column_name = 'home_loan_total') then
      alter table public.monthly_snapshots alter column home_loan_total type numeric(20,2);
    end if;
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'monthly_snapshots' and column_name = 'car_loan_total') then
      alter table public.monthly_snapshots alter column car_loan_total type numeric(20,2);
    end if;
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'monthly_snapshots' and column_name = 'credit_cards_total') then
      alter table public.monthly_snapshots alter column credit_cards_total type numeric(20,2);
    end if;
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'monthly_snapshots' and column_name = 'personal_loan_total') then
      alter table public.monthly_snapshots alter column personal_loan_total type numeric(20,2);
    end if;
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'monthly_snapshots' and column_name = 'other_liabilities_total') then
      alter table public.monthly_snapshots alter column other_liabilities_total type numeric(20,2);
    end if;
  end if;
end
$$;

do $$
begin
  if to_regclass('public.monthly_asset_snapshots') is not null then
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'monthly_asset_snapshots' and column_name = 'current_value') then
      alter table public.monthly_asset_snapshots alter column current_value type numeric(20,2);
    end if;
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'monthly_asset_snapshots' and column_name = 'cost_basis') then
      alter table public.monthly_asset_snapshots alter column cost_basis type numeric(20,2);
    end if;
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'monthly_asset_snapshots' and column_name = 'gain_loss') then
      alter table public.monthly_asset_snapshots alter column gain_loss type numeric(20,2);
    end if;
  end if;
end
$$;

do $$
begin
  if to_regclass('public.monthly_investment_snapshots') is not null then
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'monthly_investment_snapshots' and column_name = 'current_value') then
      alter table public.monthly_investment_snapshots alter column current_value type numeric(20,2);
    end if;
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'monthly_investment_snapshots' and column_name = 'cost_basis') then
      alter table public.monthly_investment_snapshots alter column cost_basis type numeric(20,2);
    end if;
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'monthly_investment_snapshots' and column_name = 'gain_loss') then
      alter table public.monthly_investment_snapshots alter column gain_loss type numeric(20,2);
    end if;
  end if;
end
$$;

do $$
begin
  if to_regclass('public.monthly_liability_snapshots') is not null then
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'monthly_liability_snapshots' and column_name = 'current_value') then
      alter table public.monthly_liability_snapshots alter column current_value type numeric(20,2);
    end if;
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'monthly_liability_snapshots' and column_name = 'cost_basis') then
      alter table public.monthly_liability_snapshots alter column cost_basis type numeric(20,2);
    end if;
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'monthly_liability_snapshots' and column_name = 'gain_loss') then
      alter table public.monthly_liability_snapshots alter column gain_loss type numeric(20,2);
    end if;
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'monthly_liability_snapshots' and column_name = 'outstanding_balance') then
      alter table public.monthly_liability_snapshots alter column outstanding_balance type numeric(20,2);
    end if;
  end if;
end
$$;

do $$
begin
  if to_regclass('public.liabilities') is not null then
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'liabilities' and column_name = 'outstanding_amount') then
      alter table public.liabilities alter column outstanding_amount type numeric(20,2);
    end if;
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'liabilities' and column_name = 'original_amount') then
      alter table public.liabilities alter column original_amount type numeric(20,2);
    end if;
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'liabilities' and column_name = 'emi') then
      alter table public.liabilities alter column emi type numeric(20,2);
    end if;
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'liabilities' and column_name = 'credit_limit') then
      alter table public.liabilities alter column credit_limit type numeric(20,2);
    end if;
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'liabilities' and column_name = 'sanction_limit') then
      alter table public.liabilities alter column sanction_limit type numeric(20,2);
    end if;
  end if;
end
$$;

do $$
begin
  if to_regclass('public.projection_monthly_positions') is not null then
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'projection_monthly_positions' and column_name = 'opening_value') then
      alter table public.projection_monthly_positions alter column opening_value type numeric(20,2);
    end if;
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'projection_monthly_positions' and column_name = 'contribution') then
      alter table public.projection_monthly_positions alter column contribution type numeric(20,2);
    end if;
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'projection_monthly_positions' and column_name = 'growth') then
      alter table public.projection_monthly_positions alter column growth type numeric(20,2);
    end if;
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'projection_monthly_positions' and column_name = 'withdrawal') then
      alter table public.projection_monthly_positions alter column withdrawal type numeric(20,2);
    end if;
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'projection_monthly_positions' and column_name = 'closing_value') then
      alter table public.projection_monthly_positions alter column closing_value type numeric(20,2);
    end if;
  end if;
end
$$;