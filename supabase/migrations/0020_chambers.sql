-- Shared committees for Chambers. A chair can run a committee alone in their browser, or share it: the committee then
-- lives here, and the people they add (by the email on their Collex account) can open the console and the display from
-- their own devices. Everyone on a committee has the same powers over it; only its owner adds people or deletes it.
-- The whole committee is one small document with a version number. Saving says which version it was based on, and if
-- someone else saved first the caller is handed the newer one to apply their change on top of.
-- The tables have no insert, update or delete grants: every write goes through the functions below.

create table public.chambers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  state jsonb not null check (jsonb_typeof(state) = 'object' and state ->> 'v' = '1' and pg_column_size(state) <= 262144),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index chambers_owner_idx on public.chambers (owner_id);

create table public.chamber_members (
  chamber_id uuid not null references public.chambers (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (chamber_id, user_id)
);
create index chamber_members_user_idx on public.chamber_members (user_id);

alter table public.chambers enable row level security;
alter table public.chamber_members enable row level security;
revoke all on public.chambers from anon, authenticated;
revoke all on public.chamber_members from anon, authenticated;
grant select on public.chambers to authenticated;
grant select on public.chamber_members to authenticated;

-- True when the caller owns the committee or was added to it.
create function private.in_chamber(cid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.chambers c where c.id = cid and c.owner_id = (select auth.uid()))
      or exists (select 1 from public.chamber_members m where m.chamber_id = cid and m.user_id = (select auth.uid()))
$$;
revoke execute on function private.in_chamber(uuid) from public, anon;
grant execute on function private.in_chamber(uuid) to authenticated;

-- Reading is what lets a device follow a committee live (Realtime applies the same rule).
create policy "People on a committee read it" on public.chambers
  for select to authenticated using (private.in_chamber(id));
create policy "People on a committee read its members" on public.chamber_members
  for select to authenticated using (private.in_chamber(chamber_id));

-- Start a shared committee from the one the chair has been running.
create function public.create_chamber(initial jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare new_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'Log in to share a committee' using errcode = '42501'; end if;
  if (select count(*) from public.chambers where owner_id = (select auth.uid())) >= 20 then
    raise exception 'You can share up to 20 committees. Delete one you''ve finished with.' using errcode = '54000';
  end if;
  insert into public.chambers (owner_id, name, state)
  values ((select auth.uid()), left(trim(coalesce(initial ->> 'name', '')), 80), initial)
  returning id into new_id;
  return new_id;
end $$;

-- The committee as it stands, and the database's clock so devices agree on what time it is.
create function public.open_chamber(cid uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare c record;
begin
  select id, owner_id, name, state, version into c from public.chambers where id = cid;
  if c.id is null or not private.in_chamber(cid) then
    raise exception 'That committee isn''t shared with you' using errcode = '42501';
  end if;
  return jsonb_build_object('state', c.state, 'version', c.version, 'name', c.name,
                            'owner', c.owner_id = (select auth.uid()), 'now', now());
end $$;

-- Save a change. If the committee has moved on since the caller last saw it, nothing is written and the newer copy comes back.
create function public.save_chamber(cid uuid, new_state jsonb, expected integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare c record;
begin
  select id, state, version, name into c from public.chambers where id = cid for update;
  if c.id is null or not private.in_chamber(cid) then
    raise exception 'That committee isn''t shared with you' using errcode = '42501';
  end if;
  if c.version <> expected then
    return jsonb_build_object('ok', false, 'version', c.version, 'state', c.state, 'now', now());
  end if;
  update public.chambers
  set state = new_state,
      name = case when char_length(trim(coalesce(new_state ->> 'name', ''))) >= 2 then left(trim(new_state ->> 'name'), 80) else name end,
      version = c.version + 1, updated_at = now()
  where id = cid;
  return jsonb_build_object('ok', true, 'version', c.version + 1, 'now', now());
end $$;

create function public.delete_chamber(cid uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.chambers where id = cid and (owner_id = (select auth.uid()) or (select private.is_admin()));
  if not found then raise exception 'Only the person who shared this committee can delete it' using errcode = '42501'; end if;
end $$;

-- The owner adds someone by the email on their account. Strangers are never emailed.
create function public.add_chamber_member(cid uuid, invitee_email text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  c record;
  who record;
begin
  select id, owner_id into c from public.chambers where id = cid;
  if c.id is null or c.owner_id is distinct from (select auth.uid()) then
    raise exception 'Only the person who shared this committee can add people' using errcode = '42501';
  end if;
  select id, email, full_name into who from public.profiles where lower(email) = lower(trim(invitee_email));
  if who.id is null then
    raise exception 'Nobody has a Collex account with that email yet. Ask them to sign up first.' using errcode = 'P0002';
  end if;
  if who.id = c.owner_id then raise exception 'You already run this committee' using errcode = '23505'; end if;
  if exists (select 1 from public.chamber_members where chamber_id = cid and user_id = who.id) then
    raise exception 'They''re already on this committee' using errcode = '23505';
  end if;
  if (select count(*) from public.chamber_members where chamber_id = cid) >= 10 then
    raise exception 'A committee can have up to 10 other people' using errcode = '54000';
  end if;
  insert into public.chamber_members (chamber_id, user_id) values (cid, who.id);
  return coalesce(nullif(who.full_name, ''), who.email);
end $$;

-- The owner removes anyone; anyone else can leave for themselves.
create function public.remove_chamber_member(cid uuid, target uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare owner uuid;
begin
  select owner_id into owner from public.chambers where id = cid;
  if target is distinct from (select auth.uid()) and owner is distinct from (select auth.uid()) then
    raise exception 'Only the person who shared this committee can remove people' using errcode = '42501';
  end if;
  delete from public.chamber_members where chamber_id = cid and user_id = target;
  if not found then raise exception 'They aren''t on this committee' using errcode = 'P0002'; end if;
end $$;

-- Who is on a committee, owner first, for the people on it.
create function public.chamber_team(cid uuid)
returns table (user_id uuid, name text, email text, is_owner boolean)
language sql stable security definer set search_path = '' as $$
  select p.id, p.full_name, p.email, true
  from public.chambers c join public.profiles p on p.id = c.owner_id
  where c.id = cid and private.in_chamber(cid)
  union all
  select p.id, p.full_name, p.email, false
  from public.chamber_members m join public.profiles p on p.id = m.user_id
  where m.chamber_id = cid and private.in_chamber(cid)
$$;

-- The committees the caller owns or was added to, newest first.
create function public.my_chambers()
returns table (id uuid, name text, is_owner boolean, owner_name text, updated_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select c.id, c.name, c.owner_id = (select auth.uid()), coalesce(nullif(p.full_name, ''), p.email, 'A chair'), c.updated_at
  from public.chambers c left join public.profiles p on p.id = c.owner_id
  where private.in_chamber(c.id)
  order by c.updated_at desc
$$;

revoke execute on function public.create_chamber(jsonb) from public, anon;
revoke execute on function public.open_chamber(uuid) from public, anon;
revoke execute on function public.save_chamber(uuid, jsonb, integer) from public, anon;
revoke execute on function public.delete_chamber(uuid) from public, anon;
revoke execute on function public.add_chamber_member(uuid, text) from public, anon;
revoke execute on function public.remove_chamber_member(uuid, uuid) from public, anon;
revoke execute on function public.chamber_team(uuid) from public, anon;
revoke execute on function public.my_chambers() from public, anon;
grant execute on function public.create_chamber(jsonb) to authenticated;
grant execute on function public.open_chamber(uuid) to authenticated;
grant execute on function public.save_chamber(uuid, jsonb, integer) to authenticated;
grant execute on function public.delete_chamber(uuid) to authenticated;
grant execute on function public.add_chamber_member(uuid, text) to authenticated;
grant execute on function public.remove_chamber_member(uuid, uuid) to authenticated;
grant execute on function public.chamber_team(uuid) to authenticated;
grant execute on function public.my_chambers() to authenticated;

-- Devices follow a committee live through Realtime, which only sends rows the reader may select.
alter publication supabase_realtime add table public.chambers;
