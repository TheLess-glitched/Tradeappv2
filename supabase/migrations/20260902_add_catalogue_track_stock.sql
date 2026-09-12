alter table public.catalogue
add column if not exists track_stock boolean not null default false;