alter table public.investments
  add column if not exists broker text,
  add column if not exists exchange text,
  add column if not exists isin text,
  add column if not exists average_purchase_price numeric(18,4),
  add column if not exists sector text;
