create table if not exists public.contribution_policies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  target_account text,
  amount numeric(14,2) not null,
  currency text not null default 'INR',
  frequency text not null default 'MONTHLY' check (frequency in ('MONTHLY', 'QUARTERLY', 'ANNUALLY')),
  start_date date not null,
  end_date date,
  growth_strategy text not null default 'FIXED' check (growth_strategy in ('FIXED', 'STEP_UP_PERCENTAGE', 'STEP_UP_AMOUNT')),
  growth_rate numeric(9,4),
  growth_amount numeric(14,2),
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'PAUSED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (amount > 0),
  check (end_date is null or end_date >= start_date),
  check (growth_rate is null or growth_rate >= 0),
  check (growth_amount is null or growth_amount >= 0),
  check (growth_strategy != 'STEP_UP_PERCENTAGE' or growth_rate is not null),
  check (growth_strategy != 'STEP_UP_AMOUNT' or growth_amount is not null)
);

create table if not exists public.contribution_policy_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  policy_id uuid not null references public.contribution_policies(id) on delete cascade,
  event_type text not null check (
    event_type in (
      'POLICY_CREATED',
      'POLICY_UPDATED',
      'POLICY_DUPLICATED',
      'POLICY_PAUSED',
      'POLICY_RESUMED',
      'PREVIEW_GENERATED'
    )
  ),
  event_payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.contribution_policy_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  policy_id uuid not null references public.contribution_policies(id) on delete cascade,
  change_type text not null check (
    change_type in (
      'POLICY_CREATED',
      'POLICY_UPDATED',
      'POLICY_DUPLICATED',
      'POLICY_PAUSED',
      'POLICY_RESUMED'
    )
  ),
  snapshot jsonb not null,
  notes text,
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists contribution_policies_user_updated_idx
  on public.contribution_policies (user_id, updated_at desc);

create index if not exists contribution_policies_user_status_idx
  on public.contribution_policies (user_id, status);

create index if not exists contribution_policies_frequency_idx
  on public.contribution_policies (frequency);

create index if not exists contribution_policy_events_policy_occurred_idx
  on public.contribution_policy_events (policy_id, occurred_at desc);

create index if not exists contribution_policy_events_user_occurred_idx
  on public.contribution_policy_events (user_id, occurred_at desc);

create index if not exists contribution_policy_history_policy_recorded_idx
  on public.contribution_policy_history (policy_id, recorded_at desc);

create index if not exists contribution_policy_history_user_recorded_idx
  on public.contribution_policy_history (user_id, recorded_at desc);

alter table public.contribution_policies enable row level security;
alter table public.contribution_policy_events enable row level security;
alter table public.contribution_policy_history enable row level security;

drop policy if exists contribution_policies_select_own on public.contribution_policies;
create policy contribution_policies_select_own on public.contribution_policies
  for select using (auth.uid() = user_id);

drop policy if exists contribution_policies_insert_own on public.contribution_policies;
create policy contribution_policies_insert_own on public.contribution_policies
  for insert with check (auth.uid() = user_id);

drop policy if exists contribution_policies_update_own on public.contribution_policies;
create policy contribution_policies_update_own on public.contribution_policies
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists contribution_policies_delete_own on public.contribution_policies;
create policy contribution_policies_delete_own on public.contribution_policies
  for delete using (auth.uid() = user_id);

drop policy if exists contribution_policy_events_select_own on public.contribution_policy_events;
create policy contribution_policy_events_select_own on public.contribution_policy_events
  for select using (auth.uid() = user_id);

drop policy if exists contribution_policy_events_insert_own on public.contribution_policy_events;
create policy contribution_policy_events_insert_own on public.contribution_policy_events
  for insert with check (auth.uid() = user_id);

drop policy if exists contribution_policy_events_update_own on public.contribution_policy_events;
create policy contribution_policy_events_update_own on public.contribution_policy_events
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists contribution_policy_events_delete_own on public.contribution_policy_events;
create policy contribution_policy_events_delete_own on public.contribution_policy_events
  for delete using (auth.uid() = user_id);

drop policy if exists contribution_policy_history_select_own on public.contribution_policy_history;
create policy contribution_policy_history_select_own on public.contribution_policy_history
  for select using (auth.uid() = user_id);

drop policy if exists contribution_policy_history_insert_own on public.contribution_policy_history;
create policy contribution_policy_history_insert_own on public.contribution_policy_history
  for insert with check (auth.uid() = user_id);

drop policy if exists contribution_policy_history_update_own on public.contribution_policy_history;
create policy contribution_policy_history_update_own on public.contribution_policy_history
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists contribution_policy_history_delete_own on public.contribution_policy_history;
create policy contribution_policy_history_delete_own on public.contribution_policy_history
  for delete using (auth.uid() = user_id);

drop trigger if exists contribution_policies_set_updated_at on public.contribution_policies;
create trigger contribution_policies_set_updated_at
before update on public.contribution_policies
for each row
execute function public.handle_updated_at();

drop trigger if exists contribution_policy_events_set_updated_at on public.contribution_policy_events;
create trigger contribution_policy_events_set_updated_at
before update on public.contribution_policy_events
for each row
execute function public.handle_updated_at();

drop trigger if exists contribution_policy_history_set_updated_at on public.contribution_policy_history;
create trigger contribution_policy_history_set_updated_at
before update on public.contribution_policy_history
for each row
execute function public.handle_updated_at();
