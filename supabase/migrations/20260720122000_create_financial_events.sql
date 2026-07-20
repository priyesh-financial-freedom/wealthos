create table if not exists public.financial_events (
    id uuid primary key default gen_random_uuid(),
      user_id uuid not null references auth.users(id) on delete cascade,
        scenario_key text not null default 'default',
          module text not null check (
              module in (
                    'assets',
                          'bank-accounts',
                                'investments',
                                      'fixed-deposits',
                                            'gold',
                                                  'silver',
                                                        'real-estate',
                                                              'retirement',
                                                                    'liabilities',
                                                                          'goals',
                                                                                'cash-flow'
                                                                                    )
                                                                                      ),
                                                                                        event_type text not null,
                                                                                          event_name text not null,
                                                                                            amount numeric(14,2) not null default 0,
                                                                                              event_date date not null,
                                                                                                frequency text not null default 'one-time' check (
                                                                                                    frequency in ('monthly', 'quarterly', 'annual', 'yearly', 'custom', 'one-time')
                                                                                                      ),
                                                                                                        repeat_every_months integer check (repeat_every_months is null or repeat_every_months > 0),
                                                                                                          starts_on date,
                                                                                                            ends_on date,
                                                                                                              is_enabled boolean not null default true,
                                                                                                                metadata jsonb not null default '{}'::jsonb,
                                                                                                                  created_at timestamptz not null default now(),
                                                                                                                    updated_at timestamptz not null default now(),
                                                                                                                      check (ends_on is null or starts_on is null or ends_on >= starts_on)
                                                                                                                      );

                                                                                                                      create index if not exists financial_events_user_scenario_idx
                                                                                                                        on public.financial_events(user_id, scenario_key);

                                                                                                                        create index if not exists financial_events_date_idx
                                                                                                                          on public.financial_events(event_date);

                                                                                                                          alter table public.financial_events enable row level security;

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
                                                                                                                                  for delete using (auth.uid() = user_id);

                                                                                                                                  drop trigger if exists financial_events_set_updated_at on public.financial_events;
                                                                                                                                  create trigger financial_events_set_updated_at
                                                                                                                                  before update on public.financial_events
                                                                                                                                  for each row
                                                                                                                                  execute function public.handle_updated_at();
                                                                                                                                  