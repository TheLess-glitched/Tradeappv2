alter table public.jobs
  add column if not exists sale_group_id uuid null;

create index if not exists idx_jobs_business_sale_group
  on public.jobs (business_id, sale_group_id)
  where sale_group_id is not null;

create or replace function public.record_sale_cart_v2(
  p_sale_id uuid,
  p_business_id uuid,
  p_lines jsonb,
  p_reason text default 'Sale',
  p_occurred_at timestamptz default now()
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_line jsonb;
  v_item_id uuid;
  v_quantity integer;
  v_unit_price numeric;
  v_previous_quantity integer;
  v_new_quantity integer;
  v_reorder_level integer;
  v_item_name text;
  v_item_unit text;
  v_unit_cost numeric;
  v_list_price numeric;
begin
  if auth.uid() is null or not public.is_business_member(p_business_id) then
    raise exception 'Not authorized to record sales for this business';
  end if;
  if p_sale_id is null then
    raise exception 'Sale id is required';
  end if;
  if jsonb_typeof(p_lines) is distinct from 'array'
     or jsonb_array_length(p_lines) = 0 then
    raise exception 'At least one sale line is required';
  end if;
  if p_occurred_at is null then
    raise exception 'Sale time is required';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_business_id::text || ':' || p_sale_id::text, 0)
  );

  if exists (
    select 1
    from public.jobs
    where business_id = p_business_id
      and sale_group_id = p_sale_id
      and record_type = 'sale'
  ) then
    return;
  end if;

  for v_line in
    select line.value
    from jsonb_array_elements(p_lines) as line(value)
    order by line.value ->> 'catalogue_item_id'
  loop
    v_item_id := (v_line ->> 'catalogue_item_id')::uuid;
    v_quantity := (v_line ->> 'quantity')::integer;
    v_unit_price := (v_line ->> 'unit_price')::numeric;
    if v_quantity is null or v_quantity <= 0 then
      raise exception 'Quantity must be greater than zero';
    end if;
    if v_unit_price is null or v_unit_price <= 0 then
      raise exception 'Unit price must be greater than zero';
    end if;

    select c.quantity::integer, c.reorder_level::integer, c.name, c.unit,
           c.cost_price, c.selling_price
    into v_previous_quantity, v_reorder_level, v_item_name, v_item_unit,
         v_unit_cost, v_list_price
    from public.catalogue c
    where c.id = v_item_id
      and c.business_id = p_business_id
      and c.track_stock = true
    for update;

    if not found or v_previous_quantity is null then
      raise exception 'Catalogue item is unavailable for sale';
    end if;
    if v_previous_quantity < v_quantity then
      raise exception using
        message = 'Not enough stock for ' || v_item_name,
        detail = jsonb_build_object(
          'catalogue_item_id', v_item_id,
          'available', v_previous_quantity
        )::text;
    end if;

    update public.catalogue
    set quantity = quantity - v_quantity,
        updated_at = now()
    where id = v_item_id
      and business_id = p_business_id
    returning quantity::integer, reorder_level::integer
    into v_new_quantity, v_reorder_level;

    insert into public.catalogue_stock_movements (
      user_id, business_id, catalogue_item_id, movement_type, quantity, reason, created_by
    ) values (
      p_business_id, p_business_id, v_item_id, 'out', v_quantity,
      coalesce(nullif(trim(p_reason), ''), 'Sale'), auth.uid()
    );

    if coalesce(v_reorder_level, 0) > 0 and v_new_quantity <= v_reorder_level then
      insert into public.notifications (
        user_id, business_id, type, title, message, catalogue_item_id, is_read, created_by
      ) values (
        p_business_id,
        p_business_id,
        'low_stock',
        'Low stock: ' || v_item_name,
        v_item_name || ' just dropped to ' || v_new_quantity || ' ' ||
          coalesce(v_item_unit, 'units') ||
          ' - at or below your reorder level of ' || v_reorder_level || '.',
        v_item_id,
        false,
        auth.uid()
      );
    end if;

    insert into public.jobs (
      user_id, business_id, created_by, record_type, customer_name, customer_phone,
      service, quantity, unit_price, unit_cost, list_price, catalogue_item_id,
      sale_group_id, price, date, time
    ) values (
      p_business_id, p_business_id, auth.uid(), 'sale', null, null,
      v_item_name, v_quantity, v_unit_price, v_unit_cost, v_list_price, v_item_id,
      p_sale_id, v_unit_price,
      to_char(p_occurred_at at time zone 'Africa/Lagos', 'DD/MM/YYYY'),
      to_char(p_occurred_at at time zone 'Africa/Lagos', 'FMHH12:MI AM')
    );
  end loop;
end;
$$;

revoke execute on function public.record_sale_cart_v2(uuid, uuid, jsonb, text, timestamptz)
  from public, anon;
grant execute on function public.record_sale_cart_v2(uuid, uuid, jsonb, text, timestamptz)
  to authenticated;
