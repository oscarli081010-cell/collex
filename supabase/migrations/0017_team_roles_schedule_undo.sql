-- Co-organiser roles (can edit / view only), registration buttons that open at a set time, and undoing an edit.

-- 1. Roles. Everyone already on a team keeps editing. A viewer sees the listing, its activity and its team, but changes nothing.
alter table public.organisers add column role text not null default 'editor' check (role in ('editor', 'viewer'));

-- can_view: the owner or any accepted organiser. can_edit now means the owner or an accepted editor.
create function private.can_view(conf uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.conferences c where c.id = conf and c.submitted_by = (select auth.uid()))
      or exists (select 1 from public.organisers o
                 where o.conference_id = conf and o.user_id = (select auth.uid()) and o.accepted_at is not null)
$$;
revoke execute on function private.can_view(uuid) from public, anon;
grant execute on function private.can_view(uuid) to authenticated;

create or replace function private.can_edit(conf uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.conferences c where c.id = conf and c.submitted_by = (select auth.uid()))
      or exists (select 1 from public.organisers o
                 where o.conference_id = conf and o.user_id = (select auth.uid()) and o.accepted_at is not null and o.role = 'editor')
$$;

-- Reading moves to can_view. The update policy keeps can_edit, so a viewer's edit is refused by the database.
alter policy "Read own invites and your listings' team" on public.organisers
  using (user_id = (select auth.uid()) or private.can_view(conference_id) or (select private.is_admin()));
alter policy "Organisers read their listings" on public.conferences using (private.can_view(id));

create or replace function public.interest_counts() returns table (conference_id uuid, interested bigint)
language sql stable security definer set search_path = '' as $$
  select c.id, count(i.user_id)
  from public.conferences c left join public.interests i on i.conference_id = c.id
  where private.can_view(c.id) or private.is_admin()
  group by c.id
$$;

create or replace function public.interest_weekly() returns table (conference_id uuid, week date, interested bigint)
language sql stable security definer set search_path = '' as $$
  select i.conference_id, date_trunc('week', i.created_at at time zone 'Australia/Sydney')::date, count(*)
  from public.interests i
  where private.can_view(i.conference_id) or private.is_admin()
  group by 1, 2
  order by 1, 2
$$;

create or replace function public.listing_followers(conf uuid) returns bigint
language sql stable security definer set search_path = '' as $$
  select case when private.can_view(conf) or private.is_admin()
              then (select count(*) from public.follows where conference_id = conf) end
$$;

-- The team now says who can edit. The role of the owner is always editor.
drop function public.organisers_of(uuid);
create function public.organisers_of(conf uuid)
returns table (user_id uuid, name text, email text, is_owner boolean, accepted boolean, role text)
language sql stable security definer set search_path = '' as $$
  select p.id, p.full_name, p.email, true, true, 'editor'::text
  from public.conferences c join public.profiles p on p.id = c.submitted_by
  where c.id = conf and (private.can_view(conf) or private.is_admin())
  union all
  select p.id, p.full_name, p.email, false, o.accepted_at is not null, o.role
  from public.organisers o join public.profiles p on p.id = o.user_id
  where o.conference_id = conf and (private.can_view(conf) or private.is_admin())
$$;

drop function public.my_invites();
create function public.my_invites()
returns table (conference_id uuid, conference text, invited_by text, created_at timestamptz, role text)
language sql stable security definer set search_path = '' as $$
  select o.conference_id, c.name, coalesce(nullif(p.full_name, ''), p.email, 'The organiser'), o.created_at, o.role
  from public.organisers o
  join public.conferences c on c.id = o.conference_id
  left join public.profiles p on p.id = o.invited_by
  where o.user_id = (select auth.uid()) and o.accepted_at is null
  order by o.created_at desc
$$;

-- Inviting takes the role to give. Dropping the old signature keeps a single version of the function.
drop function public.invite_organiser(uuid, text);
create function public.invite_organiser(conf uuid, invitee_email text, as_role text default 'editor') returns text
language plpgsql security definer set search_path = '' as $$
declare
  c record;
  who record;
