create table if not exists public.month_end_close_period_audit (
  id uuid primary key default gen_random_uuid(),
  close_id uuid not null references public.month_end_closes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  from_status text not null check (from_status in ('open', 'closed')),
  to_status text not null check (to_status in ('open', 'closed')),
  reason text,
  transitioned_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check (reason is null or btrim(reason) <> ''),
  check (
    (from_status = 'open' and to_status = 'closed')
    or (from_status = 'closed' and to_status = 'open')
  ),
  check (
    not (from_status = 'closed' and to_status = 'open')
    or (reason is not null and btrim(reason) <> '')
  )
);

create index if not exists month_end_close_period_audit_close_idx
  on public.month_end_close_period_audit (close_id, transitioned_at asc);

alter table public.month_end_close_period_audit enable row level security;

drop policy if exists month_end_close_period_audit_select_own on public.month_end_close_period_audit;
create policy month_end_close_period_audit_select_own on public.month_end_close_period_audit
  for select using (auth.uid() = user_id);

drop policy if exists month_end_close_period_audit_insert_own on public.month_end_close_period_audit;
create policy month_end_close_period_audit_insert_own on public.month_end_close_period_audit
  for insert with check (auth.uid() = user_id);

create or replace function public.prevent_month_end_close_period_audit_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Month-end close period audit entries are immutable.';
end;
$$;

drop trigger if exists month_end_close_period_audit_block_update on public.month_end_close_period_audit;
create trigger month_end_close_period_audit_block_update
before update on public.month_end_close_period_audit
for each row
execute function public.prevent_month_end_close_period_audit_mutation();

drop trigger if exists month_end_close_period_audit_block_delete on public.month_end_close_period_audit;
create trigger month_end_close_period_audit_block_delete
before delete on public.month_end_close_period_audit
for each row
execute function public.prevent_month_end_close_period_audit_mutation();
