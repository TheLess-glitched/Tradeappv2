alter table public.business_invites add column if not exists business_name text null;
alter table public.business_members add column if not exists display_name text null;

-- create_invite now records the business name
drop function if exists public.create_invite();
create or replace function public.create_invite(p_business_name text default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
begin
  if auth.uid() is null or public.get_my_role(auth.uid()) is distinct from 'owner' then
    raise exception 'Only the business owner can create invites';
  end if;

  v_code := upper(encode(extensions.gen_random_bytes(5), 'hex'));
  insert into public.business_invites (business_id, code_hash, business_name)
  values (auth.uid(), encode(extensions.digest(v_code, 'sha256'), 'hex'),
          nullif(trim(p_business_name), ''));
  return v_code;
end;
$$;

-- preview: shows the business name without using up the code
create or replace function public.preview_invite(p_code text)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_hash text;
  v_invite record;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  v_hash := encode(extensions.digest(
    upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g')), 'sha256'), 'hex');
  select business_id, business_name into v_invite
  from public.business_invites
  where code_hash = v_hash and used_at is null and expires_at > now();

  if not found then
    raise exception 'Invalid or expired invite code';
  end if;

  if v_invite.business_id = auth.uid() then
    raise exception 'You cannot join your own business';
  end if;

  return coalesce(v_invite.business_name, 'this business');
end;
$$;

-- accept_invite now saves the worker's display name
drop function if exists public.accept_invite(text);
create or replace function public.accept_invite(p_code text, p_display_name text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text;
  v_invite record;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  v_hash := encode(extensions.digest(
    upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g')), 'sha256'), 'hex');
  select * into v_invite
  from public.business_invites
  where code_hash = v_hash and used_at is null and expires_at > now()
  for update;

  if not found then
    raise exception 'Invalid or expired invite code';
  end if;

  if v_invite.business_id = auth.uid() then
    raise exception 'You cannot join your own business';
  end if;

  if exists (select 1 from public.jobs where business_id = auth.uid())
     or exists (select 1 from public.catalogue where business_id = auth.uid())
     or exists (select 1 from public.customers where business_id = auth.uid()) then
    raise exception 'This account already has its own business data. Use a new account to join as a worker';
  end if;

  insert into public.business_members (business_id, user_id, role, display_name)
  values (v_invite.business_id, auth.uid(), 'worker', nullif(trim(p_display_name), ''))
  on conflict (business_id, user_id) do nothing;

  delete from public.business_members
  where business_id = auth.uid() and user_id = auth.uid() and role = 'owner';

  update public.business_invites
  set used_at = now(), used_by = auth.uid()
  where id = v_invite.id;

  return v_invite.business_id;
end;
$$;

-- member list now includes display names
drop function if exists public.list_business_members();
create or replace function public.list_business_members()
returns table(member_id uuid, member_role text, member_name text, email text, joined_at timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.get_my_role(auth.uid()) is distinct from 'owner' then
    raise exception 'Only the business owner can list members';
  end if;

  return query
    select bm.user_id, bm.role, bm.display_name, u.email::text, bm.created_at
    from public.business_members bm
    join auth.users u on u.id = bm.user_id
    where bm.business_id = auth.uid()
    order by bm.created_at;
end;
$$;

-- void_job: clear error for non-owners (existence of ids not leaked to outsiders)
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

  select id, record_type, quantity, catalogue_item_id, voided_at, business_id
    into v_job
  from public.jobs where id = p_job_id
  for update;

  if not found or not public.is_business_member(v_job.business_id) then
    return query select false, 0;
    return;
  end if;

  if public.get_my_role(v_job.business_id) is distinct from 'owner' then
    raise exception 'Only the business owner can void records';
  end if;

  if v_job.voided_at is not null then
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
      insert into public.catalogue_stock_movements
        (user_id, business_id, catalogue_item_id, movement_type, quantity, reason, created_by)
      values
        (v_job.business_id, v_job.business_id, v_job.catalogue_item_id, 'in',
         v_job.quantity, 'Sale voided', auth.uid());
      return query select true, v_job.quantity;
      return;
    end if;
  end if;

  return query select true, 0;
end;
$$;

-- Dropping a function removes its permissions, so grant them again
revoke execute on function public.create_invite(text) from public, anon;
revoke execute on function public.preview_invite(text) from public, anon;
revoke execute on function public.accept_invite(text, text) from public, anon;
revoke execute on function public.list_business_members() from public, anon;
grant execute on function public.create_invite(text) to authenticated;
grant execute on function public.preview_invite(text) to authenticated;
grant execute on function public.accept_invite(text, text) to authenticated;
grant execute on function public.list_business_members() to authenticated;
