alter table public.month_end_close_items
  add column if not exists actual_balance numeric(14,2),
  add column if not exists is_required boolean not null default true;

update public.month_end_close_items
set actual_balance = actual_value
where actual_balance is null;

alter table public.month_end_close_items
  drop constraint if exists month_end_close_items_actual_balance_nonnegative_chk;

alter table public.month_end_close_items
  add constraint month_end_close_items_actual_balance_nonnegative_chk
  check (actual_balance is null or actual_balance >= 0) not valid;

alter table public.month_end_close_items
  drop constraint if exists month_end_close_items_required_actual_balance_chk;

alter table public.month_end_close_items
  add constraint month_end_close_items_required_actual_balance_chk
  check (not is_required or actual_balance is not null) not valid;

alter table public.month_end_close_items
  validate constraint month_end_close_items_actual_balance_nonnegative_chk;

alter table public.month_end_close_items
  validate constraint month_end_close_items_required_actual_balance_chk;
