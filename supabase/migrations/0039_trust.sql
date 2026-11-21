-- Privacy and safety. Most users are under 18, so this closes the places where one person could learn about, spam or
-- outlast another: chairs' marks leaking to the conference wall, invites used to find out who has an account, an
-- organiser undoing an admin's fix, admin rights for an unconfirmed email, links swapped after a listing was approved,
-- one person filling the reports, votes or storage, and personal data kept for longer than it is needed.
-- Safe to run twice.

-- 1. The conference wall shows each committee's progress, never the chairs' marks and notes on delegates.
create or replace function public.conference_wall(conf uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (private.can_view(conf) or (select private.is_admin())) then raise exception 'Only the people who run this conference can see its committees' using errcode = '42501'; end if;
  return jsonb_build_object('now', now(), 'rooms', (select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id, 'name', c.name, 'committee', c.committee, 'updated_at', c.updated_at, 'devices', c.devices,
    'state', c.state - 'hist' - 'log' - 'background' - 'scores',
    'seats', (select count(*) from public.chamber_seats s where s.chamber_id = c.id),
    'asks', (select count(*) from public.chamber_asks a where a.chamber_id = c.id and a.status = 'open'),
    'chairs', (select coalesce(jsonb_agg(coalesce(nullif(p.full_name, ''), p.email)), '[]'::jsonb) from
      (select x.owner_id as uid from public.chambers x where x.id = c.id union select m.user_id from public.chamber_members m where m.chamber_id = c.id and m.role = 'chair') u
      join public.profiles p on p.id = u.uid)
  ) order by c.committee, c.name), '[]'::jsonb) from public.chambers c where c.conference_id = conf));
end $$;
revoke execute on function public.conference_wall(uuid) from public, anon;
grant execute on function public.conference_wall(uuid) to authenticated;

-- 2. Invites. Every invite, to an account or not, is written down so one person can send at most 20 a day, and at most
-- 3 a day to the same email. The answer is the same either way: the email as typed, cleaned up, and never a name, so
-- an invite can't be used to find out whether someone has a Collex account or what they are called.
create table if not exists private.invite_log (
  id bigint generated always as identity primary key,
  inviter uuid not null,
  invitee_email text not null,
  kind text not null,
  at timestamptz not null default now()
);
create index if not exists invite_log_inviter_idx on private.invite_log (inviter, at);

-- Checks the limits and writes the attempt down. Raises when the person has invited too many today.
create or replace function private.note_invite(addr text, what text) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := (select auth.uid());
begin
  if me is null then raise exception 'Log in first' using errcode = '42501'; end if;
  if (select count(*) from private.invite_log l where l.inviter = me and l.at > now() - interval '1 day') >= 20 then
    raise exception 'You can invite 20 people a day. Try again tomorrow.' using errcode = '54000';
  end if;
  if (select count(*) from private.invite_log l where l.inviter = me and l.invitee_email = addr and l.at > now() - interval '1 day') >= 3 then
    raise exception 'You''ve invited that email three times today. Try again tomorrow.' using errcode = '54000';
  end if;
  insert into private.invite_log (inviter, invitee_email, kind) values (me, addr, what);
end $$;
revoke execute on function private.note_invite(text, text) from public, anon, authenticated;

