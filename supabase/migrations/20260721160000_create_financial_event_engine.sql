create table if not exists public.financial_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_type text not null,
  source_id text not null,
  event_category text not null,
  event_type text not null,
  priority text not null default 'MEDIUM' check (priority in ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW')),
  scheduled_at timestamptz not null,
  executed_at timestamptz,
  amount numeric(14,2) not null check (amount >= 0),
  currency text not null default 'INR',
  status text not null default 'PENDING' check (status in ('PENDING', 'SCHEDULED', 'EXECUTED', 'FAILED')),
  correlation_id text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, correlation_id)
);

create table if not exists public.financial_event_execution (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.financial_events(id) on delete cascade,
  execution_start timestamptz not null,
  execution_end timestamptz not null,
  duration_ms integer not null default 0 check (duration_ms >= 0),
  result jsonb not null default '{}'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  error_message text,
  retry_count integer not null default 0 check (retry_count >= 0)
);

create index if not exists financial_events_user_scheduled_idx
  on public.financial_events (user_id, scheduled_at);

create index if not exists financial_events_status_idx
  on public.financial_events (status);

create index if not exists financial_events_category_idx
  on public.financial_events (event_category);

create index if not exists financial_events_source_idx
  on public.financial_events (source_type, source_id);

create index if not exists financial_events_correlation_idx
  on public.financial_events (correlation_id);

create index if not exists financial_event_execution_event_id_idx
  on public.financial_event_execution (event_id, execution_start desc);

alter table public.financial_events enable row level security;
alter table public.financial_event_execution enable row level security;

drop policy if exists financial_events_select_own on public.financial_events;
create policy financial_events_select_own on public.financial_events
  for select using (auth.uid() = user_id);

drop policy if exists financial_events_insert_own on public.financial_events;
create policy financial_events_insert_own on public.financial_events
  for insert with check (auth.uid() = user_id);

drop policy if exists financial_events_update_own on public.financial_events;
create policy financial_events_update_own on public.financial_events
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists financial_events_delete_own on public.financial_events;
create policy financial_events_delete_own on public.financial_events
  for delete using (false);

drop policy if exists financial_event_execution_select_own on public.financial_event_execution;
create policy financial_event_execution_select_own on public.financial_event_execution
  for select using (
    exists (
      select 1
      from public.financial_events events
      where events.id = financial_event_execution.event_id
        and events.user_id = auth.uid()
    )
  );

drop policy if exists financial_event_execution_insert_own on public.financial_event_execution;
create policy financial_event_execution_insert_own on public.financial_event_execution
  for insert with check (
    exists (
      select 1
      from public.financial_events events
      where events.id = financial_event_execution.event_id
        and events.user_id = auth.uid()
    )
  );

drop policy if exists financial_event_execution_update_own on public.financial_event_execution;
create policy financial_event_execution_update_own on public.financial_event_execution
  for update using (false) with check (false);

drop policy if exists financial_event_execution_delete_own on public.financial_event_execution;
create policy financial_event_execution_delete_own on public.financial_event_execution
  for delete using (false);

drop trigger if exists financial_events_set_updated_at on public.financial_events;
create trigger financial_events_set_updated_at
before update on public.financial_events
for each row
execute function public.handle_updated_at();
