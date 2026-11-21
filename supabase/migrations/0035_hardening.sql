-- Hardening from the site review. Every function here is the live definition with one change added, so nothing else
-- about how it behaves moves. In order:
--   1. Every list stored on a listing (committees, guides, secretariat, roles, key dates, schedule) must be a list of
--      records with the fields the site reads, of the right type. A list with a blank entry ([null]) is refused.
--   2. Two read functions (admin_conferences, my_listings) and a public `claimable` column, so the site can stop
--      reading submitted_by, review_note and submitter_role from the table. Taking those columns away from visitors
--      is a separate step, done once the site uses these (it would blank the public pages if done first).
--   3. An application's choices (committees, countries) must be short lists of short words.
--   4. Organiser emails, and tests of them, are only sent for a live listing.
--   5. "Applications are open", "new guides" and "new roles" emails go out at most once a day per listing and kind.
--   6. Sending allocations twice at once (two clicks, two tabs) can't email anyone twice.
--   7. Taking a seat by code counts towards the same "too many tries" limit as looking a code up.
--   8. Error reports have a tighter limit, and reports older than 30 days are cleared every night.
--   9. Indexes for the foreign keys that had none.
--  10. The outbox keeps count of tries, so one refused email can't hold up the rest (see the mailer function).
-- Safe to run twice.


-- 1. The shape of the lists on a listing ------------------------------------------------------------------------------
-- Lax JSON paths skip over an entry that has no fields at all, so the older checks let [null] or ["x"] through. Each
-- check below first refuses anything that isn't a record, then requires the fields the site reads. Extra fields are
-- allowed (a guide whose committee was removed is kept as it was). Lengths are at least what the editor allows.
-- (Postgres regular expressions count to 255 at most, so 300 is written as two runs of 150, 400 as two of 200.)

alter table public.conferences drop constraint if exists conferences_committees_rows;
alter table public.conferences add constraint conferences_committees_rows check (
  jsonb_typeof(committees) = 'array' and jsonb_array_length(committees) <= 60
  and not jsonb_path_exists(committees, '$[*] ? (@.type() != "object")')
  and not jsonb_path_exists(committees, '$[*] ? (!(
        @.name.type() == "string" && @.name like_regex "^.{1,120}$" flag "s"
     && @.topic.type() == "string" && @.topic like_regex "^.{0,150}.{0,150}$" flag "s"
     && @.level.type() == "string" && @.level like_regex "^.{0,150}.{0,150}$" flag "s"
     && @.chairs.type() == "string" && @.chairs like_regex "^.{0,150}.{0,150}$" flag "s"))')
);

alter table public.conferences drop constraint if exists conferences_guides_rows;
alter table public.conferences add constraint conferences_guides_rows check (
  jsonb_typeof(guides) = 'array' and jsonb_array_length(guides) <= 60
  and not jsonb_path_exists(guides, '$[*] ? (@.type() != "object")')
  and not jsonb_path_exists(guides, '$[*] ? (!(
        @.committee.type() == "string" && @.committee like_regex "^.{1,200}$" flag "s"
     && (@.url == null || @.url.type() == "string")
     && (!exists(@.released) || @.released == null
         || (@.released.type() == "string" && @.released like_regex "^[0-9]{4}-[0-9]{2}-[0-9]{2}$"))))')
);

alter table public.conferences drop constraint if exists conferences_secretariat_rows;
alter table public.conferences add constraint conferences_secretariat_rows check (
  jsonb_typeof(secretariat) = 'array' and jsonb_array_length(secretariat) <= 40
  and not jsonb_path_exists(secretariat, '$[*] ? (@.type() != "object")')
  and not jsonb_path_exists(secretariat, '$[*] ? (!(
        @.role.type() == "string" && @.role like_regex "^.{1,120}$" flag "s"
     && @.name.type() == "string" && @.name like_regex "^.{1,120}$" flag "s"
     && (!exists(@.photo) || @.photo.type() == "string")))')
);