create or replace function public.add_chamber_member(cid uuid, invitee_email text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  c record;
  who record;
  me text;
  addr text := lower(trim(coalesce(invitee_email, '')));
begin
  select id, owner_id into c from public.chambers where id = cid;
  if c.id is null or not private.can_manage_chamber(cid) then
    raise exception 'Only the person who shared this committee can add people' using errcode = '42501';
  end if;
  if length(addr) > 254 or addr !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'That email doesn''t look right' using errcode = '22023';
  end if;
  -- Checked before looking the email up, so a full committee answers the same for everyone.
  if private.chamber_seats(cid) >= 10 then
    raise exception 'A committee can have up to 10 other people' using errcode = '54000';
  end if;
  perform private.note_invite(addr, 'chamber');
  select id, email, full_name into who from public.profiles where lower(email) = addr;
  if who.id is null then return addr; end if; -- no account: nothing happens, and the answer is the same
  if who.id = c.owner_id or exists (select 1 from public.chamber_members where chamber_id = cid and user_id = who.id) then
    return addr; -- already on it (they're on the team list already)
  end if;
  insert into public.chamber_members (chamber_id, user_id) values (cid, who.id);
  select coalesce(nullif(full_name, ''), email, 'A chair') into me from public.profiles where id = (select auth.uid());
  insert into private.chamber_mail (chamber_id, user_id, inviter) values (cid, who.id, coalesce(me, 'A chair'));
  return addr;
end $$;
revoke execute on function public.add_chamber_member(uuid, text) from public, anon;
grant execute on function public.add_chamber_member(uuid, text) to authenticated;

create or replace function public.invite_organiser(conf uuid, invitee_email text, as_role text default 'editor') returns text
language plpgsql security definer set search_path = '' as $$
declare
  c record;
  who record;
  addr text := lower(trim(coalesce(invitee_email, '')));
begin
  if as_role not in ('editor', 'viewer') then raise exception 'Pick can edit or view only' using errcode = '22023'; end if;
  select id, name, submitted_by, status into c from public.conferences where id = conf;
  if c.id is null or c.submitted_by is distinct from (select auth.uid()) then
    raise exception 'Only the person who listed this conference can invite organisers' using errcode = '42501';
  end if;
  if c.status <> 'published' then
    raise exception 'You can invite organisers once the listing has been approved' using errcode = '42501';
  end if;
  if length(addr) > 254 or addr !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'That email doesn''t look right' using errcode = '22023';
  end if;
  if (select count(*) from public.organisers where conference_id = conf) >= 10 then
    raise exception 'A listing can have up to 10 co-organisers' using errcode = '54000';
  end if;
  perform private.note_invite(addr, 'organiser');
  select id, email into who from public.profiles where lower(email) = addr;
  if who.id is null then return addr; end if; -- no account: nothing happens, and the answer is the same
  if who.id = c.submitted_by then raise exception 'You already run this listing' using errcode = '23505'; end if;
  if exists (select 1 from public.organisers where conference_id = conf and user_id = who.id) then return addr; end if;
  insert into public.organisers (conference_id, user_id, invited_by, role) values (conf, who.id, (select auth.uid()), as_role);
  perform private.log('invited organiser', 'conference', conf::text, c.name, jsonb_build_object('invitee', addr, 'role', as_role));
  return addr;
end $$;
revoke execute on function public.invite_organiser(uuid, text, text) from public, anon;
grant execute on function public.invite_organiser(uuid, text, text) to authenticated;

-- Someone invited but not yet accepted shows by the email they were invited with, not their name.
create or replace function public.organisers_of(conf uuid)
returns table(user_id uuid, name text, email text, is_owner boolean, accepted boolean, role text)
language sql stable security definer set search_path = '' as $$
  select p.id, p.full_name, p.email, true, true, 'editor'::text
  from public.conferences c join public.profiles p on p.id = c.submitted_by
  where c.id = conf and (private.can_view(conf) or private.is_admin())
  union all
  select p.id, case when o.accepted_at is not null then p.full_name else '' end, p.email, false, o.accepted_at is not null, o.role
  from public.organisers o join public.profiles p on p.id = o.user_id
  where o.conference_id = conf and (private.can_view(conf) or private.is_admin())
$$;
revoke execute on function public.organisers_of(uuid) from public, anon;
grant execute on function public.organisers_of(uuid) to authenticated;

-- 3. An organiser can't undo a change an admin made. From now on each edit says whether an admin made it; older
-- edits fall back to whether the person who made it is an admin now.
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
    perform private.log('edited', 'conference', new.id::text, new.name,
      jsonb_build_object('fields', changed, 'before', before, 'by_admin', private.is_admin()));
  end if;
  return new;
end $$;

create or replace function private.can_undo(entry bigint) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.audit_log a
    join public.conferences c on c.id::text = a.target_id
    where a.id = entry and a.target_type = 'conference' and a.action = 'edited'
      and coalesce(a.detail -> 'before', '{}'::jsonb) <> '{}'::jsonb
      and c.status in ('pending', 'published')
      and private.can_edit(c.id)
      and (private.is_admin() or not coalesce(
            case when jsonb_typeof(a.detail -> 'by_admin') = 'boolean' then (a.detail ->> 'by_admin')::boolean end,
            (select p.is_admin from public.profiles p where p.id = a.actor),
            false))
      and exists (
        select 1 from jsonb_each(a.detail -> 'before') b
        where b.value is distinct from (to_jsonb(c) -> b.key))
  )
$$;
revoke execute on function private.can_undo(bigint) from public, anon;
grant execute on function private.can_undo(bigint) to authenticated;
-- undo_edit already refuses whatever can_undo refuses, so it needs no change.

-- 4. Admin rights only for a confirmed email: at sign-up if it is already confirmed (Google, Apple), or later when the
-- person confirms it. And profiles.email follows the account's email when it changes.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, full_name, school, role, is_admin)
  values (
    new.id,
    coalesce(new.email, ''),
    left(coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), nullif(new.raw_user_meta_data ->> 'name', ''), ''), 120),
    coalesce(new.raw_user_meta_data ->> 'school', ''),
    case when new.raw_user_meta_data ->> 'role' in ('Delegate', 'Chair', 'Secretariat')
      then new.raw_user_meta_data ->> 'role' else 'Delegate' end,
    new.email_confirmed_at is not null and exists (select 1 from private.admin_emails a where lower(a.email) = lower(new.email))
  );
  return new;
