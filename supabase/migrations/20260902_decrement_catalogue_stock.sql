drop function if exists public.decrement_catalogue_stock(text);

create or replace function public.decrement_catalogue_stock(
  p_catalogue_item_id text
)
returns table(updated boolean, new_quantity int, reorder_level int)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_updated boolean;
  v_new_quantity int;
  v_reorder_level int;
begin
  update public.catalogue
  set quantity = greatest(quantity - 1, 0),
      updated_at = now()
  where id::text = p_catalogue_item_id
    and user_id = auth.uid()
    and track_stock = true
  returning quantity::int, catalogue.reorder_level::int
  into v_new_quantity, v_reorder_level;

  v_updated := found;

  if v_updated then
    insert into public.catalogue_stock_movements (
      user_id, catalogue_item_id, movement_type, quantity, reason
    ) values (
      auth.uid(), p_catalogue_item_id::uuid, 'out', 1, 'Job creation'
    );
  end if;

  return query select v_updated, v_new_quantity, v_reorder_level;
end;
$$;