begin
  if as_role not in ('editor', 'viewer') then raise exception 'Pick can edit or view only' using errcode = '22023'; end if;
  select id, name, submitted_by, status into c from public.conferences where id = conf;
  if c.id is null or c.submitted_by is distinct from (select auth.uid()) then
    raise exception 'Only the person who listed this conference can invite organisers' using errcode = '42501';
  end if;
  if c.status not in ('pending', 'published') then
    raise exception 'This listing can''t be edited right now' using errcode = '42501';
  end if;
  select id, email, full_name into who from public.profiles where lower(email) = lower(trim(invitee_email));
  if who.id is null then
    raise exception 'Nobody has a Collex account with that email yet. Ask them to sign up first.' using errcode = 'P0002';
  end if;
  if who.id = c.submitted_by then raise exception 'You already run this listing' using errcode = '23505'; end if;
  if exists (select 1 from public.organisers where conference_id = conf and user_id = who.id) then
    raise exception 'They''ve already been invited' using errcode = '23505';
  end if;
  if (select count(*) from public.organisers where conference_id = conf) >= 10 then
    raise exception 'A listing can have up to 10 co-organisers' using errcode = '54000';
  end if;
  insert into public.organisers (conference_id, user_id, invited_by, role) values (conf, who.id, (select auth.uid()), as_role);
  perform private.log('invited organiser', 'conference', conf::text, c.name, jsonb_build_object('invitee', who.email, 'role', as_role));
  return coalesce(nullif(who.full_name, ''), who.email);
end $$;

-- The owner (or an admin) changes what a co-organiser can do.
create function public.set_organiser_role(conf uuid, target uuid, new_role text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  cname text;
  owner uuid;
  who text;
begin
  if new_role not in ('editor', 'viewer') then raise exception 'Pick can edit or view only' using errcode = '22023'; end if;
  select name, submitted_by into cname, owner from public.conferences where id = conf;
  if owner is distinct from (select auth.uid()) and not private.is_admin() then
    raise exception 'Only the person who listed this conference can change what organisers can do' using errcode = '42501';
  end if;
  select email into who from public.profiles where id = target;
  update public.organisers set role = new_role where conference_id = conf and user_id = target and role is distinct from new_role;
  if not found then return; end if;
  perform private.log('changed organiser role', 'conference', conf::text, cname, jsonb_build_object('organiser', who, 'role', new_role));
end $$;

revoke execute on function public.organisers_of(uuid) from public, anon;
revoke execute on function public.my_invites() from public, anon;
revoke execute on function public.invite_organiser(uuid, text, text) from public, anon;
revoke execute on function public.set_organiser_role(uuid, uuid, text) from public, anon;
grant execute on function public.organisers_of(uuid) to authenticated;
grant execute on function public.my_invites() to authenticated;
grant execute on function public.invite_organiser(uuid, text, text) to authenticated;
grant execute on function public.set_organiser_role(uuid, uuid, text) to authenticated;

-- 2. Buttons that open at a set time: when registration, and chair applications, open. The link is still in the page's
-- data (the page itself keeps the button shut until then), so this is a schedule, not a lock.
alter table public.conferences add column delegation_opens_at timestamptz, add column chair_opens_at timestamptz;
grant insert (delegation_opens_at, chair_opens_at), update (delegation_opens_at, chair_opens_at) on public.conferences to authenticated;

-- 3. Undo. An edit now keeps the old value of each field it changed (only the fields an organiser may edit). The
-- audit log is still read only through listing_history, which says whether an entry can be undone but never shows values.
create function private.undoable_fields() returns text[]
language sql immutable set search_path = '' as $$
  select array['name', 'short_name', 'host', 'start_date', 'end_date', 'venue', 'level', 'fee', 'delegates', 'overview', 'contact',
               'delegation_url', 'chair_url', 'interest_url', 'key_dates', 'committees', 'guides', 'secretariat', 'roles',
               'delegation_opens_at', 'chair_opens_at']
$$;

create or replace function private.audit_conferences() returns trigger
language plpgsql security definer set search_path = '' as $$
declare changed jsonb; before jsonb;
begin
  if tg_op = 'INSERT' then
    perform private.log('submitted', 'conference', new.id::text, new.name, jsonb_build_object('status', new.status));
  elsif tg_op = 'DELETE' then
    perform private.log('deleted', 'conference', old.id::text, old.name, '{}');
    return old;
  elsif new.status is distinct from old.status then
    perform private.log(
      case new.status when 'published' then 'approved' when 'rejected' then 'rejected'
                      when 'unpublished' then 'unpublished' else 'reopened' end,
      'conference', new.id::text, new.name,
      jsonb_build_object('from', old.status, 'to', new.status, 'note', new.review_note));
  else
    select coalesce(jsonb_agg(n.key order by n.key), '[]'::jsonb),
           coalesce(jsonb_object_agg(n.key, to_jsonb(old) -> n.key) filter (where n.key = any (private.undoable_fields())), '{}'::jsonb)
      into changed, before
    from jsonb_each(to_jsonb(new)) n
    where n.value is distinct from (to_jsonb(old) -> n.key) and n.key not in ('updated_at', 'published_at');
    perform private.log('edited', 'conference', new.id::text, new.name, jsonb_build_object('fields', changed, 'before', before));
  end if;
  return new;
end $$;

-- Can the caller undo this entry? It must be an edit that kept old values, on a listing they can edit that is in review or
-- live, and no later edit may have touched the same fields (undoing would overwrite that newer work).
create function private.can_undo(entry bigint) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.audit_log a
    join public.conferences c on c.id::text = a.target_id
    where a.id = entry and a.target_type = 'conference' and a.action = 'edited'
      and coalesce(a.detail -> 'before', '{}'::jsonb) <> '{}'::jsonb
      and c.status in ('pending', 'published')
      and private.can_edit(c.id)
      and not exists (
        select 1 from public.audit_log n
        where n.target_type = 'conference' and n.target_id = a.target_id and n.action = 'edited' and n.id > a.id
          and (n.detail -> 'fields') ?| (select array_agg(k) from jsonb_object_keys(a.detail -> 'before') k))
  )
