CREATE OR REPLACE FUNCTION public.decrement_catalogue_stock(p_catalogue_item_id text, p_quantity integer DEFAULT 1, p_reason text DEFAULT 'Stock decrement'::text)
 RETURNS TABLE(updated boolean, new_quantity integer, reorder_level integer, crossed_threshold boolean)
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_updated boolean;
  v_previous_quantity int;
  v_new_quantity int;
  v_reorder_level int;
  v_crossed boolean;
  v_item_name text;
  v_item_unit text;
begin
  select quantity into v_previous_quantity
  from public.catalogue
  where id::text = p_catalogue_item_id
    and user_id = auth.uid()
    and track_stock = true
  for update;

  -- Not found, wrong owner, or not a tracked item at all
  if v_previous_quantity is null then
    return query select false, null::int, null::int, false;
    return;
  end if;

  -- Not enough stock - return the REAL current quantity so the client
  -- can say "Only X available" instead of a generic failure
  if v_previous_quantity < p_quantity then
    return query select false, v_previous_quantity, null::int, false;
    return;
  end if;

  update public.catalogue
  set quantity = quantity - p_quantity,
      updated_at = now()
  where id::text = p_catalogue_item_id
    and user_id = auth.uid()
    and track_stock = true
  returning quantity::int, catalogue.reorder_level::int, catalogue.name, catalogue.unit
  into v_new_quantity, v_reorder_level, v_item_name, v_item_unit;

  v_updated := found;

  if v_updated then
    insert into public.catalogue_stock_movements (
      user_id, catalogue_item_id, movement_type, quantity, reason
    ) values (
      auth.uid(), p_catalogue_item_id::uuid, 'out', p_quantity, p_reason
    );

    v_crossed := v_reorder_level > 0
      and v_previous_quantity > v_reorder_level
      and v_new_quantity <= v_reorder_level;

    if v_reorder_level > 0 and v_new_quantity <= v_reorder_level then
      insert into public.notifications (
        user_id, type, title, message, catalogue_item_id, is_read
      ) values (
        auth.uid(),
        'low_stock',
        'Low stock: ' || v_item_name,
        v_item_name || ' just dropped to ' || v_new_quantity || ' ' || v_item_unit ||
          ' - at or below your reorder level of ' || v_reorder_level || '.',
        p_catalogue_item_id::uuid,
        false
      );
    end if;
  else
    v_crossed := false;
  end if;

  return query select v_updated, v_new_quantity, v_reorder_level, v_crossed;
end;
$function$;