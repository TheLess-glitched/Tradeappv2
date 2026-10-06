-- Record only: 20261003_check_job_deadlines_skip_voided.sql
-- Description: Cron check_job_deadlines function with voided job exclusion (and j.voided_at is null) in both loops.

create or replace function public.check_job_deadlines()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  -- Loop 1: Approaching deadlines (due within 24 hours / today, non-done, non-voided)
  for r in (
    select j.id, j.user_id, j.business_id, j.service, j.deadline, j.customer_name
    from public.jobs j
    where j.deadline is not null
      and j.status is distinct from 'done'
      and j.voided_at is null
      and (
        j.deadline::date = (now() at time zone 'Africa/Lagos')::date
        or j.deadline::date = ((now() at time zone 'Africa/Lagos') + interval '1 day')::date
      )
  ) loop
    insert into public.notifications (
      user_id,
      business_id,
      type,
      title,
      message,
      created_at
    )
    values (
      coalesce(r.business_id, r.user_id),
      coalesce(r.business_id, r.user_id),
      'deadline_approaching',
      'Job Deadline Approaching',
      'Job #' || r.id || ' (' || coalesce(r.service, 'Service') || ') for ' || coalesce(r.customer_name, 'customer') || ' is due on ' || r.deadline || '.',
      now()
    )
    on conflict do nothing;
  end loop;

  -- Loop 2: Overdue jobs (deadline in the past, non-done, non-voided)
  for r in (
    select j.id, j.user_id, j.business_id, j.service, j.deadline, j.customer_name
    from public.jobs j
    where j.deadline is not null
      and j.status is distinct from 'done'
      and j.voided_at is null
      and j.deadline::date < (now() at time zone 'Africa/Lagos')::date
  ) loop
    insert into public.notifications (
      user_id,
      business_id,
      type,
      title,
      message,
      created_at
    )
    values (
      coalesce(r.business_id, r.user_id),
      coalesce(r.business_id, r.user_id),
      'job_overdue',
      'Job Overdue',
      'Job #' || r.id || ' (' || coalesce(r.service, 'Service') || ') for ' || coalesce(r.customer_name, 'customer') || ' was due on ' || r.deadline || ' and is overdue.',
      now()
    )
    on conflict do nothing;
  end loop;
end;
$$;

grant execute on function public.check_job_deadlines() to authenticated, service_role;
