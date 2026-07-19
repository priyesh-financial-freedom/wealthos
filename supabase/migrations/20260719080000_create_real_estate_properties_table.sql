create table if not exists public.real_estate_properties (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  property_name text not null,
  property_type text not null check (property_type in ('Apartment', 'Villa', 'Independent House', 'Plot', 'Commercial', 'Other')),
  owner text not null,
  purchase_date date,
  purchase_price numeric(14,2) not null check (purchase_price >= 0),
  current_market_value numeric(14,2) not null check (current_market_value >= 0),
  address text,
  city text not null,
  state text not null,
  pin_code text,
  occupancy_status text not null default 'self_occupied' check (occupancy_status in ('self_occupied', 'rented')),
  monthly_rent numeric(12,2) check (monthly_rent is null or monthly_rent >= 0),
  linked_home_loan_id uuid references public.liabilities(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((occupancy_status = 'rented' and coalesce(monthly_rent, 0) >= 0) or (occupancy_status = 'self_occupied'))
);

alter table public.real_estate_properties enable row level security;

drop policy if exists real_estate_properties_select_own on public.real_estate_properties;
create policy real_estate_properties_select_own on public.real_estate_properties
  for select using (auth.uid() = user_id);

drop policy if exists real_estate_properties_insert_own on public.real_estate_properties;
create policy real_estate_properties_insert_own on public.real_estate_properties
  for insert with check (auth.uid() = user_id);

drop policy if exists real_estate_properties_update_own on public.real_estate_properties;
create policy real_estate_properties_update_own on public.real_estate_properties
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists real_estate_properties_delete_own on public.real_estate_properties;
create policy real_estate_properties_delete_own on public.real_estate_properties
  for delete using (auth.uid() = user_id);

drop trigger if exists real_estate_properties_set_updated_at on public.real_estate_properties;
create trigger real_estate_properties_set_updated_at
before update on public.real_estate_properties
for each row
execute function public.handle_updated_at();

insert into public.real_estate_properties (
  user_id,
  property_name,
  property_type,
  owner,
  purchase_date,
  purchase_price,
  current_market_value,
  city,
  state,
  occupancy_status,
  monthly_rent,
  notes,
  created_at,
  updated_at
)
select
  user_id,
  asset_name,
  'Other',
  coalesce(owner, 'Owner'),
  purchase_date,
  coalesce(purchase_value, current_value, 0),
  coalesce(current_value, 0),
  'Unknown',
  'Unknown',
  'self_occupied',
  0,
  notes,
  created_at,
  updated_at
from public.assets
where asset_type = 'real_estate'
  and not exists (
    select 1
    from public.real_estate_properties rep
    where rep.user_id = assets.user_id
      and rep.property_name = assets.asset_name
      and coalesce(rep.purchase_date::text, '') = coalesce(assets.purchase_date::text, '')
  );
