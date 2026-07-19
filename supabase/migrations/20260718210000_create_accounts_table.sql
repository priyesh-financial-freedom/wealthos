create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  category text not null check (
    category in (
      'Bank Account',
      'Investment',
      'Retirement',
      'Fixed Income',
      'Real Estate',
      'Vehicle',
      'Precious Metals',
      'Liability',
      'Insurance',
      'Credit Card',
      'Other'
    )
  ),
  institution text,
  owner text,
  current_value numeric(14,2) not null default 0,
  currency text not null default 'INR',
  status text not null default 'active' check (status in ('active', 'inactive', 'closed', 'archived')),
  linked_item_type text check (linked_item_type in ('asset', 'investment', 'liability')),
  linked_item_id uuid,
  notes text,
  documents_placeholder text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.accounts enable row level security;

drop policy if exists accounts_select_own on public.accounts;
create policy accounts_select_own on public.accounts
  for select using (auth.uid() = user_id);

drop policy if exists accounts_insert_own on public.accounts;
create policy accounts_insert_own on public.accounts
  for insert with check (auth.uid() = user_id);

drop policy if exists accounts_update_own on public.accounts;
create policy accounts_update_own on public.accounts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists accounts_delete_own on public.accounts;
create policy accounts_delete_own on public.accounts
  for delete using (auth.uid() = user_id);

create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger accounts_set_updated_at
before update on public.accounts
for each row
execute function public.handle_updated_at();
