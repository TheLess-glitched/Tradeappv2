create or replace function public.create_own_business()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  if exists (select 1 from public.business_members where user_id = auth.uid()) then
    raise exception 'This account already belongs to a business';
  end if;
  insert into public.business_members (business_id, user_id, role)
  values (auth.uid(), auth.uid(), 'owner');
  return auth.uid();
end;
$$;

revoke execute on function public.create_own_business() from public, anon;
grant execute on function public.create_own_business() to authenticated;
