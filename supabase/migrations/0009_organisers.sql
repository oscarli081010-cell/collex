-- Co-organisers and interest by week.
-- The person who listed a conference (the owner) can invite people who already have an account to help edit it.
-- Once they accept, they edit with the same limits as the owner. Only the owner invites; nobody but admins deletes.

create table public.organisers (
  conference_id uuid not null references public.conferences (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  invited_by uuid references auth.users (id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (conference_id, user_id)
);
create index organisers_user on public.organisers (user_id);
alter table public.organisers enable row level security;

-- True when the caller owns the listing or has accepted an invite to it.
create function private.can_edit(conf uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.conferences c where c.id = conf and c.submitted_by = (select auth.uid()))
      or exists (select 1 from public.organisers o
                 where o.conference_id = conf and o.user_id = (select auth.uid()) and o.accepted_at is not null)
$$;
revoke execute on function private.can_edit(uuid) from public, anon;
grant execute on function private.can_edit(uuid) to authenticated;

-- People see their own invites, the team of a listing they edit, and admins see all.
-- Every change goes through the functions below, so there are no insert, update or delete grants.
create policy "Read own invites and your listings' team" on public.organisers
  for select to authenticated
  using (user_id = (select auth.uid()) or private.can_edit(conference_id) or (select private.is_admin()));
revoke all on public.organisers from anon, authenticated;
grant select on public.organisers to authenticated;

-- Editing: the owner or an accepted co-organiser, while the listing is in review or live.
drop policy "Submitters edit their own" on public.conferences;
create policy "Organisers edit their listings" on public.conferences
  for update to authenticated
  using (private.can_edit(id) and status in ('pending', 'published'))
  with check (private.can_edit(id) and status in ('pending', 'published'));
create policy "Organisers read their listings" on public.conferences
  for select to authenticated using (private.can_edit(id));

-- Cover photos: the file must sit in the folder of whoever set it (owner or co-organiser), which the
-- storage policy already limits to their own uploads. The shape check stays on the column.
alter table public.conferences drop constraint conferences_check1;
alter table public.conferences add constraint conferences_cover_path_shape
  check (cover_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$');

create or replace function private.guard_conference_update() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() and (
    new.status is distinct from old.status or new.review_note is distinct from old.review_note
    or new.verified is distinct from old.verified or new.submitted_by is distinct from old.submitted_by
  ) then
    raise exception 'Only admins can change a listing''s review status.' using errcode = '42501';
  end if;
  if new.cover_path is distinct from old.cover_path and new.cover_path is not null and not private.is_admin()
     and split_part(new.cover_path, '/', 1) is distinct from (select auth.uid())::text then
    raise exception 'Upload the photo again before saving.' using errcode = '42501';
  end if;
  return new;
end $$;

create function private.guard_conference_cover() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.cover_path is not null and not private.is_admin()
     and split_part(new.cover_path, '/', 1) is distinct from (select auth.uid())::text then
    raise exception 'Upload the photo again before saving.' using errcode = '42501';
  end if;
  return new;
end $$;
revoke execute on function private.guard_conference_cover() from public, anon, authenticated;
create trigger conferences_cover before insert on public.conferences
  for each row execute function private.guard_conference_cover();

-- The owner invites someone by the email on their account. Strangers are never emailed.
create function public.invite_organiser(conf uuid, invitee_email text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  c record;
  who record;
begin
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
  insert into public.organisers (conference_id, user_id, invited_by) values (conf, who.id, (select auth.uid()));
  perform private.log('invited organiser', 'conference', conf::text, c.name, jsonb_build_object('invitee', who.email));
  return coalesce(nullif(who.full_name, ''), who.email);
end $$;

create function public.accept_organiser(conf uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare cname text;
begin
  update public.organisers set accepted_at = now()
  where conference_id = conf and user_id = (select auth.uid()) and accepted_at is null;
  if not found then raise exception 'That invite is no longer open' using errcode = 'P0002'; end if;
  select name into cname from public.conferences where id = conf;
  perform private.log('accepted organiser invite', 'conference', conf::text, cname, '{}');
end $$;

-- The owner or an admin removes anyone; anyone can leave (or decline) for themselves.
create function public.remove_organiser(conf uuid, target uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  cname text;
  owner uuid;
  who text;
begin
  select name, submitted_by into cname, owner from public.conferences where id = conf;
  if target is distinct from (select auth.uid()) and owner is distinct from (select auth.uid()) and not private.is_admin() then
    raise exception 'Only the person who listed this conference can remove organisers' using errcode = '42501';
  end if;
  select email into who from public.profiles where id = target;
  delete from public.organisers where conference_id = conf and user_id = target;
  if not found then raise exception 'They aren''t on this listing' using errcode = 'P0002'; end if;
  perform private.log(case when target = (select auth.uid()) then 'left organisers' else 'removed organiser' end,
                      'conference', conf::text, cname, jsonb_build_object('organiser', who));
end $$;

-- The team of a listing, for the people who edit it (and admins). The owner comes first.
create function public.organisers_of(conf uuid)
returns table (user_id uuid, name text, email text, is_owner boolean, accepted boolean)
language sql stable security definer set search_path = '' as $$
  select p.id, p.full_name, p.email, true, true
  from public.conferences c join public.profiles p on p.id = c.submitted_by
  where c.id = conf and (private.can_edit(conf) or private.is_admin())
  union all
  select p.id, p.full_name, p.email, false, o.accepted_at is not null
  from public.organisers o join public.profiles p on p.id = o.user_id
  where o.conference_id = conf and (private.can_edit(conf) or private.is_admin())
$$;

-- Invites waiting for the caller, with the listing's name and who sent them.
create function public.my_invites()
returns table (conference_id uuid, conference text, invited_by text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select o.conference_id, c.name, coalesce(nullif(p.full_name, ''), p.email, 'The organiser'), o.created_at
  from public.organisers o
  join public.conferences c on c.id = o.conference_id
  left join public.profiles p on p.id = o.invited_by
  where o.user_id = (select auth.uid()) and o.accepted_at is null
  order by o.created_at desc
$$;

-- Interest counts now cover co-organised listings too. Never names who sent them.
create or replace function public.interest_counts() returns table (conference_id uuid, interested bigint)
language sql stable security definer set search_path = '' as $$
  select c.id, count(i.user_id)
  from public.conferences c left join public.interests i on i.conference_id = c.id
  where private.can_edit(c.id) or private.is_admin()
  group by c.id
$$;

-- Interest per week (Sydney time), for listings the caller edits. Counts only, never who.
create function public.interest_weekly() returns table (conference_id uuid, week date, interested bigint)
language sql stable security definer set search_path = '' as $$
  select i.conference_id, date_trunc('week', i.created_at at time zone 'Australia/Sydney')::date, count(*)
  from public.interests i
  where private.can_edit(i.conference_id) or private.is_admin()
  group by 1, 2
  order by 1, 2
$$;

revoke execute on function public.invite_organiser(uuid, text) from public, anon;
revoke execute on function public.accept_organiser(uuid) from public, anon;
revoke execute on function public.remove_organiser(uuid, uuid) from public, anon;
revoke execute on function public.organisers_of(uuid) from public, anon;
revoke execute on function public.my_invites() from public, anon;
revoke execute on function public.interest_weekly() from public, anon;
grant execute on function public.invite_organiser(uuid, text) to authenticated;
grant execute on function public.accept_organiser(uuid) to authenticated;
grant execute on function public.remove_organiser(uuid, uuid) to authenticated;
grant execute on function public.organisers_of(uuid) to authenticated;
grant execute on function public.my_invites() to authenticated;
grant execute on function public.interest_weekly() to authenticated;
