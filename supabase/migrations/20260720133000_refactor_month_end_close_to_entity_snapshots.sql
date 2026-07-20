alter table public.month_end_closes
  drop column if exists projected_assets_total,
  drop column if exists projected_liabilities_total,
  drop column if exists projected_net_worth,
  drop column if exists actual_assets_total,
  drop column if exists actual_liabilities_total,
  drop column if exists actual_net_worth,
  drop column if exists month_over_month_change,
  drop column if exists projection_variance;

alter table public.month_end_close_items
  add column if not exists entity_id uuid,
  add column if not exists entity_type text,
  add column if not exists entity_name text;

update public.month_end_close_items
set entity_id = coalesce(entity_id, gen_random_uuid()),
    entity_type = coalesce(nullif(entity_type, ''), 'legacy-bucket'),
    entity_name = coalesce(nullif(entity_name, ''), item_label)
where entity_id is null
   or entity_type is null
   or entity_type = ''
   or entity_name is null
   or entity_name = '';

alter table public.month_end_close_items
  alter column entity_id set not null,
  alter column entity_type set not null,
  alter column entity_name set not null;

alter table public.month_end_close_items
  drop constraint if exists month_end_close_items_close_id_item_key_key;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'month_end_close_items_close_id_entity_identity_key'
  ) then
    alter table public.month_end_close_items
      add constraint month_end_close_items_close_id_entity_identity_key
      unique (close_id, entity_type, entity_id);
  end if;
end;
$$;

drop index if exists month_end_close_items_close_idx;
create index if not exists month_end_close_items_close_bucket_idx
  on public.month_end_close_items (close_id, item_key, sort_order asc);