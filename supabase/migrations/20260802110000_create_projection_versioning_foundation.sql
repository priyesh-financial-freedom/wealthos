create table if not exists public.projection_plan_versions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  household_id uuid references public.households(id) on delete set null,
  plan_kind text not null check (plan_kind in ('FIXED', 'ROLLING', 'WHAT_IF')),
  version_no integer not null check (version_no >= 1),
  status text not null default 'DRAFT' check (status in ('DRAFT', 'LOCKED', 'ARCHIVED')),
  start_month date not null,
  horizon_end_month date not null,
  base_close_id uuid references public.month_end_closes(id) on delete set null,
  parent_fixed_version_id uuid references public.projection_plan_versions(id) on delete set null,
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (horizon_end_month >= start_month)
);

create table if not exists public.projection_assumption_snapshots (
  id uuid primary key default gen_random_uuid(),
  projection_plan_version_id uuid not null references public.projection_plan_versions(id) on delete cascade,
  assumption_payload jsonb not null default '{}'::jsonb,
  salary_policy_payload jsonb not null default '{}'::jsonb,
  retirement_policy_payload jsonb not null default '{}'::jsonb,
  drawdown_policy_payload jsonb not null default '{}'::jsonb,
  checksum text,
  created_at timestamptz not null default now()
);

create table if not exists public.projection_salary_curve (
  id uuid primary key default gen_random_uuid(),
  projection_plan_version_id uuid not null references public.projection_plan_versions(id) on delete cascade,
  month_key date not null,
  gross_salary numeric(14,2) not null default 0,
  basic_salary numeric(14,2) not null default 0,
  salary_growth_rate_used numeric(8,4) not null default 0,
  source text not null check (source in ('FIXED_LOCKED', 'ROLLING_REBASE')),
  created_at timestamptz not null default now()
);

