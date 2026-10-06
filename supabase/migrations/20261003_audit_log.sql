-- Migration: 20261003_audit_log.sql
-- Description: Create append-only audit log table, tamper prevention trigger, and audit triggers for jobs, catalogue, catalogue_stock_movements, and customers.

-- 1. Create audit_log table
create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  table_name text not null,
  row_id text not null,
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  old_values jsonb null,
  new_values jsonb null,
  actor uuid null,
  created_at timestamptz not null default now()
);

-- Helpful indexes for audit log queries
create index if not exists idx_audit_log_business_created_at
  on public.audit_log (business_id, created_at desc);

create index if not exists idx_audit_log_table_row
  on public.audit_log (table_name, row_id);

-- 2. Enable RLS and configure business-scoped access
alter table public.audit_log enable row level security;

drop policy if exists "Users can view audit log for their business" on public.audit_log;
create policy "Users can view audit log for their business"
  on public.audit_log
  for select
  using (business_id = auth.uid());

-- Explicitly revoke write permissions from authenticated and anon roles
revoke insert, update, delete, truncate on table public.audit_log from authenticated, anon;
grant select on table public.audit_log to authenticated;

-- 3. BEFORE UPDATE OR DELETE trigger on audit_log to prevent modifications/deletions (even in SQL editor)
create or replace function public.prevent_audit_log_modification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'audit_log is append-only: UPDATE and DELETE operations are prohibited';
end;
$$;

drop trigger if exists trg_prevent_audit_log_modification on public.audit_log;
create trigger trg_prevent_audit_log_modification
before update or delete on public.audit_log
for each row execute function public.prevent_audit_log_modification();

-- 4. SECURITY DEFINER audit trigger function for monitored tables
create or replace function public.audit_table_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_values jsonb := null;
  v_new_values jsonb := null;
  v_business_id uuid;
  v_row_id text;
begin
  -- Skip UPDATEs where the only change is updated_at
  if tg_op = 'UPDATE' then
    if (to_jsonb(new) - 'updated_at') is not distinct from (to_jsonb(old) - 'updated_at') then
      return new;
    end if;
    v_old_values := to_jsonb(old);
    v_new_values := to_jsonb(new);
    v_row_id := coalesce(new.id::text, old.id::text);
    v_business_id := coalesce(
      nullif(to_jsonb(new)->>'business_id', '')::uuid,
      nullif(to_jsonb(old)->>'business_id', '')::uuid,
      nullif(to_jsonb(new)->>'user_id', '')::uuid,
      nullif(to_jsonb(old)->>'user_id', '')::uuid
    );
  elsif tg_op = 'INSERT' then
    v_new_values := to_jsonb(new);
    v_row_id := new.id::text;
    v_business_id := coalesce(
      nullif(to_jsonb(new)->>'business_id', '')::uuid,
      nullif(to_jsonb(new)->>'user_id', '')::uuid
    );
  elsif tg_op = 'DELETE' then
    v_old_values := to_jsonb(old);
    v_row_id := old.id::text;
    v_business_id := coalesce(
      nullif(to_jsonb(old)->>'business_id', '')::uuid,
      nullif(to_jsonb(old)->>'user_id', '')::uuid
    );
  end if;

  -- Fail-closed audit insert: if this fails, the parent write transaction aborts
  insert into public.audit_log (
    business_id,
    table_name,
    row_id,
    action,
    old_values,
    new_values,
    actor,
    created_at
  ) values (
    v_business_id,
    tg_table_name::text,
    v_row_id,
    tg_op,
    v_old_values,
    v_new_values,
    auth.uid(),
    now()
  );

  if tg_op = 'DELETE' then
    return old;
  else
    return new;
  end if;
end;
$$;

-- 5. Attach audit triggers to exactly the 4 target tables
-- Monitored: jobs, catalogue, catalogue_stock_movements, customers
-- Ignored per requirements: notifications, profiles, general_notes

drop trigger if exists trg_audit_jobs on public.jobs;
create trigger trg_audit_jobs
after insert or update or delete on public.jobs
for each row execute function public.audit_table_mutation();

drop trigger if exists trg_audit_catalogue on public.catalogue;
create trigger trg_audit_catalogue
after insert or update or delete on public.catalogue
for each row execute function public.audit_table_mutation();

drop trigger if exists trg_audit_catalogue_stock_movements on public.catalogue_stock_movements;
create trigger trg_audit_catalogue_stock_movements
after insert or update or delete on public.catalogue_stock_movements
for each row execute function public.audit_table_mutation();

drop trigger if exists trg_audit_customers on public.customers;
create trigger trg_audit_customers
after insert or update or delete on public.customers
for each row execute function public.audit_table_mutation();