$$;
revoke execute on function private.can_undo(bigint) from public, anon;
grant execute on function private.can_undo(bigint) to authenticated;

drop function public.listing_history(uuid);
create function public.listing_history(conf uuid)
returns table (id bigint, at timestamptz, who text, action text, fields jsonb, note text, subject text, role text, can_undo boolean)
language sql stable security definer set search_path = '' as $$
  select a.id, a.at,
         case when a.actor is null then 'Collex' else coalesce(nullif(p.full_name, ''), a.actor_email) end,
         a.action,
         coalesce(a.detail -> 'fields', '[]'::jsonb),
         nullif(a.detail ->> 'note', ''),
         coalesce(a.detail ->> 'invitee', a.detail ->> 'organiser'),
         a.detail ->> 'role',
         private.can_undo(a.id)
  from public.audit_log a
  left join public.profiles p on p.id = a.actor
  where a.target_type = 'conference' and a.target_id = conf::text
    and (private.can_view(conf) or private.is_admin())
  order by a.at desc, a.id desc
  limit 100
$$;

-- Puts back what an edit changed. Runs with owner rights, so it checks everything itself and touches only the fields
-- organisers can edit: never status, notes, the badge, the slug, or the cover (a cover belongs to whoever uploaded it).
create function public.undo_edit(entry bigint) returns void
language plpgsql security definer set search_path = '' as $$
declare
  a record;
  b jsonb;
  r public.conferences;
begin
  if not private.can_undo(entry) then
    raise exception 'That change can''t be undone any more' using errcode = '42501';
  end if;
  select target_id, detail into a from public.audit_log where id = entry;
  b := a.detail -> 'before';
  r := jsonb_populate_record(null::public.conferences, b);
  update public.conferences c set
    name = case when b ? 'name' then r.name else c.name end,
    short_name = case when b ? 'short_name' then r.short_name else c.short_name end,
    host = case when b ? 'host' then r.host else c.host end,
    start_date = case when b ? 'start_date' then r.start_date else c.start_date end,
    end_date = case when b ? 'end_date' then r.end_date else c.end_date end,
    venue = case when b ? 'venue' then r.venue else c.venue end,
    level = case when b ? 'level' then r.level else c.level end,
    fee = case when b ? 'fee' then r.fee else c.fee end,
    delegates = case when b ? 'delegates' then r.delegates else c.delegates end,
    overview = case when b ? 'overview' then r.overview else c.overview end,
    contact = case when b ? 'contact' then r.contact else c.contact end,
    delegation_url = case when b ? 'delegation_url' then r.delegation_url else c.delegation_url end,
    chair_url = case when b ? 'chair_url' then r.chair_url else c.chair_url end,
    interest_url = case when b ? 'interest_url' then r.interest_url else c.interest_url end,
    key_dates = case when b ? 'key_dates' then r.key_dates else c.key_dates end,
    committees = case when b ? 'committees' then r.committees else c.committees end,
    guides = case when b ? 'guides' then r.guides else c.guides end,
    secretariat = case when b ? 'secretariat' then r.secretariat else c.secretariat end,
    roles = case when b ? 'roles' then r.roles else c.roles end,
    delegation_opens_at = case when b ? 'delegation_opens_at' then r.delegation_opens_at else c.delegation_opens_at end,
    chair_opens_at = case when b ? 'chair_opens_at' then r.chair_opens_at else c.chair_opens_at end
  where c.id = a.target_id::uuid;
end $$;

revoke execute on function public.listing_history(uuid) from public, anon;
revoke execute on function public.undo_edit(bigint) from public, anon;
grant execute on function public.listing_history(uuid) to authenticated;
grant execute on function public.undo_edit(bigint) to authenticated;
