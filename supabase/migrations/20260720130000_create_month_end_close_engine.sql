create table if not exists public.month_end_closes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  close_month integer not null check (close_month between 1 and 12),
  close_year integer not null check (close_year >= 2000),
  version_number integer not null check (version_number >= 1),
  status text not null default 'draft' check (status in ('draft', 'closed')),
  projected_assets_total numeric(14,2) not null default 0,
  projected_liabilities_total numeric(14,2) not null default 0,
  projected_net_worth numeric(14,2) not null default 0,
  actual_assets_total numeric(14,2) not null default 0,
  actual_liabilities_total numeric(14,2) not null default 0,
  actual_net_worth numeric(14,2) not null default 0,
  month_over_month_change numeric(14,2) not null default 0,
  projection_variance numeric(14,2) not null default 0,
  supersedes_close_id uuid references public.month_end_closes(id) on delete set null,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, close_year, close_month, version_number)
);

create table if not exists public.month_end_close_items (
  id uuid primary key default gen_random_uuid(),
  close_id uuid not null references public.month_end_closes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  item_key text not null,
  item_label text not null,
  item_type text not null check (item_type in ('asset', 'liability')),
  sort_order integer not null,
  opening_value numeric(14,2) not null default 0,
  projected_value numeric(14,2) not null default 0,
  actual_value numeric(14,2) not null default 0,
  absolute_variance numeric(14,2) not null default 0,
  percentage_variance numeric(9,4),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (close_id, item_key)
);

create index if not exists month_end_closes_user_month_idx
  on public.month_end_closes (user_id, close_year desc, close_month desc, version_number desc);

create index if not exists month_end_close_items_close_idx
  on public.month_end_close_items (close_id, sort_order asc);

alter table public.month_end_closes enable row level security;
alter table public.month_end_close_items enable row level security;

drop policy if exists month_end_closes_select_own on public.month_end_closes;
create policy month_end_closes_select_own on public.month_end_closes
  for select using (auth.uid() = user_id);

drop policy if exists month_end_closes_insert_own on public.month_end_closes;
create policy month_end_closes_insert_own on public.month_end_closes
  for insert with check (auth.uid() = user_id);

drop policy if exists month_end_closes_update_own on public.month_end_closes;
create policy month_end_closes_update_own on public.month_end_closes
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists month_end_closes_delete_own on public.month_end_closes;
create policy month_end_closes_delete_own on public.month_end_closes
  for delete using (auth.uid() = user_id);

drop policy if exists month_end_close_items_select_own on public.month_end_close_items;
create policy month_end_close_items_select_own on public.month_end_close_items
  for select using (auth.uid() = user_id);

drop policy if exists month_end_close_items_insert_own on public.month_end_close_items;
create policy month_end_close_items_insert_own on public.month_end_close_items
  for insert with check (auth.uid() = user_id);

drop policy if exists month_end_close_items_update_own on public.month_end_close_items;
create policy month_end_close_items_update_own on public.month_end_close_items
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists month_end_close_items_delete_own on public.month_end_close_items;
create policy month_end_close_items_delete_own on public.month_end_close_items
  for delete using (auth.uid() = user_id);

create or replace function public.prevent_closed_month_end_close_mutation()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'closed' then
    raise exception 'Closed month-end records are immutable. Create a new version instead.';
  end if;

  return new;
end;
$$;

create or replace function public.prevent_closed_month_end_close_item_mutation()
returns trigger
language plpgsql
as $$
declare
  v_status text;
begin
  select status
    into v_status
  from public.month_end_closes
  where id = old.close_id;

  if v_status = 'closed' then
    raise exception 'Closed month-end items are immutable. Create a new version instead.';
  end if;

  return new;
end;
$$;

drop trigger if exists month_end_closes_block_closed_update on public.month_end_closes;
create trigger month_end_closes_block_closed_update
before update on public.month_end_closes
for each row
execute function public.prevent_closed_month_end_close_mutation();

drop trigger if exists month_end_closes_block_closed_delete on public.month_end_closes;
create trigger month_end_closes_block_closed_delete
before delete on public.month_end_closes
for each row
execute function public.prevent_closed_month_end_close_mutation();

drop trigger if exists month_end_close_items_block_closed_update on public.month_end_close_items;
create trigger month_end_close_items_block_closed_update
before update on public.month_end_close_items
for each row
execute function public.prevent_closed_month_end_close_item_mutation();

drop trigger if exists month_end_close_items_block_closed_delete on public.month_end_close_items;
create trigger month_end_close_items_block_closed_delete
before delete on public.month_end_close_items
for each row
execute function public.prevent_closed_month_end_close_item_mutation();

drop trigger if exists month_end_closes_set_updated_at on public.month_end_closes;
create trigger month_end_closes_set_updated_at
before update on public.month_end_closes
for each row
execute function public.handle_updated_at();

drop trigger if exists month_end_close_items_set_updated_at on public.month_end_close_items;
create trigger month_end_close_items_set_updated_at
before update on public.month_end_close_items
for each row
execute function public.handle_updated_at();