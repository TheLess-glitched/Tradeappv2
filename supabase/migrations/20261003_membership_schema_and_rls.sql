-- Migration: 20261003_membership_schema_and_rls.sql
-- Description: PROMPT 9A — Membership schema + RLS + helper functions + rewritten RPCs (owner-only behavior identical)

-- ============================================================================
-- BLOCK 0: CREATE business_members TABLE & BACKFILL EXISTING OWNERS
-- ============================================================================

create table if not exists public.business_members (
  business_id uuid not null references auth.users(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'worker')),
  created_at timestamptz not null default now(),
  primary key (business_id, user_id)
);

create index if not exists idx_business_members_user_id on public.business_members(user_id);
create index if not exists idx_business_members_business_id on public.business_members(business_id);

-- Backfill: insert an owner row for every distinct existing business_id / user_id
insert into public.business_members (business_id, user_id, role)
select distinct b.biz_id, b.biz_id, 'owner'
from (
  select business_id as biz_id from public.catalogue where business_id is not null
  union
  select user_id as biz_id from public.catalogue where user_id is not null
  union
  select business_id as biz_id from public.jobs where business_id is not null
  union
  select user_id as biz_id from public.jobs where user_id is not null
  union
  select business_id as biz_id from public.customers where business_id is not null
  union
  select user_id as biz_id from public.customers where user_id is not null
  union
  select business_id as biz_id from public.inventory where business_id is not null
  union
  select user_id as biz_id from public.inventory where user_id is not null
  union
  select business_id as biz_id from public.catalogue_stock_movements where business_id is not null
  union
  select user_id as biz_id from public.catalogue_stock_movements where user_id is not null
  union
  select user_id as biz_id from public.catalogue_notes where user_id is not null
  union
  select user_id as biz_id from public.general_notes where user_id is not null
  union
  select business_id as biz_id from public.notifications where business_id is not null
  union
  select user_id as biz_id from public.notifications where user_id is not null
  union
  select business_id as biz_id from public.audit_log where business_id is not null
  union
  select id as biz_id from public.profiles
) b
where b.biz_id is not null
on conflict (business_id, user_id) do nothing;

