create or replace function public.prevent_closed_month_end_close_mutation()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'closed' then
    if tg_op = 'UPDATE'
      and current_setting('app.month_end_close_reopen_context', true) = 'allow'
      and new.status = 'draft'
      and new.closed_at is null then
      return new;
    end if;

    raise exception 'Closed month-end records are immutable. Create a new version instead.';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

create or replace function public.reopen_latest_month_end_close(p_close_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_reason text := btrim(coalesce(p_reason, ''));
  v_target public.month_end_closes%rowtype;
  v_latest public.month_end_closes%rowtype;
  v_transitioned_at timestamptz := now();
begin
  if v_user_id is null then
    raise exception 'Authentication required.';
  end if;

  if p_close_id is null then
    raise exception 'Month-end close id is required.';
  end if;

  if v_reason = '' then
    raise exception 'A reason is required to reopen a closed financial period.';
  end if;

  select *
    into v_target
  from public.month_end_closes
  where id = p_close_id
    and user_id = v_user_id
  limit 1;

  if not found then
    raise exception 'Month-end close record not found.';
  end if;

  if v_target.status <> 'closed' then
    raise exception 'Only closed month-end records can be reopened.';
  end if;

  select *
    into v_latest
  from public.month_end_closes
  where user_id = v_user_id
    and status = 'closed'
  order by close_year desc, close_month desc, version_number desc
  limit 1;

  if not found or v_latest.id <> v_target.id then
    raise exception 'Only the latest closed month can be reopened.';
  end if;

  perform set_config('app.month_end_close_reopen_context', 'allow', true);

  update public.month_end_closes
  set status = 'draft',
      closed_at = null,
      reopen_reason = v_reason,
      reopened_at = v_transitioned_at
  where id = v_target.id
    and user_id = v_user_id;

  insert into public.month_end_close_period_audit (
    close_id,
    user_id,
    from_status,
    to_status,
    reason,
    transitioned_at
  )
  values (
    v_target.id,
    v_user_id,
    'closed',
    'open',
    v_reason,
    v_transitioned_at
  );
end;
$$;

revoke all on function public.reopen_latest_month_end_close(uuid, text) from public;
grant execute on function public.reopen_latest_month_end_close(uuid, text) to authenticated;
