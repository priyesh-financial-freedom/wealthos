create table if not exists public.contribution_policy_groups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

alter table public.contribution_policies
  add column if not exists policy_group_id uuid references public.contribution_policy_groups(id) on delete set null,
  add column if not exists formula_expression text,
  add column if not exists formula_variables jsonb,
  add column if not exists min_limit_amount numeric(14,2),
  add column if not exists max_limit_amount numeric(14,2),
  add column if not exists cash_protection_enabled boolean not null default false,
  add column if not exists goal_reference text;

create index if not exists contribution_policy_groups_user_updated_idx
  on public.contribution_policy_groups (user_id, updated_at desc);

create index if not exists contribution_policies_group_idx
  on public.contribution_policies (policy_group_id, updated_at desc);

create index if not exists contribution_policies_goal_reference_idx
  on public.contribution_policies (goal_reference);

alter table public.contribution_policy_groups enable row level security;

drop policy if exists contribution_policy_groups_select_own on public.contribution_policy_groups;
create policy contribution_policy_groups_select_own on public.contribution_policy_groups
  for select using (auth.uid() = user_id);

drop policy if exists contribution_policy_groups_insert_own on public.contribution_policy_groups;
create policy contribution_policy_groups_insert_own on public.contribution_policy_groups
  for insert with check (auth.uid() = user_id);

drop policy if exists contribution_policy_groups_update_own on public.contribution_policy_groups;
create policy contribution_policy_groups_update_own on public.contribution_policy_groups
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists contribution_policy_groups_delete_own on public.contribution_policy_groups;
create policy contribution_policy_groups_delete_own on public.contribution_policy_groups
  for delete using (auth.uid() = user_id);

drop trigger if exists contribution_policy_groups_set_updated_at on public.contribution_policy_groups;
create trigger contribution_policy_groups_set_updated_at
before update on public.contribution_policy_groups
for each row
execute function public.handle_updated_at();
