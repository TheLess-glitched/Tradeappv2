-- Migration: 20261005_business_invites.sql
-- Description: Business invites and active business helpers for worker accounts

-- 1. Create business_invites table
create table if not exists public.business_invites (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references auth.users(id) on delete cascade,
  code text unique not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '48 hours'),
  used_at timestamptz,
  used_by uuid references auth.users(id) on delete set null
);

create index if not exists idx_business_invites_code on public.business_invites(code);
create index if not exists idx_business_invites_business_id on public.business_invites(business_id);

alter table public.business_invites enable row level security;

create policy "Owners can view and manage invites for their business"
  on public.business_invites
  for all
  using (
    business_id = (select auth.uid())
  )
  with check (
    business_id = (select auth.uid())
  );

grant select, insert, update, delete on public.business_invites to authenticated;

-- 2. my_active_business() helper
create or replace function public.my_active_business()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_biz_id uuid;
begin
  if auth.uid() is null then
    return null;
  end if;

  select bm.business_id into v_biz_id
  from public.business_members bm
  where bm.user_id = auth.uid()
  order by (case when bm.role = 'owner' then 1 else 2 end), bm.created_at desc
  limit 1;

  return v_biz_id;
end;
$$;

grant execute on function public.my_active_business() to authenticated, anon;

-- 3. create_invite() helper
create or replace function public.create_invite()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_biz_id uuid;
  v_role text;
  v_code text;
  v_chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_i integer;
  v_part1 text := '';
  v_part2 text := '';
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  v_biz_id := public.my_active_business();
  if v_biz_id is null then
    raise exception 'No active business found';
  end if;

  v_role := public.get_my_role(v_biz_id);
  if v_role <> 'owner' then
    raise exception 'Only the business owner can generate invite codes';
  end if;

  -- Generate 5-5 code formatted like ABCDE-12345
  loop
    v_part1 := '';
    v_part2 := '';
    for v_i in 1..5 loop
      v_part1 := v_part1 || substr(v_chars, floor(random() * length(v_chars) + 1)::integer, 1);
      v_part2 := v_part2 || substr(v_chars, floor(random() * length(v_chars) + 1)::integer, 1);
    end loop;
    v_code := v_part1 || '-' || v_part2;

    exit when not exists (select 1 from public.business_invites bi where bi.code = v_code);
  end loop;

  insert into public.business_invites (
    business_id,
    code,
    created_by,
    created_at,
    expires_at
  ) values (
    v_biz_id,
    v_code,
    auth.uid(),
    now(),
    now() + interval '48 hours'
  );

  return v_code;
end;
$$;

grant execute on function public.create_invite() to authenticated;

-- 4. accept_invite(p_code) helper
create or replace function public.accept_invite(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_normalized_code text;
  v_invite record;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to accept an invite';
  end if;

  v_normalized_code := upper(trim(p_code));
  if coalesce(v_normalized_code, '') = '' then
    raise exception 'Please provide an invite code';
  end if;

  select * into v_invite
  from public.business_invites
  where code = v_normalized_code;

  if not found then
    raise exception 'Invalid invite code. Please check and try again.';
  end if;

  if v_invite.used_at is not null then
    raise exception 'This invite code has already been used.';
  end if;

  if v_invite.expires_at < now() then
    raise exception 'This invite code has expired (valid for 48 hours).';
  end if;

  if v_invite.business_id = auth.uid() then
    raise exception 'You are already the owner of this business.';
  end if;

  -- Add caller as worker to the business
  insert into public.business_members (business_id, user_id, role, created_at)
  values (v_invite.business_id, auth.uid(), 'worker', now())
  on conflict (business_id, user_id)
  do update set role = 'worker';

  -- Mark invite code as used
  update public.business_invites
  set used_at = now(),
      used_by = auth.uid()
  where id = v_invite.id;

  return v_invite.business_id;
end;
$$;

grant execute on function public.accept_invite(text) to authenticated;

-- 5. list_business_members() helper
create or replace function public.list_business_members()
returns table (
  member_id uuid,
  member_role text,
  email text,
  joined_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_biz_id uuid;
  v_role text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  v_biz_id := public.my_active_business();
  if v_biz_id is null then
    raise exception 'No active business found';
  end if;

  v_role := public.get_my_role(v_biz_id);
  if v_role <> 'owner' then
    raise exception 'Only the business owner can view team members';
  end if;

  return query
  select
    bm.user_id as member_id,
    bm.role as member_role,
    coalesce(u.email, p.email, 'Worker') as email,
    bm.created_at as joined_at
  from public.business_members bm
  left join auth.users u on u.id = bm.user_id
  left join public.profiles p on p.id = bm.user_id
  where bm.business_id = v_biz_id
  order by (case when bm.role = 'owner' then 1 else 2 end), bm.created_at asc;
end;
$$;

grant execute on function public.list_business_members() to authenticated;
