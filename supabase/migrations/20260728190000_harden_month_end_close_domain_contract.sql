alter table public.month_end_close_items
  drop constraint if exists month_end_close_items_item_key_allowed_chk;

alter table public.month_end_close_items
  add constraint month_end_close_items_item_key_allowed_chk
  check (
    item_key in (
      'bank_accounts',
      'mutual_funds',
      'stocks',
      'gold',
      'silver',
      'fixed_deposits',
      'epf',
      'ppf',
      'nps',
      'real_estate',
      'other_assets',
      'home_loans',
      'car_loans',
      'other_liabilities'
    )
  ) not valid;

alter table public.month_end_close_items
  drop constraint if exists month_end_close_items_entity_type_nonempty_chk;

alter table public.month_end_close_items
  add constraint month_end_close_items_entity_type_nonempty_chk
  check (btrim(entity_type) <> '') not valid;

alter table public.month_end_close_items
  drop constraint if exists month_end_close_items_entity_name_nonempty_chk;

alter table public.month_end_close_items
  add constraint month_end_close_items_entity_name_nonempty_chk
  check (btrim(entity_name) <> '') not valid;

alter table public.month_end_close_items
  drop constraint if exists month_end_close_items_sort_order_nonnegative_chk;

alter table public.month_end_close_items
  add constraint month_end_close_items_sort_order_nonnegative_chk
  check (sort_order >= 0) not valid;

alter table public.month_end_close_items
  validate constraint month_end_close_items_item_key_allowed_chk;

alter table public.month_end_close_items
  validate constraint month_end_close_items_entity_type_nonempty_chk;

alter table public.month_end_close_items
  validate constraint month_end_close_items_entity_name_nonempty_chk;

alter table public.month_end_close_items
  validate constraint month_end_close_items_sort_order_nonnegative_chk;