-- Roles already have a list check (at most 12) and a kind check; this adds "each one is a record" and its fields.
alter table public.conferences drop constraint if exists conferences_roles_rows;
alter table public.conferences add constraint conferences_roles_rows check (
  not jsonb_path_exists(roles, '$[*] ? (@.type() != "object")')
  and not jsonb_path_exists(roles, '$[*] ? (!(
        @.kind.type() == "string"
     && @.title.type() == "string" && @.title like_regex "^.{0,120}$" flag "s"
     && @.note.type() == "string" && @.note like_regex "^.{0,200}.{0,200}$" flag "s"
     && (@.url == null || @.url.type() == "string")))')
);

-- Key dates already need a label and a well-formed date; this adds "each one is a record" and "date is there,
-- as a date or empty". The schedule check from 0033 already refuses anything that isn't a record.
alter table public.conferences drop constraint if exists conferences_key_dates_rows;
alter table public.conferences add constraint conferences_key_dates_rows check (
  not jsonb_path_exists(key_dates, '$[*] ? (@.type() != "object")')
  and not jsonb_path_exists(key_dates, '$[*] ? (!(@.date == null || @.date.type() == "string"))')
);


-- 2. Reading a listing's private fields without the table -------------------------------------------------------------
-- Whether a listing can be claimed is all the public pages need to know about who sent it.
alter table public.conferences add column if not exists claimable boolean generated always as (submitted_by is null) stored;

-- Every listing, with every field, for the admin page. Anyone else gets nothing back.
create or replace function public.admin_conferences() returns setof public.conferences
language sql stable security definer set search_path = '' as $$
  select c.* from public.conferences c where (select private.is_admin()) order by c.created_at desc
$$;
revoke execute on function public.admin_conferences() from public, anon;
grant execute on function public.admin_conferences() to authenticated;

-- The listings you sent or help run (any status), with their review note, for "Your conferences".
create or replace function public.my_listings() returns setof public.conferences
language sql stable security definer set search_path = '' as $$
  select c.* from public.conferences c
  where c.submitted_by = (select auth.uid())
     or exists (select 1 from public.organisers o
                where o.conference_id = c.id and o.user_id = (select auth.uid()) and o.accepted_at is not null)
  order by c.created_at desc
$$;
revoke execute on function public.my_listings() from public, anon;
grant execute on function public.my_listings() to authenticated;


