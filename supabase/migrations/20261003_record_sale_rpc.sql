alter table public.jobs
  add column if not exists list_price numeric null;

create or replace function public.record_sale(
  p_catalogue_item_id uuid,
  p_quantity integer,
  p_unit_price numeric,
  p_reason text default 'Sale'
)
returns table(
  job_id bigint,
  updated boolean,
  new_quantity integer,
  reorder_level integer,
  crossed_threshold boolean
)
language plpgsql
security invoker
set search_path to 'public'
as $$
declare
  v_previous_quantity integer;
  v_new_quantity integer;
  v_reorder_level integer;
  v_crossed boolean;
  v_item_name text;
  v_item_unit text;
  v_unit_cost numeric;
  v_list_price numeric;
  v_job_id bigint;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Quantity must be greater than zero';
  end if;

  if p_unit_price is null or p_unit_price <= 0 then
    raise exception 'Unit price must be greater than zero';
  end if;

  select c.quantity::integer, c.reorder_level::integer, c.name, c.unit,
         c.cost_price, c.selling_price
  into v_previous_quantity, v_reorder_level, v_item_name, v_item_unit,
       v_unit_cost, v_list_price
  from public.catalogue c
  where c.id = p_catalogue_item_id
    and c.user_id = auth.uid()
    and c.track_stock = true
  for update;

  if not found or v_previous_quantity is null then
    return query select null::bigint, false, null::integer, null::integer, false;
    return;
  end if;

  if v_previous_quantity < p_quantity then
    return query select null::bigint, false, v_previous_quantity, null::integer, false;
    return;
  end if;

  update public.catalogue c
  set quantity = c.quantity - p_quantity,
      updated_at = now()
  where c.id = p_catalogue_item_id
    and c.user_id = auth.uid()
    and c.track_stock = true
  returning c.quantity::integer, c.reorder_level::integer, c.name, c.unit
  into v_new_quantity, v_reorder_level, v_item_name, v_item_unit;

  insert into public.catalogue_stock_movements (
    user_id, catalogue_item_id, movement_type, quantity, reason
  ) values (
    auth.uid(), p_catalogue_item_id, 'out', p_quantity, p_reason
  );

  v_crossed := coalesce(
    v_reorder_level > 0
    and v_previous_quantity > v_reorder_level
    and v_new_quantity <= v_reorder_level,
    false
  );

  if coalesce(v_reorder_level, 0) > 0 and v_new_quantity <= v_reorder_level then
    insert into public.notifications (
      user_id, type, title, message, catalogue_item_id, is_read
    ) values (
      auth.uid(),
      'low_stock',
      'Low stock: ' || v_item_name,
      v_item_name || ' just dropped to ' || v_new_quantity || ' ' ||
        coalesce(v_item_unit, 'units') ||
        ' - at or below your reorder level of ' || v_reorder_level || '.',
      p_catalogue_item_id,
      false
    );
  end if;

  insert into public.jobs (
    user_id, record_type, customer_name, customer_phone, service,
    quantity, unit_price, unit_cost, list_price, catalogue_item_id,
    price, date, time
  ) values (
    auth.uid(), 'sale', null, null, v_item_name,
    p_quantity, p_unit_price, v_unit_cost, v_list_price, p_catalogue_item_id,
    p_unit_price,
    to_char(now() at time zone 'Africa/Lagos', 'DD/MM/YYYY'),
    to_char(now() at time zone 'Africa/Lagos', 'FMHH12:MI AM')
  )
  returning id into v_job_id;

  return query select v_job_id, true, v_new_quantity, v_reorder_level, v_crossed;
end;
$$;

revoke execute on function public.record_sale(uuid, integer, numeric, text) from public, anon;
grant execute on function public.record_sale(uuid, integer, numeric, text) to authenticated;