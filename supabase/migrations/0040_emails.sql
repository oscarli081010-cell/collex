-- Emails. Decisions wait 10 minutes before they are emailed, withdrawing keeps a record and tells the organisers,
-- accepted applicants can confirm their place, one-day conferences close after their day, replies reach the
-- organisers, subjects fit, listing reviews are emailed, every email that isn't about the person's own account or
-- application can be unsubscribed from in one click, the queues are emptied every minute without waiting for a
-- browser, a weekly digest, and a health check for admins. Needs 0039. Safe to run twice.

-- Every-minute job: the key below is this project's legacy anon key (a public key with the anon role, no more powerful
-- than the publishable key the site ships). notify and chamber-invite are deployed with verify_jwt on and need a JWT,
-- which the publishable key is not; mailer is deployed with verify_jwt off. If the legacy keys are ever disabled, this
-- job's calls to notify and chamber-invite will start failing with 401 (admin_health shows it).

---------------------------------------------------------------------------------------------------------------------
-- Columns
---------------------------------------------------------------------------------------------------------------------
-- 12. An application can be withdrawn and stay on record.
alter table public.applications drop constraint if exists applications_status_check;
alter table public.applications add constraint applications_status_check
  check (status in ('new', 'accepted', 'waitlisted', 'declined', 'withdrawn'));

-- 11. When the status last changed, and the last status the person was emailed about.
alter table public.applications add column if not exists status_changed_at timestamptz;
alter table public.applications add column if not exists emailed_status text;
alter table public.applications add column if not exists withdrawn_mail_at timestamptz;
alter table public.applications add column if not exists confirmed_at timestamptz; -- 13
alter table public.registrations add column if not exists status_changed_at timestamptz;
alter table public.registrations add column if not exists emailed_status text;
-- Decisions made before this migration were already emailed (applications) or never will be (registrations): mark
-- them as told, so the first run of the decisions job sends nothing old. Decisions made after it have
-- status_changed_at set and are never touched by this line, even if the file runs again.
update public.applications set emailed_status = status
  where status_changed_at is null and emailed_status is null and status in ('accepted', 'waitlisted', 'declined');
update public.registrations set emailed_status = status
  where status_changed_at is null and emailed_status is null and status in ('accepted', 'waitlisted', 'declined');

-- 15. Where a reply goes.
alter table private.mail add column if not exists reply_to text;

-- 19. Give up on a committee or follower email after five tries instead of trying every minute forever.
alter table private.chamber_mail add column if not exists attempts integer not null default 0;
alter table private.notifications add column if not exists attempts integer not null default 0;

-- 20. The weekly digest.
alter table public.profiles add column if not exists digest boolean not null default false;
alter table public.profiles add column if not exists digest_token uuid default gen_random_uuid();
update public.profiles set digest_token = gen_random_uuid() where digest_token is null;
create unique index if not exists profiles_digest_token_key on public.profiles (digest_token);

---------------------------------------------------------------------------------------------------------------------
-- Helpers
---------------------------------------------------------------------------------------------------------------------
-- 16. "Conference name: message", cut to the 200 characters the outbox allows by shortening the name, not the message.
create or replace function private.subject(conf_name text, rest text) returns text
language sql immutable set search_path = '' as $$
  select left(case
    when char_length(coalesce(conf_name, '')) + 2 + char_length(coalesce(rest, '')) <= 200 then coalesce(conf_name, '') || ': ' || coalesce(rest, '')
    else rtrim(left(coalesce(conf_name, ''), greatest(197 - char_length(coalesce(rest, '')), 10))) || '…: ' || coalesce(rest, '')
  end, 200)
$$;
revoke execute on function private.subject(text, text) from public, anon, authenticated;

-- 15. A conference's contact is free text (an email, a name, a phone number). Only a plain email address is used as
-- the Reply-To.
create or replace function private.reply_address(contact text) returns text
language sql immutable set search_path = '' as $$
  select case when length(trim(coalesce(contact, ''))) <= 254
               and lower(trim(coalesce(contact, ''))) ~ '^[a-z0-9._%+''-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$'
              then lower(trim(contact)) end
$$;
revoke execute on function private.reply_address(text) from public, anon, authenticated;

-- send_mail gains reply_to. The old eight-argument version is dropped first, or every call would be ambiguous.
drop function if exists private.send_mail(uuid, text, text, text, text, text, text, text);
create or replace function private.send_mail(who uuid, subject text, heading text, body text, link text, link_label text, why text,
                                             unsub text default null, reply_to text default null) returns void
language sql security definer set search_path = '' as $$
  insert into private.mail (to_user, subject, heading, body, link, link_label, why, unsub, reply_to)
  values (who, left(subject, 200), left(heading, 200), left(body, 4000), link, link_label, why, unsub, reply_to)
$$;
revoke execute on function private.send_mail(uuid, text, text, text, text, text, text, text, text) from public, anon, authenticated;