end $$;

create or replace function private.sync_auth_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = coalesce(new.email, '') where id = new.id and email is distinct from coalesce(new.email, '');
  end if;
  if new.email_confirmed_at is not null and new.email is not null
     and (old.email_confirmed_at is null or new.email is distinct from old.email)
     and exists (select 1 from private.admin_emails a where lower(a.email) = lower(new.email)) then
    update public.profiles set is_admin = true where id = new.id and not is_admin;
  end if;
  return new;
end $$;
revoke execute on function private.sync_auth_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated after update of email, email_confirmed_at on auth.users
  for each row execute function private.sync_auth_user();

-- 5. Links changed on a listing that is already live. When someone other than an admin changes the name or one of the
-- three links, an automatic report (reason 'changed') opens for the admins with the old and new values, and the
-- "applications are open" emails that change would send to followers wait: the notify function sends them only once
-- an admin resolves that report, or 24 hours after each notice was queued (timed per notice, not per report). One open automatic report per listing
-- is kept and added to.
alter table public.reports drop constraint if exists reports_reason_check;
alter table public.reports add constraint reports_reason_check check (reason in ('details', 'link', 'inappropriate', 'other', 'changed'));

alter table private.notifications add column if not exists report_id bigint;
alter table private.notifications drop constraint if exists notifications_report_id_fkey;
alter table private.notifications add constraint notifications_report_id_fkey foreign key (report_id) references public.reports (id) on delete set null;

create or replace function private.queue_notifications() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  old_guides int := (select count(*) from jsonb_array_elements(old.guides) g where g ->> 'url' is not null);
  new_guides int := (select count(*) from jsonb_array_elements(new.guides) g where g ->> 'url' is not null);
  k text;
  held bigint;
  lines text := '';
  links_changed boolean := false;