-- Ensure new auth user signups get default owner membership for their business
create or replace function public.handle_new_user_business_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.business_members (business_id, user_id, role)
  values (new.id, new.id, 'owner')
  on conflict (business_id, user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_business_member on auth.users;
create trigger on_auth_user_created_business_member
  after insert on auth.users
  for each row execute function public.handle_new_user_business_membership();


-- ============================================================================
-- BLOCK 1: STABLE SECURITY DEFINER HELPERS
-- ============================================================================

create or replace function public.is_business_member(p_business_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_business_id is null or auth.uid() is null then
    return false;
  end if;

  return exists (
    select 1
    from public.business_members bm
    where bm.business_id = p_business_id
      and bm.user_id = auth.uid()
  );
end;
$$;

create or replace function public.get_my_role(p_business_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  if p_business_id is null or auth.uid() is null then
    return null;
  end if;

  select bm.role into v_role
  from public.business_members bm
  where bm.business_id = p_business_id
    and bm.user_id = auth.uid();

  return v_role;
end;
$$;

grant execute on function public.is_business_member(uuid) to authenticated, anon;
grant execute on function public.get_my_role(uuid) to authenticated, anon;


-- ============================================================================
-- BLOCK 2: COLUMN ADDITIONS, DEFAULTS, BACKFILLS & SERVER CREATED FIELDS TRIGGER
-- ============================================================================

-- Add business_id and created_by with auth.uid() defaults to catalogue_notes & general_notes
alter table public.catalogue_notes
  add column if not exists business_id uuid null default auth.uid(),
  add column if not exists created_by uuid null default auth.uid();

alter table public.catalogue_notes
  alter column business_id set default auth.uid(),
  alter column created_by set default auth.uid();

alter table public.general_notes
  add column if not exists business_id uuid null default auth.uid(),
  add column if not exists created_by uuid null default auth.uid();

alter table public.general_notes
  alter column business_id set default auth.uid(),
  alter column created_by set default auth.uid();

-- Backfill existing rows using the immutability bypass session setting
select set_config('app.allow_immutable_edit', 'on', true);

update public.catalogue_notes
set business_id = coalesce(business_id, user_id),
    created_by = coalesce(created_by, user_id)
where business_id is null or created_by is null;

update public.general_notes
set business_id = coalesce(business_id, user_id),
    created_by = coalesce(created_by, user_id)
where business_id is null or created_by is null;

create index if not exists idx_catalogue_notes_business_id on public.catalogue_notes(business_id);
create index if not exists idx_general_notes_business_id on public.general_notes(business_id);

-- Enforce created_at := now() and created_by := auth.uid()
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

drop trigger if exists trg_catalogue_notes_server_created_fields on public.catalogue_notes;
create trigger trg_catalogue_notes_server_created_fields
before insert on public.catalogue_notes
for each row execute function public.set_server_created_fields();

drop trigger if exists trg_general_notes_server_created_fields on public.general_notes;
create trigger trg_general_notes_server_created_fields
before insert on public.general_notes
for each row execute function public.set_server_created_fields();


-- ============================================================================
-- BLOCK 3: RLS ON business_members (NO RECURSION)
-- ============================================================================

alter table public.business_members enable row level security;

do $$
declare
  p record;
begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'business_members' loop
    execute format('drop policy %I on public.business_members', p.policyname);
  end loop;
end $$;

create policy "Members can view their business memberships"
  on public.business_members
  for select
  using (
    user_id = (select auth.uid()) or business_id = (select auth.uid())
  );

create policy "Owners can manage business members"
  on public.business_members
  for all
  using (
    business_id = (select auth.uid())
  )
  with check (
    business_id = (select auth.uid())
  );

grant select, insert, update, delete on public.business_members to authenticated;


-- ============================================================================
-- BLOCK 4A: RLS REWRITE — catalogue_notes (Lowest Risk)
-- ============================================================================

alter table public.catalogue_notes enable row level security;

do $$
declare
  p record;
begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'catalogue_notes' loop
    execute format('drop policy %I on public.catalogue_notes', p.policyname);
  end loop;
end $$;

create policy "Members can view catalogue notes"
  on public.catalogue_notes
  for select
  using (
    public.is_business_member(business_id)
  );

create policy "Members can insert catalogue notes"
  on public.catalogue_notes
  for insert
  with check (
    public.is_business_member(business_id)
    and (created_by = (select auth.uid()) or created_by is null)
  );

create policy "Owners or authors can update catalogue notes"
  on public.catalogue_notes
  for update
  using (
    public.get_my_role(business_id) = 'owner'
    or (public.is_business_member(business_id) and created_by = (select auth.uid()))
  )
  with check (
    public.get_my_role(business_id) = 'owner'
    or (public.is_business_member(business_id) and created_by = (select auth.uid()))
  );

create policy "Owners or authors can delete catalogue notes"
  on public.catalogue_notes
  for delete
  using (
    public.get_my_role(business_id) = 'owner'
    or (public.is_business_member(business_id) and created_by = (select auth.uid()))
  );

grant select, insert, update, delete on public.catalogue_notes to authenticated;


-- ============================================================================
-- BLOCK 4B: RLS REWRITE — general_notes
-- ============================================================================

alter table public.general_notes enable row level security;

do $$
declare
  p record;
begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'general_notes' loop
    execute format('drop policy %I on public.general_notes', p.policyname);
  end loop;
end $$;

create policy "Members can view general notes"
  on public.general_notes
  for select
  using (
    public.is_business_member(business_id)
  );

create policy "Members can insert general notes"
  on public.general_notes
  for insert
  with check (
    public.is_business_member(business_id)
    and (created_by = (select auth.uid()) or created_by is null)
  );

create policy "Owners or authors can update general notes"
  on public.general_notes
  for update
  using (
    public.get_my_role(business_id) = 'owner'
    or (public.is_business_member(business_id) and created_by = (select auth.uid()))
  )
  with check (
    public.get_my_role(business_id) = 'owner'
    or (public.is_business_member(business_id) and created_by = (select auth.uid()))
  );

create policy "Owners or authors can delete general notes"
  on public.general_notes
  for delete
  using (
    public.get_my_role(business_id) = 'owner'
    or (public.is_business_member(business_id) and created_by = (select auth.uid()))
  );

grant select, insert, update, delete on public.general_notes to authenticated;


-- ============================================================================
-- BLOCK 4C: RLS REWRITE — inventory
-- ============================================================================

alter table public.inventory enable row level security;

do $$
declare
  p record;
begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'inventory' loop
    execute format('drop policy %I on public.inventory', p.policyname);
  end loop;
end $$;

create policy "Members can view inventory"
  on public.inventory
  for select
  using (
    public.is_business_member(business_id)
  );

create policy "Owners can manage inventory"
  on public.inventory
  for all
  using (
    public.get_my_role(business_id) = 'owner'
  )
  with check (
    public.get_my_role(business_id) = 'owner'
  );

grant select, insert, update, delete on public.inventory to authenticated;


-- ============================================================================
-- BLOCK 4D: RLS REWRITE — customers
-- ============================================================================

alter table public.customers enable row level security;

do $$
declare
  p record;
begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'customers' loop
    execute format('drop policy %I on public.customers', p.policyname);
  end loop;
end $$;

create policy "Members can view customers"
  on public.customers
  for select
  using (
    public.is_business_member(business_id)
  );

create policy "Members can insert customers"
  on public.customers
  for insert
  with check (
    public.is_business_member(business_id)
  );

create policy "Owners can update customers"
  on public.customers
  for update
  using (
    public.get_my_role(business_id) = 'owner'
  )
  with check (
    public.get_my_role(business_id) = 'owner'
  );

create policy "Owners can delete customers"
  on public.customers
  for delete
  using (
    public.get_my_role(business_id) = 'owner'
  );

grant select, insert, update, delete on public.customers to authenticated;


-- ============================================================================
-- BLOCK 4E: RLS REWRITE — notifications
-- ============================================================================

alter table public.notifications enable row level security;

do $$
declare
  p record;
begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'notifications' loop
    execute format('drop policy %I on public.notifications', p.policyname);
  end loop;
end $$;

create policy "Users can view and manage their own notifications"
  on public.notifications
  for all
  using (
    user_id = (select auth.uid())
  )
  with check (
    user_id = (select auth.uid())
  );

create policy "Members can insert business notifications"
  on public.notifications
  for insert
  with check (
    public.is_business_member(business_id)
    or user_id = (select auth.uid())
  );

grant select, insert, update, delete on public.notifications to authenticated;


-- ============================================================================
-- BLOCK 4F: RLS REWRITE — catalogue
-- ============================================================================

alter table public.catalogue enable row level security;

do $$
declare
  p record;
begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'catalogue' loop
    execute format('drop policy %I on public.catalogue', p.policyname);
  end loop;
end $$;

-- Workers & owners can select catalogue items (names, prices, quantity)
create policy "Members can view catalogue items"
  on public.catalogue
  for select
  using (
    public.is_business_member(business_id)
  );

-- Only owners can insert, update, or delete catalogue items
create policy "Owners can manage catalogue"
  on public.catalogue
  for all
  using (
    public.get_my_role(business_id) = 'owner'
  )
  with check (
    public.get_my_role(business_id) = 'owner'
  );

grant select, insert, update, delete on public.catalogue to authenticated;


-- ============================================================================
-- BLOCK 4G: RLS REWRITE — catalogue_stock_movements
-- ============================================================================

alter table public.catalogue_stock_movements enable row level security;

do $$
declare
  p record;
begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'catalogue_stock_movements' loop
    execute format('drop policy %I on public.catalogue_stock_movements', p.policyname);
  end loop;
end $$;

-- Owners see all; workers only see rows where created_by = auth.uid()
create policy "Members can view stock movements"
  on public.catalogue_stock_movements
  for select
  using (
    public.get_my_role(business_id) = 'owner'
    or (
      public.is_business_member(business_id)
      and created_by = (select auth.uid())
    )
  );

-- Manual restocking from catalogue-detail.tsx is owner-only
create policy "Owners can insert stock movements"
  on public.catalogue_stock_movements
  for insert
  with check (
    public.get_my_role(business_id) = 'owner'
  );

-- Revoke client UPDATE and DELETE
grant select, insert on public.catalogue_stock_movements to authenticated;
revoke update, delete on public.catalogue_stock_movements from authenticated, anon;


-- ============================================================================
-- BLOCK 4H: RLS REWRITE — audit_log (Strict Owner Only)
-- ============================================================================

alter table public.audit_log enable row level security;

do $$
declare
  p record;
begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'audit_log' loop
    execute format('drop policy %I on public.audit_log', p.policyname);
  end loop;
end $$;

-- Strict owner-only access (workers must NEVER read audit_log)
create policy "Owners can view audit log for their business"
  on public.audit_log
  for select
  using (
    public.get_my_role(business_id) = 'owner'
  );

revoke insert, update, delete, truncate on table public.audit_log from authenticated, anon;
grant select on table public.audit_log to authenticated;


-- ============================================================================
-- BLOCK 4I: RLS REWRITE — jobs
-- ============================================================================

alter table public.jobs enable row level security;

do $$
declare
  p record;
begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'jobs' loop
    execute format('drop policy %I on public.jobs', p.policyname);
  end loop;
end $$;

-- Owners see all business jobs; workers only see jobs created by themselves
create policy "Members can view jobs"
  on public.jobs
  for select
  using (
    public.get_my_role(business_id) = 'owner'
    or (
      public.is_business_member(business_id)
      and created_by = (select auth.uid())
    )
  );

-- Members can insert standard jobs (record_type = 'job', voided_at is null); sales go through record_sale()
create policy "Members can insert jobs"
  on public.jobs
  for insert
  with check (
    public.is_business_member(business_id)
    and (created_by = (select auth.uid()) or created_by is null)
    and record_type = 'job'
    and voided_at is null
  );

-- Owners can update any job; workers can update jobs they created (guarded against restricted fields by trigger)
create policy "Members can update jobs"
  on public.jobs
  for update
  using (
    public.get_my_role(business_id) = 'owner'
    or (
      public.is_business_member(business_id)
      and created_by = (select auth.uid())
    )
  )
  with check (
    public.get_my_role(business_id) = 'owner'
    or (
      public.is_business_member(business_id)
      and created_by = (select auth.uid())
    )
  );

-- Worker update guard: cannot edit financial, stock, record type, item, or void fields
create or replace function public.check_worker_job_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_setting('app.allow_immutable_edit', true) = 'on' then
    return new;
  end if;

  if public.get_my_role(old.business_id) = 'worker' then
    if new.price is distinct from old.price
      or new.unit_price is distinct from old.unit_price
      or new.unit_cost is distinct from old.unit_cost
      or new.list_price is distinct from old.list_price
      or new.quantity is distinct from old.quantity
      or new.record_type is distinct from old.record_type
      or new.catalogue_item_id is distinct from old.catalogue_item_id
      or new.user_id is distinct from old.user_id
      or new.voided_at is distinct from old.voided_at
      or new.voided_by is distinct from old.voided_by
      or new.void_reason is distinct from old.void_reason then
      raise exception 'Workers are not permitted to modify financial, stock, record type, item, or void fields on jobs';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_check_worker_job_update on public.jobs;
create trigger trg_check_worker_job_update
before update on public.jobs
for each row execute function public.check_worker_job_update();

grant select, insert, update on public.jobs to authenticated;
revoke delete on public.jobs from authenticated, anon;


-- ============================================================================
-- BLOCK 5: REWRITTEN FUNCTIONS (decrement_catalogue_stock, record_sale, void_job)
-- ============================================================================

-- 1. decrement_catalogue_stock
create or replace function public.decrement_catalogue_stock(
  p_catalogue_item_id text,
  p_quantity integer default 1,
  p_reason text default 'Stock decrement'::text
)
returns table(
  updated boolean,
  new_quantity integer,
  reorder_level integer,
  crossed_threshold boolean
)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_updated boolean;
  v_previous_quantity int;
  v_new_quantity int;
  v_reorder_level int;
  v_crossed boolean;
  v_item_name text;
  v_item_unit text;
  v_biz_id uuid;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Quantity must be greater than zero';
  end if;

  select c.quantity, c.reorder_level, c.name, c.unit, c.business_id
  into v_previous_quantity, v_reorder_level, v_item_name, v_item_unit, v_biz_id
  from public.catalogue c
  where c.id::text = p_catalogue_item_id
    and public.is_business_member(c.business_id)
    and c.track_stock = true
  for update;

  -- Not found, not a member, or not a tracked item
  if v_previous_quantity is null then
    return query select false, null::int, null::int, false;
    return;
  end if;

  -- Insufficient stock
  if v_previous_quantity < p_quantity then
    return query select false, v_previous_quantity, null::int, false;
    return;
  end if;

  update public.catalogue
  set quantity = quantity - p_quantity,
      updated_at = now()
  where id::text = p_catalogue_item_id
  returning quantity::int, catalogue.reorder_level::int, catalogue.name, catalogue.unit
  into v_new_quantity, v_reorder_level, v_item_name, v_item_unit;

  v_updated := found;

  if v_updated then
    insert into public.catalogue_stock_movements (
      user_id, business_id, catalogue_item_id, movement_type, quantity, reason, created_by
    ) values (
      v_biz_id, v_biz_id, p_catalogue_item_id::uuid, 'out', p_quantity, p_reason, auth.uid()
    );

    v_crossed := v_reorder_level > 0
      and v_previous_quantity > v_reorder_level
      and v_new_quantity <= v_reorder_level;

    -- Low-stock notification addressed to OWNER (v_biz_id)
    if v_reorder_level > 0 and v_new_quantity <= v_reorder_level then
      insert into public.notifications (
        user_id, business_id, type, title, message, catalogue_item_id, is_read, created_by
      ) values (
        v_biz_id,
        v_biz_id,
        'low_stock',
        'Low stock: ' || v_item_name,
        v_item_name || ' just dropped to ' || v_new_quantity || ' ' || coalesce(v_item_unit, 'units') ||
          ' - at or below your reorder level of ' || v_reorder_level || '.',
        p_catalogue_item_id::uuid,
        false,
        auth.uid()
      );
    end if;
  else
    v_crossed := false;
  end if;

  return query select v_updated, v_new_quantity, v_reorder_level, v_crossed;
end;
$function$;

revoke execute on function public.decrement_catalogue_stock(text, integer, text) from public, anon;
grant execute on function public.decrement_catalogue_stock(text, integer, text) to authenticated;


-- 2. record_sale
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
security definer
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
  v_biz_id uuid;
  v_job_id bigint;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Quantity must be greater than zero';
  end if;

  if p_unit_price is null or p_unit_price <= 0 then
    raise exception 'Unit price must be greater than zero';
  end if;

  select c.quantity::integer, c.reorder_level::integer, c.name, c.unit,
         c.cost_price, c.selling_price, c.business_id
  into v_previous_quantity, v_reorder_level, v_item_name, v_item_unit,
       v_unit_cost, v_list_price, v_biz_id
  from public.catalogue c
  where c.id = p_catalogue_item_id
    and public.is_business_member(c.business_id)
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
  returning c.quantity::integer, c.reorder_level::integer, c.name, c.unit
  into v_new_quantity, v_reorder_level, v_item_name, v_item_unit;

  insert into public.catalogue_stock_movements (
    user_id, business_id, catalogue_item_id, movement_type, quantity, reason, created_by
  ) values (
    v_biz_id, v_biz_id, p_catalogue_item_id, 'out', p_quantity, p_reason, auth.uid()
  );

  v_crossed := coalesce(
    v_reorder_level > 0
    and v_previous_quantity > v_reorder_level
    and v_new_quantity <= v_reorder_level,
    false
  );

  -- Low-stock notification addressed to OWNER (v_biz_id)
  if coalesce(v_reorder_level, 0) > 0 and v_new_quantity <= v_reorder_level then
    insert into public.notifications (
      user_id, business_id, type, title, message, catalogue_item_id, is_read, created_by
    ) values (
      v_biz_id,
      v_biz_id,
      'low_stock',
      'Low stock: ' || v_item_name,
      v_item_name || ' just dropped to ' || v_new_quantity || ' ' ||
        coalesce(v_item_unit, 'units') ||
        ' - at or below your reorder level of ' || v_reorder_level || '.',
      p_catalogue_item_id,
      false,
      auth.uid()
    );
  end if;

  insert into public.jobs (
    user_id, business_id, created_by, record_type, customer_name, customer_phone, service,
    quantity, unit_price, unit_cost, list_price, catalogue_item_id,
    price, date, time
  ) values (
    v_biz_id, v_biz_id, auth.uid(), 'sale', null, null, v_item_name,
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


-- 3. void_job (Owner-only lookup)
create or replace function public.void_job(p_job_id bigint, p_reason text)
returns table(voided boolean, restored_quantity integer)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_job record;
begin
  if nullif(trim(p_reason), '') is null then
    raise exception 'A reason is required to void a record';
  end if;

  select id, record_type, quantity, catalogue_item_id, voided_at, business_id, created_by
    into v_job
  from public.jobs
  where id = p_job_id
    and public.get_my_role(business_id) = 'owner'
  for update;

  if not found or v_job.voided_at is not null then
    return query select false, 0;
    return;
  end if;

  update public.jobs
  set voided_at = now(), voided_by = auth.uid(), void_reason = trim(p_reason)
  where id = p_job_id;

  if v_job.record_type = 'sale' and v_job.catalogue_item_id is not null then
    update public.catalogue
    set quantity = quantity + v_job.quantity, updated_at = now()
    where id = v_job.catalogue_item_id
      and business_id = v_job.business_id
      and track_stock = true;

    if found then
      insert into public.catalogue_stock_movements (
        user_id, business_id, catalogue_item_id, movement_type, quantity, reason, created_by
      ) values (
        v_job.business_id, v_job.business_id, v_job.catalogue_item_id, 'in', v_job.quantity, 'Sale voided', auth.uid()
      );
      return query select true, v_job.quantity;
      return;
    end if;
  end if;

  return query select true, 0;
end;
$$;

revoke execute on function public.void_job(bigint, text) from public, anon;
grant execute on function public.void_job(bigint, text) to authenticated;


-- ============================================================================
-- VERIFICATION QUERY: LIST POLICIES PER TABLE
-- ============================================================================

select tablename, policyname, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;


-- ============================================================================
-- BLOCK 6: ROLLBACK SCRIPT (INCLUDED FOR REFERENCE / REVERTIBILITY)
-- ============================================================================
/*
-- ROLLBACK BLOCK START

-- 1. Restore original functions
create or replace function public.decrement_catalogue_stock(p_catalogue_item_id text, p_quantity integer DEFAULT 1, p_reason text DEFAULT 'Stock decrement'::text)
 returns table(updated boolean, new_quantity integer, reorder_level integer, crossed_threshold boolean)
 language plpgsql
 set search_path to 'public'
as $function$
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

  if v_previous_quantity is null then
    return query select false, null::int, null::int, false;
    return;
  end if;

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

create or replace function public.void_job(p_job_id bigint, p_reason text)
returns table(voided boolean, restored_quantity integer)
language plpgsql
set search_path to 'public'
as $$
declare
  v_job record;
begin
  if nullif(trim(p_reason), '') is null then
    raise exception 'A reason is required to void a record';
  end if;

  select id, record_type, quantity, catalogue_item_id, voided_at
    into v_job
  from public.jobs
  where id = p_job_id and user_id = auth.uid()
  for update;

  if not found or v_job.voided_at is not null then
    return query select false, 0;
    return;
  end if;

  update public.jobs
  set voided_at = now(), voided_by = auth.uid(), void_reason = trim(p_reason)
  where id = p_job_id and user_id = auth.uid();

  if v_job.record_type = 'sale' and v_job.catalogue_item_id is not null then
    update public.catalogue
    set quantity = quantity + v_job.quantity, updated_at = now()
    where id = v_job.catalogue_item_id and user_id = auth.uid() and track_stock = true;
    if found then
      insert into public.catalogue_stock_movements
        (user_id, catalogue_item_id, movement_type, quantity, reason)
      values
        (auth.uid(), v_job.catalogue_item_id, 'in', v_job.quantity, 'Sale voided');
      return query select true, v_job.quantity;
      return;
    end if;
  end if;

  return query select true, 0;
end;
$$;

-- Drop worker job update trigger
drop trigger if exists trg_check_worker_job_update on public.jobs;
drop function if exists public.check_worker_job_update();

-- Revert RLS policies to original
do $$
declare
  t text;
  p record;
begin
  for t in select unnest(array['jobs', 'audit_log', 'catalogue_stock_movements', 'catalogue', 'notifications', 'customers', 'inventory', 'general_notes', 'catalogue_notes', 'business_members']) loop
    for p in execute format('select policyname from pg_policies where schemaname = ''public'' and tablename = %L', t) loop
      execute format('drop policy %I on public.%I', p.policyname, t);
    end loop;
  end loop;
end $$;

create policy "Users can only access their own jobs" on public.jobs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can view audit log for their business" on public.audit_log for select using (business_id = auth.uid());
create policy "Users can only access their own stock movements" on public.catalogue_stock_movements for all using (auth.uid() = user_id);
grant select, insert on public.catalogue_stock_movements to authenticated;
create policy "Users can only access their own catalogue" on public.catalogue for all using (auth.uid() = user_id);
create policy "Users manage their own notifications" on public.notifications for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can only access their own customers" on public.customers for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can only access their own inventory" on public.inventory for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can only access their own general notes" on public.general_notes for all using (auth.uid() = user_id);
create policy "Users can only access their own catalogue notes" on public.catalogue_notes for all using (auth.uid() = user_id);

drop trigger if exists on_auth_user_created_business_member on auth.users;
drop function if exists public.handle_new_user_business_membership();
drop function if exists public.is_business_member(uuid);
drop function if exists public.get_my_role(uuid);
drop table if exists public.business_members;

-- ROLLBACK BLOCK END
*/