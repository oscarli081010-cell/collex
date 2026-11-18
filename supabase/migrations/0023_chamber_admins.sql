-- Collex admins in Chambers, and fuller committee lists.
-- 1. A member is a Chair (the default) or an Admin. Only a Collex admin can put themselves on a committee as Admin,
--    from the Admin page. An Admin doesn't take one of the committee's 10 places, and can do what its owner does:
--    add and remove people and change the join code. The owner can't remove an Admin; an Admin leaves on their own.
-- 2. my_chambers and chamber_team say each person's role, and my_chambers carries the resolution, procedure, step,
--    number of states and number of people, for the Your Committees tab.
-- Only columns are added to what the functions return, so a page still running the last version keeps working.

alter table public.chamber_members add column role text not null default 'chair' check (role in ('chair', 'admin'));

-- The owner, or any Collex admin.
create function private.can_manage_chamber(cid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.chambers c where c.id = cid and c.owner_id = (select auth.uid()))
      or (select private.is_admin())
$$;
revoke execute on function private.can_manage_chamber(uuid) from public, anon;
grant execute on function private.can_manage_chamber(uuid) to authenticated;

-- How many of the 10 places are taken (Admins don't count).
create function private.chamber_seats(cid uuid) returns integer
language sql stable security definer set search_path = '' as $$
  select count(*)::integer from public.chamber_members where chamber_id = cid and role = 'chair'
$$;
revoke execute on function private.chamber_seats(uuid) from public, anon, authenticated;

create or replace function public.add_chamber_member(cid uuid, invitee_email text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  c record;
  who record;
  me text;
begin
  select id, owner_id into c from public.chambers where id = cid;
  if c.id is null or not private.can_manage_chamber(cid) then
    raise exception 'Only the person who shared this committee can add people' using errcode = '42501';
  end if;
  select id, email, full_name into who from public.profiles where lower(email) = lower(trim(invitee_email));
  if who.id is null then
    raise exception 'Nobody has a Collex account with that email yet. Ask them to sign up first, or give them the join code.' using errcode = 'P0002';
  end if;
  if who.id = c.owner_id then raise exception 'They already run this committee' using errcode = '23505'; end if;
  if exists (select 1 from public.chamber_members where chamber_id = cid and user_id = who.id) then
    raise exception 'They''re already on this committee' using errcode = '23505';
  end if;
  if private.chamber_seats(cid) >= 10 then
    raise exception 'A committee can have up to 10 other people' using errcode = '54000';
  end if;
  insert into public.chamber_members (chamber_id, user_id) values (cid, who.id);
  select coalesce(nullif(full_name, ''), email, 'A chair') into me from public.profiles where id = (select auth.uid());
  insert into private.chamber_mail (chamber_id, user_id, inviter) values (cid, who.id, coalesce(me, 'A chair'));
  return coalesce(nullif(who.full_name, ''), who.email);
end $$;

-- Anyone can leave. The owner and Admins remove others; only an Admin removes an Admin.
create or replace function public.remove_chamber_member(cid uuid, target uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare r text;
begin
  select role into r from public.chamber_members where chamber_id = cid and user_id = target;
  if r is null then raise exception 'They aren''t on this committee' using errcode = 'P0002'; end if;
  if target is distinct from (select auth.uid()) then
    if not private.can_manage_chamber(cid) then
      raise exception 'Only the person who shared this committee can remove people' using errcode = '42501';
    end if;
    if r = 'admin' and not (select private.is_admin()) then
      raise exception 'A Collex admin leaves on their own' using errcode = '42501';
    end if;
  end if;
  delete from public.chamber_members where chamber_id = cid and user_id = target;
end $$;

create or replace function public.chamber_code(cid uuid, action text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  c record;
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
  b bytea;
begin
  select id, owner_id, join_code into c from public.chambers where id = cid;
  if c.id is null or not (private.in_chamber(cid) or (select private.is_admin())) then
    raise exception 'That committee isn''t shared with you' using errcode = '42501';
  end if;
  if action = 'get' then return c.join_code; end if;
  if not private.can_manage_chamber(cid) then
    raise exception 'Only the person who shared this committee can change its code' using errcode = '42501';
  end if;
  if action = 'off' then
    update public.chambers set join_code = null where id = cid;
    return null;
  end if;
  if action <> 'new' then raise exception 'Unknown action' using errcode = '22023'; end if;
  loop
    b := extensions.gen_random_bytes(6);
    code := '';
    for i in 0..5 loop
      code := code || substr(alphabet, (get_byte(b, i) % 32) + 1, 1);
    end loop;
    exit when not exists (select 1 from public.chambers where join_code = code);
  end loop;
  update public.chambers set join_code = code where id = cid;
  return code;
end $$;

create or replace function public.join_chamber(code text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  clean text := upper(regexp_replace(coalesce(code, ''), '[^A-Za-z0-9]', '', 'g'));
  c record;
begin
  if me is null then raise exception 'Log in to join a committee' using errcode = '42501'; end if;
  if (select count(*) from private.chamber_join_tries where user_id = me and at > now() - interval '15 minutes') >= 10 then
    raise exception 'Too many tries. Wait a few minutes and try again.' using errcode = '54000';
  end if;
  insert into private.chamber_join_tries (user_id) values (me);
  delete from private.chamber_join_tries where at < now() - interval '1 day';
  select id, owner_id into c from public.chambers where join_code = clean;
  -- No match returns null rather than raising, so the try above is kept and counts towards the limit.
  if c.id is null then return null; end if;
  if c.owner_id = me or exists (select 1 from public.chamber_members where chamber_id = c.id and user_id = me) then
    return c.id;
  end if;
  if private.chamber_seats(c.id) >= 10 then
    raise exception 'That committee is full: it can have up to 10 other people' using errcode = '54000';
  end if;
  insert into public.chamber_members (chamber_id, user_id) values (c.id, me);
  return c.id;
end $$;

-- A Collex admin puts themselves on a committee as Admin (or turns their Chair place into Admin).
create function public.admin_join_chamber(cid uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare c record;
begin
  if not (select private.is_admin()) then raise exception 'Admins only' using errcode = '42501'; end if;
  select id, owner_id, name into c from public.chambers where id = cid;
  if c.id is null then raise exception 'That committee no longer exists' using errcode = 'P0002'; end if;
  if c.owner_id = (select auth.uid()) then return cid; end if;
  insert into public.chamber_members (chamber_id, user_id, role) values (cid, (select auth.uid()), 'admin')
  on conflict (chamber_id, user_id) do update set role = 'admin';
  perform private.log('joined as admin', 'chamber', cid::text, c.name, '{}');
  return cid;
end $$;

-- The committee as it stands, now with the caller's role and whether they can manage it.
create or replace function public.open_chamber(cid uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare c record; r text;
begin
  select id, owner_id, name, state, version into c from public.chambers where id = cid;
  if c.id is null or not private.in_chamber(cid) then
    raise exception 'That committee isn''t shared with you' using errcode = '42501';
  end if;
  r := case when c.owner_id = (select auth.uid()) then 'owner'
            else coalesce((select role from public.chamber_members where chamber_id = cid and user_id = (select auth.uid())), 'chair') end;
  return jsonb_build_object('state', c.state, 'version', c.version, 'name', c.name,
                            'owner', c.owner_id = (select auth.uid()), 'role', r, 'manage', private.can_manage_chamber(cid), 'now', now());
end $$;

drop function public.chamber_team(uuid);
create function public.chamber_team(cid uuid)
returns table (user_id uuid, name text, email text, is_owner boolean, role text)
language sql stable security definer set search_path = '' as $$
  select p.id, p.full_name, p.email, true, 'owner'
  from public.chambers c join public.profiles p on p.id = c.owner_id
  where c.id = cid and (private.in_chamber(cid) or (select private.is_admin()))
  union all
  select p.id, p.full_name, p.email, false, m.role
  from public.chamber_members m join public.profiles p on p.id = m.user_id
  where m.chamber_id = cid and (private.in_chamber(cid) or (select private.is_admin()))
$$;

drop function public.my_chambers();
create function public.my_chambers()
returns table (id uuid, name text, is_owner boolean, owner_name text, updated_at timestamptz,
               role text, topic text, rules text, step text, delegates integer, members integer)
language sql stable security definer set search_path = '' as $$
  select c.id, c.name, c.owner_id = (select auth.uid()), coalesce(nullif(p.full_name, ''), p.email, 'A chair'), c.updated_at,
         case when c.owner_id = (select auth.uid()) then 'owner'
              else coalesce((select m.role from public.chamber_members m where m.chamber_id = c.id and m.user_id = (select auth.uid())), 'chair') end,
         coalesce(c.state ->> 'topic', ''), coalesce(c.state ->> 'rules', 'evatt'), coalesce(c.state ->> 'step', ''),
         case when jsonb_typeof(c.state -> 'delegates') = 'array' then jsonb_array_length(c.state -> 'delegates') else 0 end,
         (select count(*)::integer from public.chamber_members m where m.chamber_id = c.id)
  from public.chambers c left join public.profiles p on p.id = c.owner_id
  where private.in_chamber(c.id)
  order by c.updated_at desc
$$;

-- The Admin page's list now says whether the admin looking is on each committee.
drop function public.admin_chambers();
create function public.admin_chambers()
returns table (id uuid, name text, owner_email text, owner_name text, members integer, version integer, created_at timestamptz, updated_at timestamptz,
               summary jsonb, my_role text, join_code text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (select private.is_admin()) then raise exception 'Admins only' using errcode = '42501'; end if;
  return query
  select c.id, c.name, coalesce(p.email, ''), coalesce(p.full_name, ''),
         (select count(*) from public.chamber_members m where m.chamber_id = c.id)::integer,
         c.version, c.created_at, c.updated_at,
         jsonb_build_object(
           'rules', c.state ->> 'rules', 'step', c.state ->> 'step', 'topic', c.state ->> 'topic',
           'delegates', case when jsonb_typeof(c.state -> 'delegates') = 'array' then jsonb_array_length(c.state -> 'delegates') else 0 end,
           'level', c.state #>> '{tr,level}', 'week', c.state #>> '{tr,week}',
           'log', case when jsonb_typeof(c.state -> 'log') = 'array' then
                    (select coalesce(jsonb_agg(x.e order by x.i desc), '[]'::jsonb)
                       from (select t.e, t.i from jsonb_array_elements(c.state -> 'log') with ordinality as t(e, i) order by t.i desc limit 8) x)
                  else '[]'::jsonb end),
         case when c.owner_id = (select auth.uid()) then 'owner'
              else (select m.role from public.chamber_members m where m.chamber_id = c.id and m.user_id = (select auth.uid())) end,
         c.join_code
  from public.chambers c left join public.profiles p on p.id = c.owner_id
  order by c.updated_at desc;
end $$;

revoke execute on function public.admin_join_chamber(uuid) from public, anon;
revoke execute on function public.chamber_team(uuid) from public, anon;
revoke execute on function public.my_chambers() from public, anon;
revoke execute on function public.admin_chambers() from public, anon;
grant execute on function public.admin_join_chamber(uuid) to authenticated;
grant execute on function public.chamber_team(uuid) to authenticated;
grant execute on function public.my_chambers() to authenticated;
grant execute on function public.admin_chambers() to authenticated;