begin
  if new.status <> 'published' then return new; end if;
  if old.status = 'published' and not private.is_admin() then
    if new.name is distinct from old.name then
      lines := lines || E'\nName: ' || left(old.name, 150) || ' → ' || left(new.name, 150);
    end if;
    if new.delegation_url is distinct from old.delegation_url then
      lines := lines || E'\nDelegate link: ' || coalesce(left(old.delegation_url, 200), '(none)') || ' → ' || coalesce(left(new.delegation_url, 200), '(none)');
    end if;
    if new.chair_url is distinct from old.chair_url then
      lines := lines || E'\nChair link: ' || coalesce(left(old.chair_url, 200), '(none)') || ' → ' || coalesce(left(new.chair_url, 200), '(none)');
    end if;
    if new.interest_url is distinct from old.interest_url then
      lines := lines || E'\nInterest link: ' || coalesce(left(old.interest_url, 200), '(none)') || ' → ' || coalesce(left(new.interest_url, 200), '(none)');
    end if;
    links_changed := lines <> '';
  end if;
  if links_changed then
    select r.id into held from public.reports r
      where r.conference_id = new.id and r.reason = 'changed' and r.status = 'open' order by r.id desc limit 1;
    if held is null then
      insert into public.reports (conference_id, reason, note, reporter)
      values (new.id, 'changed', left('Links changed after approval.' || lines, 1000), null) -- the audit log says who
      returning id into held;
    else
      update public.reports set note = left(note || lines, 1000) where id = held;
    end if;
  end if;
  foreach k in array array[
    case when old.delegation_url is null and new.delegation_url is not null then 'delegation' end,
    case when old.chair_url is null and new.chair_url is not null then 'chair' end,
    case when new_guides > old_guides then 'guides' end]
  loop
    if k is not null and not exists (select 1 from private.notifications n
        where n.conference_id = new.id and n.kind = k and n.created_at > now() - interval '24 hours') then
      insert into private.notifications (conference_id, kind, report_id)
      values (new.id, k, case when k in ('delegation', 'chair') then held end);
    end if;
  end loop;
  return new;
end $$;

-- 6. Reports: limits per listing and per person instead of one limit for the whole site, so one person can't stop
-- everyone else from reporting. Signed in: 3 a day about one listing, 20 a day in all. Not signed in: 5 an hour and
-- 20 a day about one listing. Automatic reports don't count.
create or replace function public.report_listing(conf uuid, reason text, note text default '', reply_to text default '') returns void
language plpgsql security definer set search_path = '' as $$
declare n text := trim(coalesce(note, '')); r text := trim(coalesce(reply_to, '')); me uuid := (select auth.uid());
begin
  if not exists (select 1 from public.conferences c where c.id = conf and c.status = 'published') then
    raise exception 'That listing isn''t live' using errcode = 'P0002';
  end if;
  if reason not in ('details', 'link', 'inappropriate', 'other') then raise exception 'Choose what''s wrong' using errcode = '22023'; end if;
  if length(n) > 1000 then raise exception 'Keep it under 1000 characters' using errcode = '22001'; end if;
  if reason = 'other' and n = '' then raise exception 'Say what''s wrong' using errcode = '22023'; end if;
  if r <> '' and (length(r) > 254 or r !~ '^\S+@\S+\.\S+$') then raise exception 'That email doesn''t look right' using errcode = '22023'; end if;
  if me is not null then
    if (select count(*) from public.reports x where x.reporter = me and x.conference_id = conf and x.reason <> 'changed' and x.created_at > now() - interval '1 day') >= 3
       or (select count(*) from public.reports x where x.reporter = me and x.reason <> 'changed' and x.created_at > now() - interval '1 day') >= 20 then
      raise exception 'You''ve sent a lot of reports today. Try again tomorrow, or email hello@collex.au.' using errcode = '54000';
    end if;
  elsif (select count(*) from public.reports x where x.reporter is null and x.conference_id = conf and x.reason <> 'changed' and x.created_at > now() - interval '1 hour') >= 5
     or (select count(*) from public.reports x where x.reporter is null and x.conference_id = conf and x.reason <> 'changed' and x.created_at > now() - interval '1 day') >= 20 then
    raise exception 'Too many reports about this listing just now. Log in to report it, or email hello@collex.au.' using errcode = '54000';
  end if;
  insert into public.reports (conference_id, reason, note, reply_to, reporter)
  values (conf, reason, n, r, me);
