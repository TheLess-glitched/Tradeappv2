alter table public.jobs add column if not exists created_by_name text null;

create or replace function public.set_job_created_by_name()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.created_by_name := null;  -- never trust a client-supplied name
  if auth.uid() is not null then
    select coalesce(nullif(bm.display_name, ''),
                    case when bm.role = 'owner' then 'Owner' else 'Worker' end)
      into new.created_by_name
    from public.business_members bm
    where bm.business_id = new.business_id and bm.user_id = auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_jobs_created_by_name on public.jobs;
create trigger trg_jobs_created_by_name before insert on public.jobs for each row execute function public.set_job_created_by_name();

create or replace function public.protect_created_by_name()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_setting('app.allow_immutable_edit', true) = 'on' then
    return new;
  end if;
  if new.created_by_name is distinct from old.created_by_name then
    raise exception 'created_by_name is immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_jobs_protect_created_by_name on public.jobs;
create trigger trg_jobs_protect_created_by_name before update on public.jobs for each row execute function public.protect_created_by_name();

-- Backfill existing rows (uses the maintenance bypass, in one transaction)
begin;
select set_config('app.allow_immutable_edit', 'on', true);
update public.jobs j
set created_by_name = coalesce(
  (select nullif(bm.display_name, '') from public.business_members bm
    where bm.business_id = j.business_id and bm.user_id = j.created_by),
  case when j.created_by = j.business_id then 'Owner' else 'Former worker' end
)
where j.created_by_name is null;
commit;
