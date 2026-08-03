alter table public.liabilities
  add column if not exists owner text,
  add column if not exists primary_borrower text,
  add column if not exists co_borrower text,
  add column if not exists prepayment_allowed boolean,
  add column if not exists prepayment_done_till_date numeric(12,2),
  add column if not exists future_prepayment_plan numeric(12,2),
  add column if not exists estimated_interest_saved numeric(12,2),
  add column if not exists revised_closure_date date,
  add column if not exists review_date date;

alter table public.liabilities
  drop constraint if exists liabilities_prepayment_done_till_date_check,
  drop constraint if exists liabilities_future_prepayment_plan_check,
  drop constraint if exists liabilities_estimated_interest_saved_check;

alter table public.liabilities
  add constraint liabilities_prepayment_done_till_date_check
  check (prepayment_done_till_date is null or prepayment_done_till_date >= 0),
  add constraint liabilities_future_prepayment_plan_check
  check (future_prepayment_plan is null or future_prepayment_plan >= 0),
  add constraint liabilities_estimated_interest_saved_check
  check (estimated_interest_saved is null or estimated_interest_saved >= 0);

alter table public.liabilities
  drop constraint if exists liabilities_liability_type_check;

update public.liabilities
set liability_type = 'Bank Overdraft'
where liability_type = 'Overdraft / Line of Credit';

alter table public.liabilities
  add constraint liabilities_liability_type_check
  check (
    liability_type in (
      'Home Loan',
      'Car Loan',
      'Education Loan',
      'Credit Card',
      'Bank Overdraft',
      'Personal Loan',
      'Other Liability'
    )
  );

alter table public.financial_goals
  add column if not exists beneficiary text not null default 'Priyesh + Shobhana';

alter table public.financial_goals
  drop constraint if exists financial_goals_beneficiary_check;

alter table public.financial_goals
  add constraint financial_goals_beneficiary_check
  check (beneficiary in ('Priyesh + Shobhana', 'Priyena Lal', 'Shobhit Lal'));

insert into public.ownership_types (name)
values
  ('Priyesh'),
  ('Shobhana'),
  ('Joint')
on conflict (name) do update
set updated_at = now();

delete from public.ownership_types where name in ('Individual', 'Household');

create or replace function public.bootstrap_household_for_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_household_id uuid;
  v_start_month date := date_trunc('month', now())::date;
  v_end_month date := (date_trunc('month', now())::date + interval '60 months')::date;
begin
  insert into public.households (
    user_id,
    name,
    base_currency,
    financial_year_start_month,
    planning_start_month,
    planning_end_month
  )
  values (
    p_user_id,
    'My Household',
    'INR',
    4,
    v_start_month,
    v_end_month
  )
  on conflict (user_id) do update
    set updated_at = now()
  returning id into v_household_id;

  if v_household_id is null then
    select id
      into v_household_id
    from public.households
    where user_id = p_user_id
    limit 1;
  end if;

  update public.household_members
  set full_name = 'Kumar Priyesh',
      relationship = 'Self',
      employment_status = 'Employed',
      is_primary_user = true,
      is_active = true
  where household_id = v_household_id
    and lower(full_name) = 'priyesh';

  insert into public.household_members (
    household_id,
    full_name,
    relationship,
    employment_status,
    is_primary_user,
    is_active
  )
  select
    v_household_id,
    'Kumar Priyesh',
    'Self',
    'Employed',
    true,
    true
  where not exists (
    select 1
    from public.household_members members
    where members.household_id = v_household_id
      and lower(members.full_name) = lower('Kumar Priyesh')
  );

  insert into public.household_members (
    household_id,
    full_name,
    relationship,
    employment_status,
    is_primary_user,
    is_active
  )
  select
    v_household_id,
    'Shobhana',
    'Spouse',
    'Homemaker',
    false,
    true
  where not exists (
    select 1
    from public.household_members members
    where members.household_id = v_household_id
      and lower(members.full_name) = lower('Shobhana')
  );

  insert into public.household_members (
    household_id,
    full_name,
    relationship,
    employment_status,
    is_primary_user,
    is_active
  )
  select
    v_household_id,
    'Priyena Lal',
    'Daughter',
    'Student',
    false,
    true
  where not exists (
    select 1
    from public.household_members members
    where members.household_id = v_household_id
      and lower(members.full_name) = lower('Priyena Lal')
  );

  insert into public.household_members (
    household_id,
    full_name,
    relationship,
    employment_status,
    is_primary_user,
    is_active
  )
  select
    v_household_id,
    'Shobhit Lal',
    'Son',
    'Student',
    false,
    true
  where not exists (
    select 1
    from public.household_members members
    where members.household_id = v_household_id
      and lower(members.full_name) = lower('Shobhit Lal')
  );

  update public.household_members
  set is_primary_user = false
  where household_id = v_household_id
    and lower(full_name) <> lower('Kumar Priyesh')
    and is_primary_user = true;

  update public.household_members
  set is_primary_user = true,
      is_active = true
  where household_id = v_household_id
    and lower(full_name) = lower('Kumar Priyesh');
end;
$$;

do $$
declare
  user_row record;
begin
  for user_row in
    select id
    from auth.users
  loop
    perform public.bootstrap_household_for_user(user_row.id);
  end loop;
end;
$$;