end $$;
revoke execute on function public.report_listing(uuid, text, text, text) from public;
grant execute on function public.report_listing(uuid, text, text, text) to anon, authenticated;

-- 7. Votes from the delegates' devices. A vote counts only for the vote that is open now: the committee's poll or
-- resolution vote (built the same way as voteKey in src/lib/room.ts) or the room's open straw poll (strawKey).
-- Each seat keeps at most its 20 newest ballots. Taking a ballot back is always allowed.
create or replace function private.open_vote_key(cid uuid) returns text
language sql stable security definer set search_path = '' as $$
  select left(case
    when jsonb_typeof(c.state -> 'poll') = 'object' then
      'poll|' || coalesce(c.state -> 'poll' ->> 'kind', '') || '|'
        || coalesce(c.state -> 'poll' ->> 'motion', case when jsonb_typeof(c.state -> 'amend') = 'object' then c.state -> 'amend' ->> 'id' end, '')
        || '|' || coalesce(case when jsonb_typeof(c.state -> 'amend') = 'object' then c.state -> 'amend' ->> 'stage' end, '')
    when c.state ->> 'step' = 'vote' then
      'res|' || coalesce(case when jsonb_typeof(c.state -> 'tr') = 'object' then c.state -> 'tr' ->> 'current' end, c.state ->> 'topic', '')
  end, 200)
  from public.chambers c where c.id = cid
$$;
revoke execute on function private.open_vote_key(uuid) from public, anon, authenticated;

create or replace function public.room_vote(cid uuid, vote_key text, ballot text) returns void
language plpgsql security definer set search_path = '' as $$
declare seat text := private.seat_of(cid); k text; straw jsonb;
begin
  if seat is null then raise exception 'You don''t have a seat in this committee' using errcode = '42501'; end if;
  if coalesce(ballot, '') = '' then
    delete from public.chamber_votes where chamber_id = cid and key = vote_key and delegate_id = seat;
    return;
  end if;
  k := private.open_vote_key(cid);
  select room -> 'straw' into straw from public.chambers where id = cid;
  if not (
       (k is not null and (vote_key = k
          -- the browser cuts at 200 UTF-16 units and Postgres at 200 characters; long keys only need to agree this far
          or (char_length(k) >= 190 and left(vote_key, 150) = left(k, 150))))
    or (jsonb_typeof(straw) = 'object' and straw ->> 'open' = 'true' and vote_key = 'straw|' || (straw ->> 'id'))
  ) then
    raise exception 'That vote has closed' using errcode = '22023';
  end if;
  insert into public.chamber_votes (chamber_id, key, delegate_id, user_id, ballot) values (cid, vote_key, seat, (select auth.uid()), ballot)
  on conflict (chamber_id, key, delegate_id) do update set ballot = excluded.ballot, user_id = excluded.user_id, at = now();
  delete from public.chamber_votes v where v.chamber_id = cid and v.delegate_id = seat
    and v.key not in (select x.key from public.chamber_votes x where x.chamber_id = cid and x.delegate_id = seat order by x.at desc limit 20);
  delete from public.chamber_votes where chamber_id = cid and at < now() - interval '2 days';
end $$;
revoke execute on function public.room_vote(uuid, text, text) from public, anon;
grant execute on function public.room_vote(uuid, text, text) to authenticated;