---------------------------------------------------------------------------------------------------------------------
-- 11. Decisions are emailed after 10 minutes
---------------------------------------------------------------------------------------------------------------------
create or replace function public.set_application(app uuid, new_status text) returns void
language plpgsql security definer set search_path = '' as $$
declare a record;
begin
  if new_status not in ('new', 'accepted', 'waitlisted', 'declined') then raise exception 'Pick accepted, waitlisted or declined' using errcode = '22023'; end if;
  select id, conference_id, status into a from public.applications where id = app;
  if a.id is null or not (private.can_edit(a.conference_id) or (select private.is_admin())) then raise exception 'You can''t change this application' using errcode = '42501'; end if;
  if a.status = 'withdrawn' then raise exception 'They withdrew this application' using errcode = '22023'; end if;
  if a.status = new_status then return; end if;
  -- No email here: private.send_decisions sends one once the new status has stood for 10 minutes.
  update public.applications set status = new_status, status_changed_at = now(), updated_at = now(),
    confirmed_at = case when new_status = 'accepted' then confirmed_at end
  where id = app;
end $$;
revoke execute on function public.set_application(uuid, text) from public, anon;
grant execute on function public.set_application(uuid, text) to authenticated;

create or replace function public.set_registration_status(reg uuid, new_status text) returns void
language plpgsql security definer set search_path = '' as $$
declare r record; cname text;
begin
  if new_status not in ('new', 'accepted', 'waitlisted', 'declined') then
    raise exception 'Pick accepted, waitlisted or declined' using errcode = '22023';
  end if;
  select id, conference_id, school, status into r from public.registrations where id = reg;
  if r.id is null or not (private.can_edit(r.conference_id) or private.is_admin()) then
    raise exception 'You can''t change this registration' using errcode = '42501';
  end if;
  if r.status = new_status then return; end if;
  update public.registrations set status = new_status, status_changed_at = now(), updated_at = now() where id = reg;
  select name into cname from public.conferences where id = r.conference_id;
  perform private.log('registration ' || new_status, 'conference', r.conference_id::text, cname, jsonb_build_object('school', r.school));
end $$;
revoke execute on function public.set_registration_status(uuid, text) from public, anon;
grant execute on function public.set_registration_status(uuid, text) to authenticated;

-- Every 5 minutes: email each applicant and school whose status has stood for 10 minutes and isn't the one they were
-- last told about. Flipping a status back and forth inside 10 minutes sends nothing; back to what they were already
-- told sends nothing.
create or replace function private.send_decisions() returns integer
language plpgsql security definer set search_path = '' as $$
declare a record; c record; n integer := 0; what text; reply text; tail text;
begin
  for a in update public.applications x set emailed_status = x.status
           where x.status in ('accepted', 'waitlisted', 'declined') and x.status_changed_at <= now() - interval '10 minutes'
             and x.emailed_status is distinct from x.status
           returning x.user_id, x.conference_id, x.kind, x.role_title, x.status loop
    select name, slug, contact into c from public.conferences where id = a.conference_id;
    if c.name is null then continue; end if;
    reply := private.reply_address(c.contact);
    tail := case when reply is not null then E'\n\nYou can reply to this email to reach the organisers.' else '' end;
    what := case a.kind when 'delegate' then 'delegate application' when 'chair' then 'chair application' else 'application for ' || a.role_title end;
    perform private.send_mail(a.user_id, private.subject(c.name, 'your ' || what), c.name,
      case a.status
        when 'accepted' then 'Your ' || what || ' has been accepted. Open the conference on Collex to confirm you''re coming. The organisers will be in touch with what happens next.'
        when 'waitlisted' then 'Your ' || what || ' is on the waitlist. The organisers will tell you if a place opens.'
        else 'Your ' || what || ' wasn''t successful this time. Thank you for applying.' end || tail,
      'https://collex.au/conferences/' || c.slug, 'Open the conference', 'You applied to ' || c.name || ' on Collex.', null, reply);
    n := n + 1;
  end loop;
  for a in update public.registrations x set emailed_status = x.status
           where x.status in ('accepted', 'waitlisted', 'declined') and x.status_changed_at <= now() - interval '10 minutes'
             and x.emailed_status is distinct from x.status
           returning x.user_id, x.conference_id, x.school, x.status loop
    select name, slug, contact into c from public.conferences where id = a.conference_id;
    if c.name is null then continue; end if;
    reply := private.reply_address(c.contact);
    tail := case when reply is not null then E'\n\nYou can reply to this email to reach the organisers.' else '' end;
    perform private.send_mail(a.user_id, private.subject(c.name, 'your delegation'), c.name,
      case a.status
        when 'accepted' then 'The delegation from ' || a.school || ' has been accepted. The organisers will be in touch with what happens next.'
        when 'waitlisted' then 'The delegation from ' || a.school || ' is on the waitlist. The organisers will tell you if places open.'
        else 'The delegation from ' || a.school || ' wasn''t successful this time. Thank you for registering.' end || tail,
      'https://collex.au/conferences/' || c.slug, 'Open the conference', 'You registered a delegation for ' || c.name || ' on Collex.', null, reply);
    n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function private.send_decisions() from public, anon, authenticated;

select cron.schedule('collex-decisions', '*/5 * * * *', 'select private.send_decisions();');

