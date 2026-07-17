create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  asset_type text not null,
  asset_name text not null,
  institution text,
  current_value numeric not null default 0,
  purchase_value numeric,
  purchase_date date,
  owner text,
  notes text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table public.assets enable row level security;

create policy "Users can view their own assets" on public.assets
  for select using (auth.uid() = user_id);

create policy "Users can insert their own assets" on public.assets
  for insert with check (auth.uid() = user_id);

create policy "Users can update their own assets" on public.assets
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users can delete their own assets" on public.assets
  for delete using (auth.uid() = user_id);

create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger handle_assets_updated_at
before update on public.assets
for each row
execute function public.handle_updated_at();
