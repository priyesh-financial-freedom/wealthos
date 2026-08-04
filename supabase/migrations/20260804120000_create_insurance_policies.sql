create table if not exists public.insurance_policies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  policy_name text not null,
  policy_type text not null check (
    policy_type in (
      'Life',
      'Health',
      'Vehicle',
      'Home',
      'Travel',
      'Personal Accident',
      'Critical Illness',
      'Term',
      'ULIP',
      'Other'
    )
  ),
  insurer text not null,
  policy_number text not null,
  owner text not null,
  covered_person text not null,
  nominee text,
  cover_amount numeric(14,2) not null default 0 check (cover_amount >= 0),
  premium_amount numeric(12,2) not null default 0 check (premium_amount >= 0),
  premium_frequency text not null default 'Monthly' check (
    premium_frequency in ('Monthly', 'Quarterly', 'Half-Yearly', 'Yearly', 'Single')
  ),
  start_date date,
  renewal_date date,
  maturity_date date,
  status text not null default 'Active' check (
    status in ('Active', 'Grace', 'Lapsed', 'Matured', 'Cancelled')
  ),
  include_in_cash_flow boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists insurance_policies_user_id_idx on public.insurance_policies (user_id);
create index if not exists insurance_policies_user_status_idx on public.insurance_policies (user_id, status);
create index if not exists insurance_policies_user_renewal_idx on public.insurance_policies (user_id, renewal_date);

alter table public.insurance_policies enable row level security;

drop policy if exists insurance_policies_select_own on public.insurance_policies;
create policy insurance_policies_select_own on public.insurance_policies
  for select using (auth.uid() = user_id);

drop policy if exists insurance_policies_insert_own on public.insurance_policies;
create policy insurance_policies_insert_own on public.insurance_policies
  for insert with check (auth.uid() = user_id);

drop policy if exists insurance_policies_update_own on public.insurance_policies;
create policy insurance_policies_update_own on public.insurance_policies
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists insurance_policies_delete_own on public.insurance_policies;
create policy insurance_policies_delete_own on public.insurance_policies
  for delete using (auth.uid() = user_id);

create or replace function public.set_insurance_policies_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists insurance_policies_set_updated_at on public.insurance_policies;
create trigger insurance_policies_set_updated_at
before update on public.insurance_policies
for each row
execute function public.set_insurance_policies_updated_at();
