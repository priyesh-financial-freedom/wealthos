create table if not exists public.ownership_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  name text not null,
  base_currency text not null default 'INR',
  financial_year_start_month integer not null default 4 check (financial_year_start_month between 1 and 12),
  planning_start_month date not null,
  planning_end_month date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (planning_end_month > planning_start_month)
);

create table if not exists public.household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  full_name text not null,
  relationship text not null,
  date_of_birth date,
  retirement_date date,
  employment_status text,
  is_primary_user boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (retirement_date is null or date_of_birth is null or retirement_date > date_of_birth)
);

create index if not exists households_user_updated_idx
  on public.households (user_id, updated_at desc);

create index if not exists household_members_household_idx
  on public.household_members (household_id, updated_at desc);

create index if not exists household_members_active_idx
  on public.household_members (household_id, is_active);

create unique index if not exists household_members_one_primary_active_idx
  on public.household_members (household_id)
  where is_primary_user and is_active;

alter table public.ownership_types enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;

drop policy if exists ownership_types_select_authenticated on public.ownership_types;
create policy ownership_types_select_authenticated on public.ownership_types
  for select using (auth.role() = 'authenticated');

drop policy if exists households_select_own on public.households;
create policy households_select_own on public.households
  for select using (auth.uid() = user_id);

drop policy if exists households_insert_own on public.households;
create policy households_insert_own on public.households
  for insert with check (auth.uid() = user_id);

drop policy if exists households_update_own on public.households;
create policy households_update_own on public.households
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists households_delete_own on public.households;
create policy households_delete_own on public.households
  for delete using (auth.uid() = user_id);

drop policy if exists household_members_select_own on public.household_members;
create policy household_members_select_own on public.household_members
  for select using (
    exists (
      select 1
      from public.households households
      where households.id = household_members.household_id
        and households.user_id = auth.uid()
    )
  );

drop policy if exists household_members_insert_own on public.household_members;
create policy household_members_insert_own on public.household_members
  for insert with check (
    exists (
      select 1
      from public.households households
      where households.id = household_members.household_id
        and households.user_id = auth.uid()
    )
  );

drop policy if exists household_members_update_own on public.household_members;
create policy household_members_update_own on public.household_members
  for update using (
    exists (
      select 1
      from public.households households
      where households.id = household_members.household_id
        and households.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.households households
      where households.id = household_members.household_id
        and households.user_id = auth.uid()
    )
  );

drop policy if exists household_members_delete_own on public.household_members;
create policy household_members_delete_own on public.household_members
  for delete using (
    exists (
      select 1
      from public.households households
      where households.id = household_members.household_id
        and households.user_id = auth.uid()
    )
  );

create or replace function public.prevent_last_active_household_member_delete()
returns trigger
language plpgsql
as $$
declare
  active_count integer;
begin
  if old.is_active then
    select count(*)
      into active_count
    from public.household_members members
    where members.household_id = old.household_id
      and members.is_active;

    if active_count <= 1 then
      raise exception 'Cannot delete the last active household member.';
    end if;
  end if;

  return old;
end;
$$;

create or replace function public.bootstrap_household_for_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_household_id uuid;
  v_start_month date := date_trunc('month', now())::date;
  v_end_month date := (date_trunc('month', now())::date + interval '60 months')::date;
begin
  insert into public.households (
    user_id,
    name,
    base_currency,
    financial_year_start_month,
    planning_start_month,
    planning_end_month
  )
  values (
    p_user_id,
    'My Household',
    'INR',
    4,
    v_start_month,
    v_end_month
  )
  on conflict (user_id) do update
    set updated_at = now()
  returning id into v_household_id;

  if v_household_id is null then
    select id
      into v_household_id
    from public.households
    where user_id = p_user_id
    limit 1;
  end if;

  insert into public.household_members (
    household_id,
    full_name,
    relationship,
    employment_status,
    is_primary_user,
    is_active
  )
  select
    v_household_id,
    'Priyesh',
    'Self',
    'Employed',
    true,
    true
  where not exists (
    select 1
    from public.household_members members
    where members.household_id = v_household_id
      and members.full_name = 'Priyesh'
  );

  insert into public.household_members (
    household_id,
    full_name,
    relationship,
    employment_status,
    is_primary_user,
    is_active
  )
  select
    v_household_id,
    'Shobhana',
    'Spouse',
    'Homemaker',
    false,
    true
  where not exists (
    select 1
    from public.household_members members
    where members.household_id = v_household_id
      and members.full_name = 'Shobhana'
  );

  if not exists (
    select 1
    from public.household_members members
    where members.household_id = v_household_id
      and members.is_primary_user
      and members.is_active
  ) then
    update public.household_members
    set is_primary_user = true
    where id = (
      select members.id
      from public.household_members members
      where members.household_id = v_household_id
        and members.is_active
      order by members.created_at asc
      limit 1
    );
  end if;
end;
$$;

create or replace function public.bootstrap_household_on_user_create()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.bootstrap_household_for_user(new.id);
  return new;
end;
$$;

drop trigger if exists households_prevent_last_active_delete on public.household_members;
create trigger households_prevent_last_active_delete
before delete on public.household_members
for each row
execute function public.prevent_last_active_household_member_delete();

drop trigger if exists households_set_updated_at on public.households;
create trigger households_set_updated_at
before update on public.households
for each row
execute function public.handle_updated_at();

drop trigger if exists household_members_set_updated_at on public.household_members;
create trigger household_members_set_updated_at
before update on public.household_members
for each row
execute function public.handle_updated_at();

drop trigger if exists ownership_types_set_updated_at on public.ownership_types;
create trigger ownership_types_set_updated_at
before update on public.ownership_types
for each row
execute function public.handle_updated_at();

drop trigger if exists on_auth_user_created_household_bootstrap on auth.users;
create trigger on_auth_user_created_household_bootstrap
after insert on auth.users
for each row
execute function public.bootstrap_household_on_user_create();

insert into public.ownership_types (name)
values
  ('Individual'),
  ('Joint'),
  ('Household')
on conflict (name) do update
set updated_at = now();

do $$
declare
  user_row record;
begin
  for user_row in
    select id
    from auth.users
  loop
    perform public.bootstrap_household_for_user(user_row.id);
  end loop;
end;
$$;