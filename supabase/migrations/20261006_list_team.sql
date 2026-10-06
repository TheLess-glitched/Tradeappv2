create or replace function public.list_team()
returns table(member_name text, member_role text, joined_at timestamptz)
language plpgsql stable security definer set search_path = public
as $$
declare
  v_biz uuid;
begin
  v_biz := public.my_active_business();
  if auth.uid() is null or not public.is_business_member(v_biz) then
    raise exception 'Not a member of a business';
  end if;
  return query
    select coalesce(nullif(bm.display_name, ''),
                    case when bm.role = 'owner' then 'Owner' else 'Worker' end),
           bm.role,
           bm.created_at
    from public.business_members bm
    where bm.business_id = v_biz
    order by (bm.role = 'owner') desc, bm.created_at;
end;
$$;

revoke execute on function public.list_team() from public, anon;
grant execute on function public.list_team() to authenticated;