---------------------------------------------------------------------------------------------------------------------
-- 12. Withdrawing, 13. confirming, 14. one-day conferences
---------------------------------------------------------------------------------------------------------------------
create or replace function public.withdraw_application(app uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare a record; c record; what text; u uuid; tell boolean;
begin
  select id, conference_id, name, kind, role_title, status, withdrawn_mail_at into a
  from public.applications where id = app and user_id = (select auth.uid());
  if a.id is null then raise exception 'You can''t withdraw this application' using errcode = '42501'; end if;
  if a.status = 'withdrawn' then return; end if;
  -- One email to the organisers per application a day, however often someone withdraws and applies again.
  tell := a.withdrawn_mail_at is null or a.withdrawn_mail_at < now() - interval '1 day';
  update public.applications set status = 'withdrawn', committee = '', country = '', allocation_sent_at = null, confirmed_at = null,
    status_changed_at = now(), updated_at = now(), withdrawn_mail_at = case when tell then now() else withdrawn_mail_at end
  where id = app;
  if not tell then return; end if;
  select name, submitted_by into c from public.conferences where id = a.conference_id;
  what := case a.kind when 'delegate' then 'delegate application' when 'chair' then 'chair application' else 'application for ' || a.role_title end;
  for u in select c.submitted_by where c.submitted_by is not null
           union select o.user_id from public.organisers o
                 where o.conference_id = a.conference_id and o.accepted_at is not null and o.role = 'editor' loop
    perform private.send_mail(u, private.subject(c.name, a.name || ' withdrew'), c.name,
      a.name || ' withdrew their ' || what || ' from ' || c.name || '.',
      'https://collex.au/listings', 'Your listings', 'You run ' || c.name || ' on Collex.');
  end loop;
end $$;
revoke execute on function public.withdraw_application(uuid) from public, anon;
grant execute on function public.withdraw_application(uuid) to authenticated;

-- CONTRACT: public.confirm_place(app uuid) returns void. The applicant says they're coming. Only their own accepted
-- application; calling it again changes nothing.
create or replace function public.confirm_place(app uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.applications set confirmed_at = coalesce(confirmed_at, now())
  where id = app and user_id = (select auth.uid()) and status = 'accepted';
  if not found then raise exception 'You can only confirm a place you''ve been offered' using errcode = '42501'; end if;
end $$;
revoke execute on function public.confirm_place(uuid) from public, anon;
grant execute on function public.confirm_place(uuid) to authenticated;

create or replace function public.apply_to_conference(conf uuid, app_kind text, app_role text, person_name text, person_school text,
  person_year text, person_experience text, app_prefs jsonb, app_note text) returns uuid
language plpgsql security definer set search_path = '' as $$
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
  select id, name, status, collex_applications, start_date, end_date, delegation_opens_at, chair_opens_at into c from public.conferences where id = conf;
  if c.id is null or c.status <> 'published' or not c.collex_applications then
    raise exception 'This conference isn''t taking applications on Collex' using errcode = '42501';
  end if;
  -- A conference with no end date ends on its first day.
  if coalesce(c.end_date, c.start_date) < (now() at time zone 'Australia/Sydney')::date then
    raise exception 'This conference has finished' using errcode = '42501';
  end if;
  -- The opening times the page shows. No opening time means open; role applications have none.
  if (app_kind = 'chair' and c.chair_opens_at > now()) or (app_kind = 'delegate' and c.delegation_opens_at > now()) then
    raise exception 'Applications aren''t open yet' using errcode = '42501';
  end if;
  if app_kind <> 'role' then title := ''; end if;
  select id, status into old from public.applications where conference_id = conf and user_id = me and kind = app_kind and role_title = title;
  if old.id is not null then
    if old.status not in ('new', 'withdrawn') then raise exception 'Your application has already been answered' using errcode = '23505'; end if;
    -- Editing a waiting application, or applying again after withdrawing: the same row, waiting again.
    update public.applications set name = trim(person_name), school = trim(coalesce(person_school, '')), year = trim(coalesce(person_year, '')),
      experience = trim(coalesce(person_experience, '')), prefs = coalesce(app_prefs, '{}'::jsonb), note = trim(coalesce(app_note, '')), updated_at = now(),
      status = 'new',
      status_changed_at = case when old.status = 'withdrawn' then now() else status_changed_at end,
      emailed_status = case when old.status = 'withdrawn' then null else emailed_status end,
      confirmed_at = null
    where id = old.id;
    if old.status = 'withdrawn' then
      perform private.log('application received', 'conference', conf::text, c.name, jsonb_build_object('kind', app_kind, 'name', trim(person_name)));
    end if;
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

create or replace function public.register_delegation(conf uuid, school_name text, person_name text, person_email text,
  delegate_count integer, note text default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare c record; new_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'Log in to register' using errcode = '42501'; end if;
  select id, name, status, collex_registration, delegation_opens_at, start_date, end_date into c from public.conferences where id = conf;
  if c.id is null or c.status <> 'published' then
    raise exception 'This conference isn''t taking registrations' using errcode = '42501';
  end if;
  if not c.collex_registration then
    raise exception 'This conference registers through its own form' using errcode = '42501';
  end if;
  if c.delegation_opens_at is not null and c.delegation_opens_at > now() then
    raise exception 'Registration hasn''t opened yet' using errcode = '42501';
  end if;
  if coalesce(c.end_date, c.start_date) < (now() at time zone 'Australia/Sydney')::date then
    raise exception 'This conference has finished' using errcode = '42501';
  end if;
  if exists (select 1 from public.registrations where conference_id = conf and user_id = (select auth.uid())) then
    raise exception 'You''ve already registered for this conference' using errcode = '23505';
  end if;
  if (select count(*) from public.registrations where user_id = (select auth.uid()) and created_at > now() - interval '1 day') >= 20 then
    raise exception 'That''s a lot of registrations for one day. Try again tomorrow.' using errcode = '54000';
  end if;
  insert into public.registrations (conference_id, user_id, school, contact_name, contact_email, delegates, notes)
  values (conf, (select auth.uid()), trim(school_name), trim(person_name), trim(person_email), delegate_count, nullif(trim(coalesce(note, '')), ''))
  returning id into new_id;
  perform private.log('registration received', 'conference', conf::text, c.name, jsonb_build_object('school', trim(school_name), 'delegates', delegate_count));
  return new_id;
end $$;
revoke execute on function public.register_delegation(uuid, text, text, text, integer, text) from public, anon;
grant execute on function public.register_delegation(uuid, text, text, text, integer, text) to authenticated;

-- A withdrawn application can't be given a committee.
create or replace function public.allocate_applications(conf uuid, allocations jsonb) returns integer
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  if not (private.can_edit(conf) or (select private.is_admin())) then raise exception 'You can''t allocate for this conference' using errcode = '42501'; end if;
  update public.applications a
  set committee = left(trim(coalesce(x ->> 'committee', '')), 120), country = left(trim(coalesce(x ->> 'country', '')), 80), updated_at = now(),
      allocation_sent_at = case when a.committee is distinct from left(trim(coalesce(x ->> 'committee', '')), 120) or a.country is distinct from left(trim(coalesce(x ->> 'country', '')), 80) then null else a.allocation_sent_at end
  from jsonb_array_elements(allocations) x
  where a.id = (x ->> 'id')::uuid and a.conference_id = conf and a.status <> 'withdrawn';
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.allocate_applications(uuid, jsonb) from public, anon;
grant execute on function public.allocate_applications(uuid, jsonb) to authenticated;

---------------------------------------------------------------------------------------------------------------------
-- 15, 16, 18. Allocations, organisers' emails, reminders, claims and role alerts: subjects that fit, Reply-To the
-- conference, and an unsubscribe link wherever the email isn't about the person's own application.
---------------------------------------------------------------------------------------------------------------------
create or replace function public.send_allocations(conf uuid) returns integer
language plpgsql security definer set search_path = '' as $$
declare c record; a record; n integer := 0; reply text;
begin
  if not (private.can_edit(conf) or (select private.is_admin())) then raise exception 'You can''t do this for this conference' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended('send_allocations:' || conf::text, 0));
  select name, slug, contact into c from public.conferences where id = conf;
  reply := private.reply_address(c.contact);
  for a in update public.applications set allocation_sent_at = now()
           where conference_id = conf and status = 'accepted' and committee <> '' and allocation_sent_at is null
           returning id, user_id, committee, country, kind loop
    perform private.send_mail(a.user_id, private.subject(c.name, 'your allocation'), c.name,
      case when a.kind = 'chair' then 'You will chair ' || a.committee || '.'
           when a.country <> '' then 'You will represent ' || a.country || ' in ' || a.committee || '.'
           else 'You are in ' || a.committee || '.' end
      || case when reply is not null then E'\n\nYou can reply to this email to reach the organisers.' else '' end,
      'https://collex.au/conferences/' || c.slug, 'Open the conference', 'You applied to ' || c.name || ' on Collex.', null, reply);
    n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function public.send_allocations(uuid) from public, anon;
grant execute on function public.send_allocations(uuid) to authenticated;

-- 18c. One unsubscribe token per person per conference for the organisers' emails. Unsubscribing sets opted_out_at,
-- and send_broadcast skips them from then on, whichever audience they're in.
create table if not exists private.mail_tokens (
  user_id uuid not null references auth.users (id) on delete cascade,
  conference_id uuid not null references public.conferences (id) on delete cascade,
  token uuid not null default gen_random_uuid() unique,
  opted_out_at timestamptz,
  primary key (user_id, conference_id)
);

create or replace function public.send_broadcast(conf uuid, to_audience text, mail_subject text, mail_body text) returns integer
language plpgsql security definer set search_path = '' as $$
declare c record; n integer := 0; r record; tok uuid; reply text;
        subj text := trim(coalesce(mail_subject, '')); txt text := trim(coalesce(mail_body, ''));
begin
  if not (private.can_edit(conf) or (select private.is_admin())) then raise exception 'You can''t send email for this conference' using errcode = '42501'; end if;
  select name, slug, status, contact into c from public.conferences where id = conf;
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
  reply := private.reply_address(c.contact);
  for r in
    select distinct q.uid from (
      select a.user_id as uid from public.applications a
        where a.conference_id = conf and to_audience in ('applicants', 'accepted', 'delegates', 'chairs')
          and (case when to_audience = 'applicants' then a.status <> 'withdrawn' else a.status = 'accepted' end)
          and (to_audience not in ('delegates', 'chairs') or a.kind = case to_audience when 'delegates' then 'delegate' else 'chair' end)
      union all
      select g.user_id from public.registrations g where g.conference_id = conf and to_audience = 'schools' and g.status <> 'declined'
      union all
      select f.user_id from public.follows f where f.conference_id = conf and to_audience = 'followers'
    ) q
    where not exists (select 1 from private.mail_tokens t where t.user_id = q.uid and t.conference_id = conf and t.opted_out_at is not null)
  loop
    insert into private.mail_tokens (user_id, conference_id) values (r.uid, conf) on conflict (user_id, conference_id) do nothing;
    select token into tok from private.mail_tokens where user_id = r.uid and conference_id = conf;
    perform private.send_mail(r.uid, private.subject(c.name, subj), subj, txt, 'https://collex.au/conferences/' || c.slug, 'Open the conference',
      case when to_audience = 'followers' then 'You follow ' || c.name || ' on Collex.'
           when to_audience = 'schools' then 'You registered a delegation for ' || c.name || ' on Collex.'
           else 'You applied to ' || c.name || ' on Collex.' end,
      'https://collex.au/unfollow?t=' || tok, reply);
    n := n + 1;
  end loop;
  insert into public.broadcasts (conference_id, sent_by, audience, subject, body, recipients) values (conf, (select auth.uid()), to_audience, subj, txt, n);
  perform private.log('email sent', 'conference', conf::text, c.name, jsonb_build_object('audience', to_audience, 'recipients', n, 'subject', subj));
  return n;
end $$;
revoke execute on function public.send_broadcast(uuid, text, text, text) from public, anon;
grant execute on function public.send_broadcast(uuid, text, text, text) to authenticated;

create or replace function public.send_broadcast_test(conf uuid, mail_subject text, mail_body text) returns text
language plpgsql security definer set search_path = '' as $$
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
  select name, slug, status, contact into c from public.conferences where id = conf;
  if not found then raise exception 'That conference no longer exists' using errcode = '22023'; end if;
  if c.status <> 'published' then raise exception 'Emails can only be sent once the listing is live' using errcode = '42501'; end if;
  select email into addr from auth.users where id = me;
  if addr is null then raise exception 'Your account has no email address' using errcode = '22023'; end if;
  perform private.send_mail(me, left('[Test] ' || private.subject(c.name, subj), 200), subj, txt, 'https://collex.au/conferences/' || c.slug, 'Open the conference',
    'This is a test you sent to yourself from the ' || c.name || ' organiser page on Collex. Nobody else got it.', null, private.reply_address(c.contact));
  return addr;
end $$;
revoke execute on function public.send_broadcast_test(uuid, text, text) from public, anon;
grant execute on function public.send_broadcast_test(uuid, text, text) to authenticated;

create or replace function private.queue_reminders() returns integer
language plpgsql security definer set search_path = '' as $$
declare today date := (now() at time zone 'Australia/Sydney')::date; r record; f record; n integer := 0; whenText text;
begin
  for r in
    select c.id, c.name, c.slug, k.what, k.on_date, (k.on_date - today) as days from public.conferences c,
      lateral (
        select d ->> 'label' as what, private.as_date(d ->> 'date') as on_date from jsonb_array_elements(c.key_dates) d
          where coalesce(d ->> 'label', '') <> ''
        union all select 'The conference begins', c.start_date where c.start_date is not null
      ) k
    where c.status = 'published' and k.on_date is not null
      and ((k.what = 'The conference begins' and k.on_date - today in (7, 1)) or (k.what <> 'The conference begins' and k.on_date - today in (3, 1)))
  loop
    begin
      insert into private.reminded (conference_id, what, on_date, days) values (r.id, r.what, r.on_date, r.days);
    exception when unique_violation then continue;
    end;
    whenText := case r.days when 1 then 'tomorrow' else 'in ' || r.days || ' days' end || ', on ' || to_char(r.on_date, 'FMDay FMDD FMMonth');
    for f in select user_id, token from public.follows where conference_id = r.id loop
      perform private.send_mail(f.user_id, private.subject(r.name, r.what || ' ' || case r.days when 1 then 'tomorrow' else 'in ' || r.days || ' days' end),
        r.name, r.what || ' ' || whenText || '.', 'https://collex.au/conferences/' || r.slug, 'Open the conference',
        'You follow ' || r.name || ' on Collex.', 'https://collex.au/unfollow?t=' || f.token);
      n := n + 1;
    end loop;
  end loop;
  return n;
end $$;
revoke execute on function private.queue_reminders() from public, anon, authenticated;

-- There is no reply address on claim emails, so they don't ask for a reply.
create or replace function public.decide_claim(claim uuid, approve boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare k record; c record;
begin
  if not (select private.is_admin()) then raise exception 'Admins only' using errcode = '42501'; end if;
  select id, conference_id, user_id, status into k from public.listing_claims where id = claim;
  if k.id is null or k.status <> 'pending' then return; end if;
  select id, name, slug, submitted_by into c from public.conferences where id = k.conference_id;
  if approve then
    if c.submitted_by is not null then raise exception 'This listing already has an owner' using errcode = '23505'; end if;
    update public.conferences set submitted_by = k.user_id where id = c.id;
  end if;
  update public.listing_claims set status = case when approve then 'approved' else 'declined' end, decided_at = now() where id = claim;
  perform private.send_mail(k.user_id, private.subject(c.name, 'your claim'), c.name,
    case when approve then 'Your claim was approved. The listing is now yours to edit and run from Your listings.'
         else 'We couldn''t confirm your claim to this listing. If you think that''s wrong, email hello@collex.au.' end,
    case when approve then 'https://collex.au/listings' else 'https://collex.au/conferences/' || c.slug end,
    case when approve then 'Your listings' else 'Open the conference' end, 'You asked to claim ' || c.name || ' on Collex.');
  perform private.log(case when approve then 'claim approved' else 'claim declined' end, 'conference', c.id::text, c.name, '{}');
end $$;
revoke execute on function public.decide_claim(uuid, boolean) from public, anon;
grant execute on function public.decide_claim(uuid, boolean) to authenticated;

-- 18a. Role alerts unsubscribe with the alert's own token, no login needed.
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
  for r in select ra.user_id, ra.kinds, ra.token from public.role_alerts ra where ra.user_id is distinct from new.submitted_by loop
    select string_agg(x ->> 'title', ', ') into titles from jsonb_array_elements(fresh) x where x ->> 'kind' = any (r.kinds);
    if titles is not null then
      perform private.send_mail(r.user_id, left(new.name, 170) || ' is looking for people', new.name, 'New roles are open: ' || left(titles, 600) || '.',
        'https://collex.au/roles', 'See the open roles', 'You asked Collex to tell you about new roles.', 'https://collex.au/unfollow?t=' || r.token);
    end if;
  end loop;
  return new;
end $$;

---------------------------------------------------------------------------------------------------------------------
-- 17. The person who listed a conference hears when an admin publishes, rejects or takes down the listing.
---------------------------------------------------------------------------------------------------------------------
create or replace function private.mail_listing_review() returns trigger
language plpgsql security definer set search_path = '' as $$
declare note text := trim(coalesce(new.review_note, ''));
begin
  if new.submitted_by is null or new.status is not distinct from old.status
     or new.status not in ('published', 'rejected', 'unpublished') then return new; end if;
  perform private.send_mail(new.submitted_by,
    private.subject(new.name, case new.status when 'published' then 'your listing is live' when 'rejected' then 'your listing wasn''t approved'
                                              else 'your listing has been taken down' end),
    new.name,
    case new.status
      when 'published' then new.name || ' is now live on Collex. Anyone can find it, follow it and see its updates.'
      when 'rejected' then 'We couldn''t approve ' || new.name || ' as it is.'
        || case when note <> '' then E'\n\nWhat the reviewer said: ' || note else '' end
        || E'\n\nYou can edit the listing and send it for review again from Your listings.'
      else new.name || ' has been taken off Collex for now.'
        || case when note <> '' then E'\n\nWhat the reviewer said: ' || note else '' end
        || E'\n\nIf you have questions, email hello@collex.au.' end,
    case when new.status = 'published' and new.slug is not null then 'https://collex.au/conferences/' || new.slug else 'https://collex.au/listings' end,
    case when new.status = 'published' and new.slug is not null then 'Open the listing' else 'Your listings' end,
    'You listed ' || new.name || ' on Collex.');
  return new;
end $$;
revoke execute on function private.mail_listing_review() from public, anon, authenticated;

drop trigger if exists conferences_review_mail on public.conferences;
create trigger conferences_review_mail after update of status on public.conferences
  for each row execute function private.mail_listing_review();

---------------------------------------------------------------------------------------------------------------------
-- 18. One unsubscribe for every token: following a conference, a conference's own emails, role alerts and the digest.
-- The link is always https://collex.au/unfollow?t=<token>; mail apps' one-click POST goes to /api/unfollow?t=<token>,
-- which calls unfollow(t), so it works for every kind too.
---------------------------------------------------------------------------------------------------------------------
create or replace function public.unsubscribe(t uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare nm text;
begin
  if t is null then return null; end if;
  select c.name into nm from public.follows f join public.conferences c on c.id = f.conference_id where f.token = t;
  if found then
    delete from public.follows where token = t;
    return jsonb_build_object('kind', 'follow', 'name', nm);
  end if;
  select c.name into nm from private.mail_tokens m join public.conferences c on c.id = m.conference_id where m.token = t;
  if found then
    update private.mail_tokens set opted_out_at = coalesce(opted_out_at, now()) where token = t;
    return jsonb_build_object('kind', 'conference', 'name', nm);
  end if;
  delete from public.role_alerts where token = t;
  if found then return jsonb_build_object('kind', 'roles', 'name', ''); end if;
  update public.profiles set digest = false where digest_token = t;
  if found then return jsonb_build_object('kind', 'digest', 'name', ''); end if;
  return null;
end $$;
revoke execute on function public.unsubscribe(uuid) from public;
grant execute on function public.unsubscribe(uuid) to anon, authenticated;

create or replace function public.unfollow(t uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare r jsonb := public.unsubscribe(t);
begin
  return case r ->> 'kind' when 'roles' then 'role alerts' when 'digest' then 'the weekly digest' else r ->> 'name' end;
end $$;
revoke execute on function public.unfollow(uuid) from public;
grant execute on function public.unfollow(uuid) to anon, authenticated;

---------------------------------------------------------------------------------------------------------------------
-- 20. The weekly digest: Monday 7am in Sydney, to everyone who turned it on, only when there is something to say.
---------------------------------------------------------------------------------------------------------------------
-- CONTRACT: public.set_digest(turn_on boolean) returns void, for the signed-in person.
create or replace function public.set_digest(turn_on boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := (select auth.uid());
begin
  if me is null then raise exception 'Log in first' using errcode = '42501'; end if;
  update public.profiles set digest = coalesce(turn_on, false), digest_token = coalesce(digest_token, gen_random_uuid()) where id = me;
end $$;
revoke execute on function public.set_digest(boolean) from public, anon;
grant execute on function public.set_digest(boolean) to authenticated;

create table if not exists private.digest_weeks (
  week date primary key,
  queued integer not null default 0,
  at timestamptz not null default now()
);

create or replace function private.queue_digest(force boolean default false) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  here timestamp := now() at time zone 'Australia/Sydney';
  today date := (now() at time zone 'Australia/Sydney')::date;
  fresh text; soon text; roles text; body text; p record; n integer := 0;
begin
  -- The job runs at 20:00 and 21:00 UTC on Sundays; only the run that is 7am Monday in Sydney does anything.
  if not force and (extract(isodow from here) <> 1 or extract(hour from here) <> 7) then return 0; end if;
  insert into private.digest_weeks (week) values (today) on conflict (week) do nothing;
  if not found then return 0; end if;

  select string_agg(line, E'\n' order by pub_at desc) into fresh from (
    select '• ' || c.name || coalesce(' · ' || to_char(c.start_date, 'FMDD FMMon')
             || case when c.end_date > c.start_date then '–' || to_char(c.end_date, 'FMDD FMMon') else '' end, '') as line,
           c.published_at as pub_at
    from public.conferences c
    where c.status = 'published' and c.published_at > now() - interval '7 days'
    order by c.published_at desc limit 12) x;

  select string_agg(line, E'\n' order by d, line) into soon from (
    select '• ' || to_char(e.d, 'FMDy FMDD FMMon') || ': ' || e.name || ' – ' || e.what as line, e.d from (
      select c.name, k.label as what, k.d from public.conferences c,
        lateral (select left(x ->> 'label', 80) as label, private.as_date(x ->> 'date') as d from jsonb_array_elements(c.key_dates) x
                 where coalesce(x ->> 'label', '') <> '') k
        where c.status = 'published'
      union all select c.name, 'Delegate applications open', (c.delegation_opens_at at time zone 'Australia/Sydney')::date
        from public.conferences c where c.status = 'published' and c.delegation_opens_at is not null
      union all select c.name, 'Chair applications open', (c.chair_opens_at at time zone 'Australia/Sydney')::date
        from public.conferences c where c.status = 'published' and c.chair_opens_at is not null
      union all select c.name, 'The conference begins', c.start_date
        from public.conferences c where c.status = 'published' and c.start_date is not null
    ) e where e.d between today and today + 14
    order by e.d limit 20) y;

  select string_agg(line, E'\n') into roles from (
    select '• ' || c.name || ': ' || left(string_agg(r ->> 'title', ', '), 200) as line
    from public.conferences c, jsonb_array_elements(c.roles) r
    where c.status = 'published' and coalesce(c.end_date, c.start_date, today) >= today and coalesce(r ->> 'title', '') <> ''
    group by c.id, c.name, c.start_date order by c.start_date nulls last limit 10) z;

  if fresh is null and soon is null and roles is null then return 0; end if;
  body := concat_ws(E'\n\n',
    case when fresh is not null then E'New on Collex this week\n' || fresh end,
    case when soon is not null then E'Coming up in the next two weeks\n' || soon end,
    case when roles is not null then E'Open roles\n' || roles end);

  for p in select pr.id, pr.digest_token from public.profiles pr join auth.users u on u.id = pr.id
           where pr.digest and pr.digest_token is not null and u.email is not null loop
    perform private.send_mail(p.id, 'This week in Sydney MUN', 'This week in Sydney MUN', body,
      'https://collex.au/conferences', 'See all conferences', 'You asked Collex for a weekly email about Sydney MUN.',
      'https://collex.au/unfollow?t=' || p.digest_token);
    n := n + 1;
  end loop;
  update private.digest_weeks set queued = n where week = today;
  return n;
end $$;
revoke execute on function private.queue_digest(boolean) from public, anon, authenticated;

select cron.schedule('collex-digest', '0 20,21 * * 0', 'select private.queue_digest();');

---------------------------------------------------------------------------------------------------------------------
-- 19. The queues are emptied every minute by the database, not only when a browser pokes the functions.
---------------------------------------------------------------------------------------------------------------------
-- A lease per function: a run takes it for two minutes or gives up. It works through the connection pooler (an
-- advisory lock could stick to a pooled connection) and frees itself if a run crashes.
create table if not exists private.job_leases (
  name text primary key,
  until timestamptz not null default '-infinity'
);
insert into private.job_leases (name) values ('mailer'), ('notify'), ('chamber-invite') on conflict (name) do nothing;

-- Calls only the functions that have something waiting. If a vault secret named cron_secret exists, it is sent as
-- x-cron-secret; the functions require it only when their CRON_SECRET is set.
select cron.schedule('collex-send', '* * * * *', $cron$
  select net.http_post(
    url := 'https://npdaczdwmhbtgitmplxc.supabase.co/functions/v1/' || w.f,
    body := '{}'::jsonb,
    params := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wZGFjemR3bWhidGdpdG1wbHhjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM2MDI2MDEsImV4cCI6MjEwOTE3ODYwMX0.ZCZpYIyEBOhAGzVKBemg25Y9tj62-2rpX5EvK0r4kdM',
      'x-cron-secret', coalesce((select s.decrypted_secret from vault.decrypted_secrets s where s.name = 'cron_secret' limit 1), '')),
    timeout_milliseconds := 60000)
  from (values
    ('mailer', exists (select 1 from private.mail m where m.sent_at is null and m.failed_at is null
                        and (m.claimed_at is null or m.claimed_at < now() - interval '15 minutes'))),
    ('notify', exists (select 1 from private.notifications n where n.sent_at is null and n.attempts < 5
                        and (n.report_id is null or n.created_at < now() - interval '24 hours'
                             or exists (select 1 from public.reports r where r.id = n.report_id and r.status = 'resolved')))),
    ('chamber-invite', exists (select 1 from private.chamber_mail j where j.sent_at is null and j.attempts < 5))
  ) w(f, due)
  where w.due;
$cron$);

-- The daily reminders job only queues now; the job above sends them within a minute.
select cron.schedule('collex-reminders', '0 21 * * *', 'select private.queue_reminders();');

---------------------------------------------------------------------------------------------------------------------
-- 21. Admin health. CONTRACT: public.admin_health() returns jsonb, admins only.
---------------------------------------------------------------------------------------------------------------------
create or replace function public.admin_health() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare today date := (now() at time zone 'Australia/Sydney')::date;
begin
  if not private.is_admin() then raise exception 'Admins only' using errcode = '42501'; end if;
  return jsonb_build_object(
    'mail_failed', (select count(*) from private.mail where failed_at is not null)::int,
    'mail_waiting', (select count(*) from private.mail where sent_at is null and failed_at is null)::int,
    'oldest_waiting_minutes', coalesce((select floor(extract(epoch from now() - min(created_at)) / 60)::int
                                        from private.mail where sent_at is null and failed_at is null), 0),
    -- A cron run "succeeds" once it has asked for the web request; whether the function answered well is in the
    -- last entry, from pg_net's record of the last few hours of answers.
    'cron', (select coalesce(jsonb_agg(jsonb_build_object('job', j.jobname, 'last_run', r.start_time,
                                                          'ok', r.status is distinct from 'failed') order by j.jobname), '[]'::jsonb)
             from cron.job j
             left join lateral (select d.start_time, d.status from cron.job_run_details d where d.jobid = j.jobid
                                order by d.start_time desc limit 1) r on true
             where j.jobname like 'collex-%')
            || jsonb_build_array(jsonb_build_object('job', 'edge functions (last hour)',
                 'last_run', (select max(h.created) from net._http_response h where h.created > now() - interval '1 hour'),
                 'ok', not exists (select 1 from net._http_response h where h.created > now() - interval '1 hour'
                                   and (h.status_code >= 400 or h.timed_out or h.error_msg is not null)))),
    'signups_30d', (select count(*) from public.profiles where created_at > now() - interval '30 days')::int,
    'committees_started_30d', (select count(*) from public.audit_log where action = 'started a chamber' and at > now() - interval '30 days')::int,
    'funnel', (select coalesce(jsonb_agg(jsonb_build_object(
        'slug', c.slug, 'name', c.name,
        'views_30d', (select coalesce(sum(h.views), 0) from private.page_hits h where h.path = '/conferences/' || c.slug and h.day > today - 30)::int,
        'applications', (select count(*) from public.applications a where a.conference_id = c.id and a.status <> 'withdrawn')::int,
        'accepted', (select count(*) from public.applications a where a.conference_id = c.id and a.status = 'accepted')::int,
        'confirmed', (select count(*) from public.applications a where a.conference_id = c.id and a.status = 'accepted' and a.confirmed_at is not null)::int,
        'checked_in', (select count(*) from public.applications a where a.conference_id = c.id and a.checked_in_at is not null)::int
      ) order by c.published_at desc nulls last), '[]'::jsonb)
      from (select id, slug, name, published_at from public.conferences where status = 'published'
            order by published_at desc nulls last limit 30) c)
  );
end $$;
revoke execute on function public.admin_health() from public, anon;
grant execute on function public.admin_health() to authenticated;
