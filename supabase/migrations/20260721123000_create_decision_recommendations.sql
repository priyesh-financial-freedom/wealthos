create table if not exists public.decision_recommendations (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  category text not null check (category in ('Retirement', 'Investment', 'Debt', 'Liquidity', 'Goals', 'Insurance', 'Estate', 'Tax', 'Portfolio', 'Cash Flow')),
  priority text not null check (priority in ('Critical', 'High', 'Medium', 'Low')),
  severity text not null check (severity in ('Red', 'Amber', 'Green')),
  reason text not null,
  recommended_action text not null,
  expected_benefit text not null,
  confidence numeric(5,2) not null check (confidence >= 0 and confidence <= 1),
  status text not null default 'Open' check (status in ('Open', 'Dismissed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists decision_recommendations_user_priority_idx
  on public.decision_recommendations (user_id, priority, updated_at desc);

alter table public.decision_recommendations enable row level security;

drop policy if exists decision_recommendations_select_own on public.decision_recommendations;
create policy decision_recommendations_select_own on public.decision_recommendations
  for select using (auth.uid() = user_id);

drop policy if exists decision_recommendations_insert_own on public.decision_recommendations;
create policy decision_recommendations_insert_own on public.decision_recommendations
  for insert with check (auth.uid() = user_id);

drop policy if exists decision_recommendations_update_own on public.decision_recommendations;
create policy decision_recommendations_update_own on public.decision_recommendations
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists decision_recommendations_delete_own on public.decision_recommendations;
create policy decision_recommendations_delete_own on public.decision_recommendations
  for delete using (auth.uid() = user_id);

drop trigger if exists decision_recommendations_set_updated_at on public.decision_recommendations;
create trigger decision_recommendations_set_updated_at
before update on public.decision_recommendations
for each row
execute function public.handle_updated_at();
