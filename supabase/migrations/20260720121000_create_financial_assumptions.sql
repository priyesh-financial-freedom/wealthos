create table if not exists public.financial_assumptions (
	id uuid primary key default gen_random_uuid(),
	user_id uuid not null references auth.users(id) on delete cascade,
	scenario_key text not null default 'default',
	section text not null check (
		section in (
			'income',
			'investments',
			'inflation',
			'loans',
			'retirement',
			'tax',
			'planning'
		)
	),
	payload jsonb not null default '{}'::jsonb,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	unique (user_id, scenario_key, section)
);

alter table public.financial_assumptions enable row level security;

drop policy if exists financial_assumptions_select_own on public.financial_assumptions;
create policy financial_assumptions_select_own on public.financial_assumptions
	for select using (auth.uid() = user_id);

drop policy if exists financial_assumptions_insert_own on public.financial_assumptions;
create policy financial_assumptions_insert_own on public.financial_assumptions
	for insert with check (auth.uid() = user_id);

drop policy if exists financial_assumptions_update_own on public.financial_assumptions;
create policy financial_assumptions_update_own on public.financial_assumptions
	for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists financial_assumptions_delete_own on public.financial_assumptions;
create policy financial_assumptions_delete_own on public.financial_assumptions
	for delete using (auth.uid() = user_id);

drop trigger if exists financial_assumptions_set_updated_at on public.financial_assumptions;
create trigger financial_assumptions_set_updated_at
before update on public.financial_assumptions
for each row
execute function public.handle_updated_at();