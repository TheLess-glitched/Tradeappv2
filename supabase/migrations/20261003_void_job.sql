alter table public.jobs
  add column if not exists voided_at timestamptz null,
  add column if not exists voided_by uuid null,
  add column if not exists void_reason text null;

alter table public.jobs
  add constraint jobs_void_requires_reason
  check (voided_at is null or (voided_by is not null and nullif(trim(void_reason), '') is not null));

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

-- Database-level: clients can no longer hard-delete financial rows.
-- (The SQL editor / postgres role is unaffected, so you can still clean test data there.)
revoke delete on public.jobs from authenticated, anon;
revoke delete on public.catalogue_stock_movements from authenticated, anon;