create table if not exists public.projection_monthly_positions (
  id uuid primary key default gen_random_uuid(),
  projection_plan_version_id uuid not null references public.projection_plan_versions(id) on delete cascade,
  month_key date not null,
  bucket_key text not null,
  opening_value numeric(14,2) not null default 0,
  contribution numeric(14,2) not null default 0,
  growth numeric(14,2) not null default 0,
  withdrawal numeric(14,2) not null default 0,
  closing_value numeric(14,2) not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.projection_rebase_journal (
  id uuid primary key default gen_random_uuid(),
  rolling_version_id uuid not null references public.projection_plan_versions(id) on delete cascade,
  parent_fixed_version_id uuid not null references public.projection_plan_versions(id) on delete restrict,
  rebased_from_close_id uuid not null references public.month_end_closes(id) on delete restrict,
  rebased_month date not null,
  prior_rolling_version_id uuid references public.projection_plan_versions(id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index if not exists projection_plan_versions_user_kind_version_no_idx
  on public.projection_plan_versions (user_id, plan_kind, version_no);

create index if not exists projection_plan_versions_user_status_idx
  on public.projection_plan_versions (user_id, status, created_at desc);

create index if not exists projection_plan_versions_parent_fixed_idx
  on public.projection_plan_versions (parent_fixed_version_id);

create unique index if not exists projection_assumption_snapshots_plan_version_idx
  on public.projection_assumption_snapshots (projection_plan_version_id);

create unique index if not exists projection_salary_curve_plan_month_idx
  on public.projection_salary_curve (projection_plan_version_id, month_key);

create index if not exists projection_salary_curve_plan_created_idx
  on public.projection_salary_curve (projection_plan_version_id, created_at asc);

create unique index if not exists projection_monthly_positions_plan_month_bucket_idx
  on public.projection_monthly_positions (projection_plan_version_id, month_key, bucket_key);

create index if not exists projection_monthly_positions_plan_created_idx
  on public.projection_monthly_positions (projection_plan_version_id, created_at asc);

create unique index if not exists projection_rebase_journal_rolling_version_idx
  on public.projection_rebase_journal (rolling_version_id);

create index if not exists projection_rebase_journal_parent_fixed_idx
  on public.projection_rebase_journal (parent_fixed_version_id, created_at desc);

alter table public.projection_plan_versions enable row level security;
alter table public.projection_assumption_snapshots enable row level security;
alter table public.projection_salary_curve enable row level security;
alter table public.projection_monthly_positions enable row level security;
alter table public.projection_rebase_journal enable row level security;

drop policy if exists projection_plan_versions_select_own on public.projection_plan_versions;
create policy projection_plan_versions_select_own on public.projection_plan_versions
  for select using (auth.uid() = user_id);

drop policy if exists projection_plan_versions_insert_own on public.projection_plan_versions;
create policy projection_plan_versions_insert_own on public.projection_plan_versions
  for insert with check (auth.uid() = user_id);

drop policy if exists projection_plan_versions_update_own on public.projection_plan_versions;
create policy projection_plan_versions_update_own on public.projection_plan_versions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists projection_plan_versions_delete_own on public.projection_plan_versions;
create policy projection_plan_versions_delete_own on public.projection_plan_versions
  for delete using (auth.uid() = user_id);

drop policy if exists projection_assumption_snapshots_select_own on public.projection_assumption_snapshots;
create policy projection_assumption_snapshots_select_own on public.projection_assumption_snapshots
  for select using (
    exists (
      select 1
      from public.projection_plan_versions plan
      where plan.id = projection_assumption_snapshots.projection_plan_version_id
        and plan.user_id = auth.uid()
    )
  );

drop policy if exists projection_assumption_snapshots_insert_own on public.projection_assumption_snapshots;
create policy projection_assumption_snapshots_insert_own on public.projection_assumption_snapshots
  for insert with check (
    exists (
      select 1
      from public.projection_plan_versions plan
      where plan.id = projection_assumption_snapshots.projection_plan_version_id
        and plan.user_id = auth.uid()
    )
  );

drop policy if exists projection_assumption_snapshots_update_own on public.projection_assumption_snapshots;
create policy projection_assumption_snapshots_update_own on public.projection_assumption_snapshots
  for update using (
    exists (
      select 1
      from public.projection_plan_versions plan
      where plan.id = projection_assumption_snapshots.projection_plan_version_id
        and plan.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1
      from public.projection_plan_versions plan
      where plan.id = projection_assumption_snapshots.projection_plan_version_id
        and plan.user_id = auth.uid()
    )
  );

drop policy if exists projection_assumption_snapshots_delete_own on public.projection_assumption_snapshots;
create policy projection_assumption_snapshots_delete_own on public.projection_assumption_snapshots
  for delete using (
    exists (
      select 1
      from public.projection_plan_versions plan
      where plan.id = projection_assumption_snapshots.projection_plan_version_id
        and plan.user_id = auth.uid()
    )
  );

drop policy if exists projection_salary_curve_select_own on public.projection_salary_curve;
create policy projection_salary_curve_select_own on public.projection_salary_curve
  for select using (
    exists (
      select 1
      from public.projection_plan_versions plan
      where plan.id = projection_salary_curve.projection_plan_version_id
        and plan.user_id = auth.uid()
    )
  );

drop policy if exists projection_salary_curve_insert_own on public.projection_salary_curve;
create policy projection_salary_curve_insert_own on public.projection_salary_curve
  for insert with check (
    exists (
      select 1
      from public.projection_plan_versions plan
      where plan.id = projection_salary_curve.projection_plan_version_id
        and plan.user_id = auth.uid()
    )
  );

drop policy if exists projection_salary_curve_update_own on public.projection_salary_curve;
create policy projection_salary_curve_update_own on public.projection_salary_curve
  for update using (
    exists (
      select 1
      from public.projection_plan_versions plan
      where plan.id = projection_salary_curve.projection_plan_version_id
        and plan.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1
      from public.projection_plan_versions plan
      where plan.id = projection_salary_curve.projection_plan_version_id
        and plan.user_id = auth.uid()
    )
  );

drop policy if exists projection_salary_curve_delete_own on public.projection_salary_curve;
create policy projection_salary_curve_delete_own on public.projection_salary_curve
  for delete using (
    exists (
      select 1
      from public.projection_plan_versions plan
      where plan.id = projection_salary_curve.projection_plan_version_id
        and plan.user_id = auth.uid()
    )
  );

drop policy if exists projection_monthly_positions_select_own on public.projection_monthly_positions;
create policy projection_monthly_positions_select_own on public.projection_monthly_positions
  for select using (
    exists (
      select 1
      from public.projection_plan_versions plan
      where plan.id = projection_monthly_positions.projection_plan_version_id
        and plan.user_id = auth.uid()
    )
  );

drop policy if exists projection_monthly_positions_insert_own on public.projection_monthly_positions;
create policy projection_monthly_positions_insert_own on public.projection_monthly_positions
  for insert with check (
    exists (
      select 1
      from public.projection_plan_versions plan
      where plan.id = projection_monthly_positions.projection_plan_version_id
        and plan.user_id = auth.uid()
    )
  );

drop policy if exists projection_monthly_positions_update_own on public.projection_monthly_positions;
create policy projection_monthly_positions_update_own on public.projection_monthly_positions
  for update using (
    exists (
      select 1
      from public.projection_plan_versions plan
      where plan.id = projection_monthly_positions.projection_plan_version_id
        and plan.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1
      from public.projection_plan_versions plan
      where plan.id = projection_monthly_positions.projection_plan_version_id
        and plan.user_id = auth.uid()
    )
  );

drop policy if exists projection_monthly_positions_delete_own on public.projection_monthly_positions;
create policy projection_monthly_positions_delete_own on public.projection_monthly_positions
  for delete using (
    exists (
      select 1
      from public.projection_plan_versions plan
      where plan.id = projection_monthly_positions.projection_plan_version_id
        and plan.user_id = auth.uid()
    )
  );

drop policy if exists projection_rebase_journal_select_own on public.projection_rebase_journal;
create policy projection_rebase_journal_select_own on public.projection_rebase_journal
  for select using (
    exists (
      select 1
      from public.projection_plan_versions plan
      where plan.id = projection_rebase_journal.rolling_version_id
        and plan.user_id = auth.uid()
    )
  );

drop policy if exists projection_rebase_journal_insert_own on public.projection_rebase_journal;
create policy projection_rebase_journal_insert_own on public.projection_rebase_journal
  for insert with check (
    exists (
      select 1
      from public.projection_plan_versions plan
      where plan.id = projection_rebase_journal.rolling_version_id
        and plan.user_id = auth.uid()
    )
  );

drop policy if exists projection_rebase_journal_update_own on public.projection_rebase_journal;
create policy projection_rebase_journal_update_own on public.projection_rebase_journal
  for update using (false) with check (false);

drop policy if exists projection_rebase_journal_delete_own on public.projection_rebase_journal;
create policy projection_rebase_journal_delete_own on public.projection_rebase_journal
  for delete using (false);

drop trigger if exists projection_plan_versions_set_updated_at on public.projection_plan_versions;
create trigger projection_plan_versions_set_updated_at
before update on public.projection_plan_versions
for each row
execute function public.handle_updated_at();

-- TODO(phase-2): enforce immutable rows for LOCKED FIXED plans using database-level triggers.
