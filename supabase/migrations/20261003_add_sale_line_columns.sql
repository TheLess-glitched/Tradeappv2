alter table public.jobs
  add column if not exists quantity integer not null default 1 check (quantity > 0),
  add column if not exists unit_price numeric null,
  add column if not exists unit_cost numeric null,
  add column if not exists catalogue_item_id uuid null references public.catalogue(id) on delete set null,
  add column if not exists line_total numeric generated always as (quantity * coalesce(unit_price, price)) stored;