-- room_chair: every list it returns has a ceiling now (seats 300, votes 2000), not just asks, notes and files.
create or replace function public.room_chair(cid uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare c record;
begin
  select id, devices, delegate_code, room into c from public.chambers where id = cid;
  if c.id is null or not private.in_chamber(cid) then
    raise exception 'That committee isn''t shared with you' using errcode = '42501';
  end if;
  return jsonb_build_object('on', c.devices, 'code', c.delegate_code, 'room', c.room,
    'seats', (select coalesce(jsonb_agg(jsonb_build_object('user_id', s.user_id, 'delegate_id', s.delegate_id, 'name', coalesce(nullif(p.full_name, ''), p.email, 'A delegate')) order by s.joined_at), '[]'::jsonb)
      from (select * from public.chamber_seats where chamber_id = cid order by joined_at limit 300) s left join public.profiles p on p.id = s.user_id),
    'asks', (select coalesce(jsonb_agg(to_jsonb(a) order by a.created_at), '[]'::jsonb) from
      (select id, delegate_id, kind, body, status, created_at from public.chamber_asks where chamber_id = cid and status = 'open' order by created_at limit 80) a),
    'notes', (select coalesce(jsonb_agg(to_jsonb(n) order by n.created_at), '[]'::jsonb) from
      (select id, from_id, to_id, body, created_at from public.chamber_notes where chamber_id = cid order by created_at desc limit 150) n),
    'files', (select coalesce(jsonb_agg(to_jsonb(f) order by f.created_at desc), '[]'::jsonb) from
      (select id, from_id, name, path, size, created_at, true as mine from public.chamber_files where chamber_id = cid order by created_at desc limit 60) f),
    'votes', (select coalesce(jsonb_agg(jsonb_build_object('key', v.key, 'delegate_id', v.delegate_id, 'ballot', v.ballot)), '[]'::jsonb)
      from (select key, delegate_id, ballot from public.chamber_votes where chamber_id = cid and at > now() - interval '6 hours' order by at desc limit 2000) v));
end $$;
revoke execute on function public.room_chair(uuid) from public, anon;
grant execute on function public.room_chair(uuid) to authenticated;

-- 8. Uploads: fewer files a day (covers 10, guides 20, photos 40, committee files 20) and at most 100 MB a day per
-- person across all four buckets. People can now delete their own covers, photos and guides (the site deletes them
-- before deleting an account). Both limits count files uploaded in the last 24 hours that still exist.
create or replace function private.bytes_today() returns bigint
language sql stable security definer set search_path = '' as $$
  select coalesce(sum(case when (o.metadata ->> 'size') ~ '^[0-9]{1,12}$' then (o.metadata ->> 'size')::bigint else 0 end), 0)::bigint
  from storage.objects o
  where o.owner_id = (select auth.uid())::text and o.created_at > now() - interval '24 hours'
    and o.bucket_id in ('covers', 'guides', 'photos', 'chamber-files')
$$;
revoke execute on function private.bytes_today() from public, anon;
grant execute on function private.bytes_today() to authenticated;

drop policy if exists "Upload a cover to your own folder" on storage.objects;
create policy "Upload a cover to your own folder" on storage.objects for insert to authenticated
with check (bucket_id = 'covers' and (storage.foldername(name))[1] = (select auth.uid())::text
  and private.uploads_today('covers') < 10 and private.bytes_today() < 104857600);

drop policy if exists "Upload a guide to your own folder" on storage.objects;
create policy "Upload a guide to your own folder" on storage.objects for insert to authenticated
with check (bucket_id = 'guides' and (storage.foldername(name))[1] = (select auth.uid())::text
  and private.uploads_today('guides') < 20 and private.bytes_today() < 104857600);

drop policy if exists "Upload a photo to your own folder" on storage.objects;
create policy "Upload a photo to your own folder" on storage.objects for insert to authenticated
with check (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text
  and private.uploads_today('photos') < 40 and private.bytes_today() < 104857600);

drop policy if exists "People in a committee add its files" on storage.objects;
create policy "People in a committee add its files" on storage.objects for insert to authenticated
with check (case when bucket_id = 'chamber-files'
  then private.in_room(private.as_uuid((storage.foldername(name))[1])) and (storage.foldername(name))[2] = (select auth.uid())::text
       and private.uploads_today('chamber-files') < 20 and private.bytes_today() < 104857600
  else false end);

drop policy if exists "Delete your own covers, photos and guides" on storage.objects;
create policy "Delete your own covers, photos and guides" on storage.objects for delete to authenticated
using (bucket_id in ('covers', 'photos', 'guides') and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Listing (and the storage API's delete, which reads the rows it removes) needs SELECT. The buckets are public, so the
-- files themselves are already readable by link; this only lets a person list their own folder, never anyone else's.
drop policy if exists "List your own covers, photos and guides" on storage.objects;
create policy "List your own covers, photos and guides" on storage.objects for select to authenticated
using (bucket_id in ('covers', 'photos', 'guides') and (storage.foldername(name))[1] = (select auth.uid())::text);

-- 9. Deleting an account, by an admin or by the person. Before the account goes, their name and email come out of the
-- audit log (as the person who did something, and inside the details where they were named), the invite log, report
-- reply addresses and queued committee emails. Everything tied to the account is then removed by the database itself.
create or replace function private.scrub_person(target uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare em text; names text[];
begin
  select lower(email) into em from auth.users where id = target;
  select array_agg(distinct x) filter (where x is not null and length(x) >= 2) into names from (
    select full_name as x from public.profiles where id = target
    union all select name from public.applications where user_id = target
    union all select contact_name from public.registrations where user_id = target
  ) n;
  em := coalesce(em, ''); names := coalesce(names, '{}');

  update public.audit_log set actor_email = '' where actor = target and actor_email <> '';
  update public.audit_log set detail = detail - 'name'
    where action = 'application received' and detail ? 'name' and (actor = target or detail ->> 'name' = any (names));
  update public.audit_log set detail = detail - 'invitee' where em <> '' and lower(detail ->> 'invitee') = em;
  update public.audit_log set detail = detail - 'organiser' where em <> '' and lower(detail ->> 'organiser') = em;
  update public.audit_log set target_label = '' where target_type = 'user' and target_id = target::text;
  update public.audit_log set actor_email = '' where em <> '' and lower(actor_email) = em;

  delete from private.invite_log where inviter = target or (em <> '' and invitee_email = em);
  update public.reports set reply_to = '' where reply_to <> '' and (reporter = target or (em <> '' and lower(reply_to) = em));
  update private.chamber_mail set inviter = 'A chair' where inviter = any (names) or (em <> '' and lower(inviter) = em);
end $$;
revoke execute on function private.scrub_person(uuid) from public, anon, authenticated;

create or replace function public.delete_user(target uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() then raise exception 'Only admins can do this' using errcode = '42501'; end if;
  if target = (select auth.uid()) then raise exception 'You cannot delete your own account here' using errcode = '42501'; end if;
  if not exists (select 1 from public.profiles where id = target and not is_admin) then
    raise exception 'Remove their admin access first, or the account is already gone' using errcode = '42501';
  end if;
  perform private.log('deleted user', 'user', target::text, '', '{}'); -- no email: the point is to forget them
  perform private.scrub_person(target);
  delete from auth.users where id = target;
end $$;
revoke execute on function public.delete_user(uuid) from public, anon;
grant execute on function public.delete_user(uuid) to authenticated;

-- CONTRACT: public.delete_my_account() returns void. The site deletes the person's own files through the storage API
-- first, then calls this.
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := (select auth.uid());
begin
  if me is null then raise exception 'Log in first' using errcode = '42501'; end if;
  perform private.log('deleted their account', 'user', me::text, '', '{}');
  perform private.scrub_person(me);
  delete from auth.users where id = me;
end $$;
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- 10. Keeping less. Every night:
--   * 12 months after a conference ended, the personal free text on its applications and registrations is blanked.
--     The row stays (who, which conference, kind, status, committee, country), so delegates keep their record.
--   * page counts older than 13 months, sent or failed emails older than 90 days, follower notices older than 90 days,
--     the audit log older than 24 months, and committee notes, requests and votes older than 60 days are deleted.
alter table public.applications add column if not exists redacted_at timestamptz;
alter table public.registrations add column if not exists redacted_at timestamptz;
-- A blanked registration has no contact left; the checks still hold for every live one.
alter table public.registrations drop constraint if exists registrations_contact_name_check;
alter table public.registrations add constraint registrations_contact_name_check
  check (redacted_at is not null or (char_length(contact_name) >= 2 and char_length(contact_name) <= 100));
alter table public.registrations drop constraint if exists registrations_contact_email_check;
alter table public.registrations add constraint registrations_contact_email_check
  check (redacted_at is not null or (char_length(contact_email) <= 254 and contact_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'));

create or replace function private.forget_old() returns void
language plpgsql security definer set search_path = '' as $$
declare cutoff date := ((now() at time zone 'Australia/Sydney') - interval '12 months')::date;
begin
  update public.applications a set school = '', year = '', experience = '', note = '', prefs = '{}'::jsonb,
         checkin_token = gen_random_uuid(), redacted_at = now()
  from public.conferences c
  where c.id = a.conference_id and a.redacted_at is null and coalesce(c.end_date, c.start_date) < cutoff;
  update public.registrations g set contact_name = '', contact_email = '', notes = null, redacted_at = now()
  from public.conferences c
  where c.id = g.conference_id and g.redacted_at is null and coalesce(c.end_date, c.start_date) < cutoff;

  delete from private.page_hits where day < ((now() at time zone 'Australia/Sydney') - interval '13 months')::date;
  delete from private.mail where sent_at < now() - interval '90 days' or failed_at < now() - interval '90 days';
  delete from private.notifications where created_at < now() - interval '90 days';
  delete from public.audit_log where at < now() - interval '24 months';
  delete from public.chamber_notes where created_at < now() - interval '60 days';
  delete from public.chamber_asks where created_at < now() - interval '60 days';
  delete from public.chamber_votes where at < now() - interval '60 days';
  delete from private.invite_log where at < now() - interval '2 days';
  -- The run history of the every-minute jobs grows fast. If this database won't let us trim it, the rest still ran.
  begin
    delete from cron.job_run_details where end_time < now() - interval '14 days';
  exception when others then null;
  end;
end $$;
revoke execute on function private.forget_old() from public, anon, authenticated;

select cron.schedule('collex-forget-old', '15 16 * * *', 'select private.forget_old();');

-- 22. Co-organisers who can only view see names, schools, statuses and allocations, never contact emails, notes or
-- what applicants wrote. The tables themselves are now readable only by the applicant, editors and admins; viewers
-- (and editors, if they like) read the safe columns through these two functions.
drop policy if exists "People read their own application and their listing's" on public.applications;
create policy "People read their own application and their listing's" on public.applications for select to authenticated
using (user_id = (select auth.uid()) or private.can_edit(conference_id) or (select private.is_admin()));

drop policy if exists "People read their own registration and their listing's" on public.registrations;
create policy "People read their own registration and their listing's" on public.registrations for select to authenticated
using (user_id = (select auth.uid()) or private.can_edit(conference_id) or (select private.is_admin()));

-- confirmed_at belongs to item 13 (0040); it is added here so the viewers' list can show it.
alter table public.applications add column if not exists confirmed_at timestamptz;

create or replace function public.team_applications(conf uuid)
returns table(id uuid, conference_id uuid, kind text, role_title text, name text, school text, year text, status text,
              committee text, country text, allocation_sent_at timestamptz, confirmed_at timestamptz, checked_in_at timestamptz,
              created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select a.id, a.conference_id, a.kind, a.role_title, a.name, a.school, a.year, a.status,
         a.committee, a.country, a.allocation_sent_at, a.confirmed_at, a.checked_in_at, a.created_at
  from public.applications a
  where a.conference_id = conf and (private.can_view(conf) or private.is_admin())
  order by a.created_at
$$;
revoke execute on function public.team_applications(uuid) from public, anon;
grant execute on function public.team_applications(uuid) to authenticated;

create or replace function public.team_registrations(conf uuid)
returns table(id uuid, conference_id uuid, school text, contact_name text, delegates integer, status text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select g.id, g.conference_id, g.school, g.contact_name, g.delegates, g.status, g.created_at
  from public.registrations g
  where g.conference_id = conf and (private.can_view(conf) or private.is_admin())
  order by g.created_at
$$;
revoke execute on function public.team_registrations(uuid) from public, anon;
grant execute on function public.team_registrations(uuid) to authenticated;
