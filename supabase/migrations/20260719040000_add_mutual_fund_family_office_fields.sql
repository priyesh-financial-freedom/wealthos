alter table public.investments
  add column if not exists owner text,
  add column if not exists folio_number text,
  add column if not exists amfi_scheme_code text,
  add column if not exists sip_amount numeric(14,2),
  add column if not exists sip_date integer,
  add column if not exists investment_mode text,
  add column if not exists option_type text,
  add column if not exists broker_platform text,
  add column if not exists nominee text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'investments_sip_date_check'
      and conrelid = 'public.investments'::regclass
  ) then
    alter table public.investments
      add constraint investments_sip_date_check
      check (sip_date is null or sip_date between 1 and 31);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'investments_investment_mode_check'
      and conrelid = 'public.investments'::regclass
  ) then
    alter table public.investments
      add constraint investments_investment_mode_check
      check (investment_mode is null or investment_mode in ('Direct', 'Regular'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'investments_option_type_check'
      and conrelid = 'public.investments'::regclass
  ) then
    alter table public.investments
      add constraint investments_option_type_check
      check (option_type is null or option_type in ('Growth', 'IDCW'));
  end if;
end;
$$;

create index if not exists investments_user_folio_number_idx
  on public.investments (user_id, folio_number);

create index if not exists investments_amfi_scheme_code_idx
  on public.investments (amfi_scheme_code);