-- 3. An application's choices ---------------------------------------------------------------------------------------
-- True when v is a list of at most max_n strings, each 1 to max_len characters.
create or replace function private.short_strings(v jsonb, max_n int, max_len int) returns boolean
language sql immutable set search_path = '' as $$
  select case when jsonb_typeof(v) is distinct from 'array' then false
              else jsonb_array_length(v) <= max_n
                   and not exists (select 1 from jsonb_array_elements(v) e
                                   where jsonb_typeof(e) <> 'string' or char_length(e #>> '{}') not between 1 and max_len) end
$$;
revoke execute on function private.short_strings(jsonb, int, int) from public, anon, authenticated;

-- The form sends up to three committees and five countries. Room is left for a few more; anything else is refused.
create or replace function public.apply_to_conference(conf uuid, app_kind text, app_role text, person_name text, person_school text, person_year text, person_experience text, app_prefs jsonb, app_note text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare c record; me uuid := (select auth.uid()); new_id uuid; old record; title text := left(trim(coalesce(app_role, '')), 120);
begin
  if me is null then raise exception 'Log in to apply' using errcode = '42501'; end if;
  if app_prefs is not null and app_prefs <> 'null'::jsonb and (
       jsonb_typeof(app_prefs) <> 'object'
       or exists (select 1 from jsonb_object_keys(app_prefs) k where k not in ('committees', 'countries'))
       or (app_prefs ? 'committees' and not private.short_strings(app_prefs -> 'committees', 5, 120))
       or (app_prefs ? 'countries' and not private.short_strings(app_prefs -> 'countries', 10, 80))) then
    raise exception 'Your committee and country choices couldn''t be read. Check them and try again.' using errcode = '22023';
  end if;
  if app_prefs = 'null'::jsonb then app_prefs := null; end if;
  select id, name, status, collex_applications, end_date into c from public.conferences where id = conf;
  if c.id is null or c.status <> 'published' or not c.collex_applications then
    raise exception 'This conference isn''t taking applications on Collex' using errcode = '42501';
  end if;
  if c.end_date is not null and c.end_date < (now() at time zone 'Australia/Sydney')::date then
    raise exception 'This conference has finished' using errcode = '42501';
  end if;
  if app_kind <> 'role' then title := ''; end if;
  select id, status into old from public.applications where conference_id = conf and user_id = me and kind = app_kind and role_title = title;
  if old.id is not null then
    if old.status <> 'new' then raise exception 'Your application has already been answered' using errcode = '23505'; end if;
    update public.applications set name = trim(person_name), school = trim(coalesce(person_school, '')), year = trim(coalesce(person_year, '')),
      experience = trim(coalesce(person_experience, '')), prefs = coalesce(app_prefs, '{}'::jsonb), note = trim(coalesce(app_note, '')), updated_at = now()
    where id = old.id;
    return old.id;
  end if;
  if (select count(*) from public.applications where user_id = me and created_at > now() - interval '1 day') >= 20 then
    raise exception 'That''s a lot of applications for one day. Try again tomorrow.' using errcode = '54000';
  end if;
  insert into public.applications (conference_id, user_id, kind, role_title, name, school, year, experience, prefs, note)
  values (conf, me, app_kind, title, trim(person_name), trim(coalesce(person_school, '')), trim(coalesce(person_year, '')), trim(coalesce(person_experience, '')), coalesce(app_prefs, '{}'::jsonb), trim(coalesce(app_note, '')))
  returning id into new_id;
  perform private.log('application received', 'conference', conf::text, c.name, jsonb_build_object('kind', app_kind, 'name', trim(person_name)));
  return new_id;
end $$;
revoke execute on function public.apply_to_conference(uuid, text, text, text, text, text, text, jsonb, text) from public, anon;
grant execute on function public.apply_to_conference(uuid, text, text, text, text, text, text, jsonb, text) to authenticated;


-- 4. Organiser emails only for a live listing ------------------------------------------------------------------------
-- A pending, rejected or unpublished listing has no public page for the email's button to open.
create or replace function public.send_broadcast(conf uuid, to_audience text, mail_subject text, mail_body text)
returns integer language plpgsql security definer set search_path = '' as $$
declare c record; n integer := 0; r record; subj text := trim(coalesce(mail_subject, '')); txt text := trim(coalesce(mail_body, ''));
begin
  if not (private.can_edit(conf) or (select private.is_admin())) then raise exception 'You can''t send email for this conference' using errcode = '42501'; end if;
  select name, slug, status into c from public.conferences where id = conf;
  if c.status is distinct from 'published' then
    raise exception 'Emails can only be sent once the listing is live' using errcode = '42501';
  end if;
  if char_length(subj) < 3 or char_length(subj) > 120 or char_length(txt) < 10 or char_length(txt) > 3000 then
    raise exception 'Write a subject (3 to 120 characters) and a message (10 to 3,000)' using errcode = '22023';
  end if;
  if to_audience not in ('applicants', 'accepted', 'delegates', 'chairs', 'schools', 'followers') then raise exception 'Choose who to send it to' using errcode = '22023'; end if;
  if (select count(*) from public.broadcasts where conference_id = conf and created_at > now() - interval '1 day') >= 5 then
    raise exception 'A conference can send five emails a day' using errcode = '54000';
  end if;
  for r in
    select distinct on (uid) uid, unsub from (
      select a.user_id as uid, null::text as unsub from public.applications a
        where a.conference_id = conf and to_audience in ('applicants', 'accepted', 'delegates', 'chairs')
          and (to_audience = 'applicants' or a.status = 'accepted')
          and (to_audience not in ('delegates', 'chairs') or a.kind = case to_audience when 'delegates' then 'delegate' else 'chair' end)
      union all
      select g.user_id, null from public.registrations g where g.conference_id = conf and to_audience = 'schools' and g.status <> 'declined'
      union all
      select f.user_id, 'https://collex.au/unfollow?t=' || f.token from public.follows f where f.conference_id = conf and to_audience = 'followers'
    ) q order by uid
  loop
    perform private.send_mail(r.uid, c.name || ': ' || subj, subj, txt, 'https://collex.au/conferences/' || c.slug, 'Open the conference',
      case when to_audience = 'followers' then 'You follow ' || c.name || ' on Collex.'
           when to_audience = 'schools' then 'You registered a delegation for ' || c.name || ' on Collex.'
           else 'You applied to ' || c.name || ' on Collex.' end, r.unsub);
    n := n + 1;
  end loop;
  insert into public.broadcasts (conference_id, sent_by, audience, subject, body, recipients) values (conf, (select auth.uid()), to_audience, subj, txt, n);
  perform private.log('email sent', 'conference', conf::text, c.name, jsonb_build_object('audience', to_audience, 'recipients', n, 'subject', subj));
  return n;
end $$;
revoke execute on function public.send_broadcast(uuid, text, text, text) from public, anon;
grant execute on function public.send_broadcast(uuid, text, text, text) to authenticated;

create or replace function public.send_broadcast_test(conf uuid, mail_subject text, mail_body text)
returns text language plpgsql security definer set search_path = '' as $$
declare c record; me uuid := (select auth.uid()); addr text; subj text := trim(coalesce(mail_subject, '')); txt text := trim(coalesce(mail_body, ''));
begin
  if me is null or not (private.can_edit(conf) or (select private.is_admin())) then raise exception 'You can''t send email for this conference' using errcode = '42501'; end if;
  if char_length(subj) < 3 or char_length(subj) > 120 or char_length(txt) < 10 or char_length(txt) > 3000 then
    raise exception 'Write a subject (3 to 120 characters) and a message (10 to 3,000)' using errcode = '22023';
  end if;
  -- Tests have a limit of their own. They are found by the "[Test] " subject.
  if (select count(*) from private.mail where to_user = me and subject like '[Test] %' and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'You can send ten test emails an hour. Try again a little later' using errcode = '54000';
  end if;
  select name, slug, status into c from public.conferences where id = conf;
  if not found then raise exception 'That conference no longer exists' using errcode = '22023'; end if;
  if c.status <> 'published' then raise exception 'Emails can only be sent once the listing is live' using errcode = '42501'; end if;
  select email into addr from auth.users where id = me;
  if addr is null then raise exception 'Your account has no email address' using errcode = '22023'; end if;
  perform private.send_mail(me, '[Test] ' || c.name || ': ' || subj, subj, txt, 'https://collex.au/conferences/' || c.slug, 'Open the conference',
    'This is a test you sent to yourself from the ' || c.name || ' organiser page on Collex. Nobody else got it.', null);
  return addr;
end $$;
revoke execute on function public.send_broadcast_test(uuid, text, text) from public, anon;
grant execute on function public.send_broadcast_test(uuid, text, text) to authenticated;


-- 5. Alert emails at most once a day per listing and kind ------------------------------------------------------------
-- Follower emails: a link switched off and on again, or guides added in several saves, used to email followers each
-- time. Now a second change of the same kind within 24 hours queues nothing (the first email already sent them there).
create or replace function private.queue_notifications() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  old_guides int := (select count(*) from jsonb_array_elements(old.guides) g where g ->> 'url' is not null);
  new_guides int := (select count(*) from jsonb_array_elements(new.guides) g where g ->> 'url' is not null);
  k text;
begin
  if new.status <> 'published' then return new; end if;
  foreach k in array array[
    case when old.delegation_url is null and new.delegation_url is not null then 'delegation' end,
    case when old.chair_url is null and new.chair_url is not null then 'chair' end,
    case when new_guides > old_guides then 'guides' end]
  loop
    if k is not null and not exists (select 1 from private.notifications n
        where n.conference_id = new.id and n.kind = k and n.created_at > now() - interval '24 hours') then
      insert into private.notifications (conference_id, kind) values (new.id, k);
    end if;
  end loop;
  return new;
end $$;
revoke execute on function private.queue_notifications() from public, anon, authenticated;

-- When each kind of alert last went out for a listing. One row per listing and kind.
create table if not exists private.alert_sends (
  conference_id uuid not null references public.conferences (id) on delete cascade,
  kind text not null,
  at timestamptz not null default now(),
  primary key (conference_id, kind)
);
alter table private.alert_sends enable row level security;
revoke all on private.alert_sends from public, anon, authenticated;

-- Role alerts: the same, one batch per listing a day. The row is claimed in one statement, so two saves at once can't
-- both send. Roles added while the day is still running are not alerted later.
create or replace function private.queue_role_alerts() returns trigger
language plpgsql security definer set search_path = '' as $$
declare fresh jsonb; before jsonb := '[]'::jsonb; r record; titles text; claimed int;
begin
  if new.status <> 'published' then return new; end if;
  if tg_op = 'UPDATE' then
    if old.status = 'published' then before := coalesce(old.roles, '[]'::jsonb); end if;
  end if;
  select coalesce(jsonb_agg(x), '[]'::jsonb) into fresh from jsonb_array_elements(coalesce(new.roles, '[]'::jsonb)) x
    where not exists (select 1 from jsonb_array_elements(before) o where o ->> 'title' = x ->> 'title' and o ->> 'kind' = x ->> 'kind');
  if jsonb_array_length(fresh) = 0 then return new; end if;
  insert into private.alert_sends as s (conference_id, kind) values (new.id, 'roles')
  on conflict (conference_id, kind) do update set at = now() where s.at < now() - interval '24 hours'
  returning 1 into claimed;
  if claimed is null then return new; end if;
  for r in select ra.user_id, ra.kinds from public.role_alerts ra where ra.user_id is distinct from new.submitted_by loop
    select string_agg(x ->> 'title', ', ') into titles from jsonb_array_elements(fresh) x where x ->> 'kind' = any (r.kinds);
    if titles is not null then
      perform private.send_mail(r.user_id, new.name || ' is looking for people', new.name, 'New roles are open: ' || left(titles, 600) || '.',
        'https://collex.au/roles', 'See the open roles', 'You asked Collex to tell you about new roles.', 'https://collex.au/roles?alerts=off');
    end if;
  end loop;
  return new;
end $$;
revoke execute on function private.queue_role_alerts() from public, anon, authenticated;


-- 6. Allocations sent once ------------------------------------------------------------------------------------------
-- One send per conference at a time (a second click waits for the first), and each application is marked as sent in
-- the same statement that picks it, so a second send finds nothing left to send.
create or replace function public.send_allocations(conf uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare c record; a record; n integer := 0;
begin
  if not (private.can_edit(conf) or (select private.is_admin())) then raise exception 'You can''t do this for this conference' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended('send_allocations:' || conf::text, 0));
  select name, slug into c from public.conferences where id = conf;
  for a in update public.applications set allocation_sent_at = now()
           where conference_id = conf and status = 'accepted' and committee <> '' and allocation_sent_at is null
           returning id, user_id, committee, country, kind loop
    perform private.send_mail(a.user_id, c.name || ': your allocation', c.name,
      case when a.kind = 'chair' then 'You will chair ' || a.committee || '.'
           when a.country <> '' then 'You will represent ' || a.country || ' in ' || a.committee || '.'
           else 'You are in ' || a.committee || '.' end,
      'https://collex.au/conferences/' || c.slug, 'Open the conference', 'You applied to ' || c.name || ' on Collex.');
    n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function public.send_allocations(uuid) from public, anon;
grant execute on function public.send_allocations(uuid) to authenticated;


-- 7. Taking a seat counts as a try --------------------------------------------------------------------------------
-- Same limit as room_peek (20 tries in 15 minutes, shared with it). A wrong code now returns nothing instead of an
-- error, because an error would undo the recorded try and the limit would never be reached. A wrong state for a real
-- code is still an error.
create or replace function public.room_take_seat(code text, delegate text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  clean text := upper(regexp_replace(coalesce(code, ''), '[^A-Za-z0-9]', '', 'g'));
  cid uuid;
begin
  if me is null then raise exception 'Log in to join a committee' using errcode = '42501'; end if;
  if (select count(*) from private.chamber_join_tries where user_id = me and at > now() - interval '15 minutes') >= 20 then
    raise exception 'Too many tries. Wait a few minutes and try again.' using errcode = '54000';
  end if;
  insert into private.chamber_join_tries (user_id) values (me);
  select id into cid from public.chambers where delegate_code = clean and devices;
  if cid is null then return null; end if;
  if not private.is_delegate(cid, delegate) then raise exception 'That state isn''t in this committee' using errcode = 'P0002'; end if;
  if (select count(*) from public.chamber_seats where chamber_id = cid and delegate_id = delegate and user_id <> me) >= 3 then
    raise exception 'Three people already sit as that state. Ask the chair if that isn''t right.' using errcode = '54000';
  end if;
  insert into public.chamber_seats (chamber_id, user_id, delegate_id) values (cid, me, delegate)
  on conflict (chamber_id, user_id) do update set delegate_id = excluded.delegate_id;
  return cid;
end $$;
revoke execute on function public.room_take_seat(text, text) from public, anon;
grant execute on function public.room_take_seat(text, text) to authenticated;


-- 8. Error reports -----------------------------------------------------------------------------------------------
-- At most 60 new kinds of error an hour, and 500 a day (repeats of one already recorded only add to its count).
create index if not exists client_errors_first_at on private.client_errors (first_at desc);

create or replace function public.report_error(message text, stack text, page text, agent text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  m text := left(trim(coalesce($1, '')), 300);
  st text := left(trim(coalesce($2, '')), 2000);
  pg text := private.clean_path($3);
  ag text := left(trim(coalesce($4, '')), 200);
  d date := (now() at time zone 'Australia/Sydney')::date;
begin
  if m = '' then return; end if;
  -- A flood of different errors (a broken release, or someone poking at it) stops being recorded.
  if (select count(*) from private.client_errors e where e.first_at > now() - interval '1 hour') >= 60
     or (select count(*) from private.client_errors e where e.first_at > now() - interval '1 day') >= 500 then
    -- Repeats of an error already recorded are still counted.
    update private.client_errors e set count = e.count + 1, last_at = now() where e.day = d and e.message = m and e.path = pg;
    return;
  end if;
  insert into private.client_errors as e (day, message, path, stack, agent)
  values (d, m, pg, st, ag)
  on conflict on constraint client_errors_dedupe do update
    set count = e.count + 1, last_at = now();
exception when others then
  -- Reporting a fault must never cause another one.
  null;
end $$;
revoke execute on function public.report_error(text, text, text, text) from public;
grant execute on function public.report_error(text, text, text, text) to anon, authenticated;

-- Every night (6:30 am Sydney in winter), errors not seen for 30 days are cleared. Scheduling by name replaces the job.
select cron.schedule('collex-prune-errors', '30 20 * * *', $job$
  delete from private.client_errors where last_at < now() - interval '30 days';
$job$);


-- 9. Indexes for foreign keys -----------------------------------------------------------------------------------
create index if not exists broadcasts_conference_idx on public.broadcasts (conference_id, created_at);
create index if not exists reports_conference_idx on public.reports (conference_id);
create index if not exists registrations_user_idx on public.registrations (user_id);
create index if not exists listing_claims_user_idx on public.listing_claims (user_id);
-- Also serves the once-a-day check in queue_notifications.
create index if not exists notifications_conference_idx on private.notifications (conference_id, kind, created_at);


-- 10. The outbox keeps count of tries ------------------------------------------------------------------------------
-- claimed_at: when a mailer run took the row (a run that crashed leaves it; after 15 minutes another run takes it).
-- attempts: how many runs have tried it. failed_at and last_error: it will not be tried again, and why.
-- sent_at keeps its meaning for rows already in the outbox: set means sent.
alter table private.mail add column if not exists claimed_at timestamptz;
alter table private.mail add column if not exists attempts int not null default 0;
alter table private.mail add column if not exists failed_at timestamptz;
alter table private.mail add column if not exists last_error text;
drop index if exists private.mail_unsent_idx;
create index if not exists mail_queue_idx on private.mail (id) where sent_at is null and failed_at is null;
