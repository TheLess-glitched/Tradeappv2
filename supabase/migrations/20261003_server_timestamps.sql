alter table public.catalogue
  alter column created_at set default now(),
  alter column updated_at set default now();

alter table public.catalogue_stock_movements
  alter column created_at set default now();

alter table public.catalogue_notes
  alter column created_at set default now();

alter table public.general_notes
  alter column created_at set default now(),
  alter column updated_at set default now();

alter table public.jobs
  add column if not exists completed_at timestamptz null;

create or replace function public.set_server_created_fields()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  new.created_at := now();
  if auth.uid() is not null then
    new.created_by := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_jobs_server_created_fields on public.jobs;
create trigger trg_jobs_server_created_fields
before insert on public.jobs
for each row execute function public.set_server_created_fields();

drop trigger if exists trg_catalogue_server_created_fields on public.catalogue;
create trigger trg_catalogue_server_created_fields
before insert on public.catalogue
for each row execute function public.set_server_created_fields();

drop trigger if exists trg_catalogue_stock_movements_server_created_fields on public.catalogue_stock_movements;
create trigger trg_catalogue_stock_movements_server_created_fields
before insert on public.catalogue_stock_movements
for each row execute function public.set_server_created_fields();

drop trigger if exists trg_customers_server_created_fields on public.customers;
create trigger trg_customers_server_created_fields
before insert on public.customers
for each row execute function public.set_server_created_fields();

drop trigger if exists trg_inventory_server_created_fields on public.inventory;
create trigger trg_inventory_server_created_fields
before insert on public.inventory
for each row execute function public.set_server_created_fields();

create or replace function public.prevent_immutable_audit_field_changes()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  -- SQL-editor-only bypass for deliberate maintenance/backfills:
  -- select set_config('app.allow_immutable_edit', 'on', true);
  if current_setting('app.allow_immutable_edit', true) = 'on' then
    return new;
  end if;

  if new.created_at is distinct from old.created_at then
    raise exception 'created_at is immutable';
  end if;
  if new.created_by is distinct from old.created_by then
    raise exception 'created_by is immutable';
  end if;
  if new.business_id is distinct from old.business_id then
    raise exception 'business_id is immutable';
  end if;
  if tg_table_name = 'jobs'
    and (to_jsonb(new) -> 'completed_at') is distinct from (to_jsonb(old) -> 'completed_at') then
    raise exception 'completed_at is server-managed';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_jobs_immutable_audit_fields on public.jobs;
create trigger trg_jobs_immutable_audit_fields
before update on public.jobs
for each row execute function public.prevent_immutable_audit_field_changes();

drop trigger if exists trg_catalogue_immutable_audit_fields on public.catalogue;
create trigger trg_catalogue_immutable_audit_fields
before update on public.catalogue
for each row execute function public.prevent_immutable_audit_field_changes();

drop trigger if exists trg_catalogue_stock_movements_immutable_audit_fields on public.catalogue_stock_movements;
create trigger trg_catalogue_stock_movements_immutable_audit_fields
before update on public.catalogue_stock_movements
for each row execute function public.prevent_immutable_audit_field_changes();

drop trigger if exists trg_customers_immutable_audit_fields on public.customers;
create trigger trg_customers_immutable_audit_fields
before update on public.customers
for each row execute function public.prevent_immutable_audit_field_changes();

drop trigger if exists trg_inventory_immutable_audit_fields on public.inventory;
create trigger trg_inventory_immutable_audit_fields
before update on public.inventory
for each row execute function public.prevent_immutable_audit_field_changes();

create or replace function public.set_server_updated_at()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_catalogue_server_updated_at on public.catalogue;
create trigger trg_catalogue_server_updated_at
before update on public.catalogue
for each row execute function public.set_server_updated_at();

drop trigger if exists trg_general_notes_server_updated_at on public.general_notes;
create trigger trg_general_notes_server_updated_at
before update on public.general_notes
for each row execute function public.set_server_updated_at();

create or replace function public.jobs_set_completed_at()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_setting('app.allow_immutable_edit', true) = 'on' then
    return new;
  end if;
  if new.status = 'done' or new.record_type = 'sale' then
    if tg_op = 'INSERT' or old.status is distinct from 'done' then
      new.completed_at := now();
    else
      new.completed_at := old.completed_at;
    end if;
  else
    new.completed_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_zz_jobs_completed_at on public.jobs;
create trigger trg_zz_jobs_completed_at
before insert or update on public.jobs
for each row execute function public.jobs_set_completed_at();

create or replace function public.jobs_set_server_local_date_time()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  new.date := to_char(now() at time zone 'Africa/Lagos', 'DD/MM/YYYY');
  new.time := to_char(now() at time zone 'Africa/Lagos', 'FMHH12:MI AM');
  return new;
end;
$$;

drop trigger if exists trg_zz_jobs_server_date_time on public.jobs;
create trigger trg_zz_jobs_server_date_time
before insert on public.jobs
for each row execute function public.jobs_set_server_local_date_time();

begin;
select set_config('app.allow_immutable_edit', 'on', true);
update public.jobs
set completed_at = created_at
where status = 'done' and completed_at is null;
commit;