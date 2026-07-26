alter table public.investment_holdings
  add column if not exists documents_placeholder text;

alter table public.investments
  add column if not exists documents_placeholder text;
