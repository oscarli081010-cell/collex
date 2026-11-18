-- Running a conference on Collex, beyond its listing:
--  1. One outbox for every email Collex sends from here on (the "mailer" edge function sends what is queued).
--  2. Applications from individuals (delegate, chair, or an open role), with a committee and country allocated to each.
--  3. Emails from the organisers to their applicants, registered schools or followers.
--  4. Reminders to followers before a conference's key dates, queued once a day.
--  5. Claiming a listing Collex added, decided by an admin.
--  6. A Chambers committee linked to its conference: a live wall for the secretariat, and awards published to the listing.
--  7. A delegate's public record of conferences and awards, off until they turn it on.
--  8. Alerts by email when new roles are listed.
-- Tables are read through row level security; every write goes through a function.

-- 1. Outbox
create table private.mail (
  id bigint generated always as identity primary key,
  to_user uuid not null references auth.users (id) on delete cascade,
  subject text not null check (char_length(subject) between 1 and 200),
  heading text not null,
  body text not null,
  link text,
  link_label text,
  why text not null,
  unsub text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index mail_unsent_idx on private.mail (id) where sent_at is null;
alter table private.mail enable row level security;

create function private.send_mail(who uuid, subject text, heading text, body text, link text, link_label text, why text, unsub text default null) returns void
language sql security definer set search_path = '' as $$
  insert into private.mail (to_user, subject, heading, body, link, link_label, why, unsub)
  values (who, left(subject, 200), left(heading, 200), left(body, 4000), link, link_label, why, unsub)
$$;
revoke execute on function private.send_mail(uuid, text, text, text, text, text, text, text) from public, anon, authenticated;

-- 2. Applications
alter table public.conferences add column collex_applications boolean not null default false;
grant update (collex_applications) on public.conferences to authenticated;

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  conference_id uuid not null references public.conferences (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('delegate', 'chair', 'role')),
  role_title text not null default '' check (char_length(role_title) <= 120),
  name text not null check (char_length(name) between 2 and 100),
  school text not null default '' check (char_length(school) <= 120),
  year text not null default '' check (char_length(year) <= 40),
  experience text not null default '' check (char_length(experience) <= 800),
  prefs jsonb not null default '{}'::jsonb check (jsonb_typeof(prefs) = 'object' and pg_column_size(prefs) <= 2048),
  note text not null default '' check (char_length(note) <= 1000),
  status text not null default 'new' check (status in ('new', 'accepted', 'waitlisted', 'declined')),
  committee text not null default '' check (char_length(committee) <= 120),
  country text not null default '' check (char_length(country) <= 80),
  allocation_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (conference_id, user_id, kind, role_title)
);
create index applications_conference_idx on public.applications (conference_id, status);
create index applications_user_idx on public.applications (user_id);
alter table public.applications enable row level security;
revoke all on public.applications from anon, authenticated;
grant select on public.applications to authenticated;
create policy "People read their own application and their listing's" on public.applications for select to authenticated
  using (user_id = (select auth.uid()) or private.can_view(conference_id) or (select private.is_admin()));

-- Apply, or change an application that hasn't been answered yet.
create function public.apply_to_conference(conf uuid, app_kind text, app_role text, person_name text, person_school text, person_year text, person_experience text, app_prefs jsonb, app_note text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare c record; me uuid := (select auth.uid()); new_id uuid; old record; title text := left(trim(coalesce(app_role, '')), 120);
begin
  if me is null then raise exception 'Log in to apply' using errcode = '42501'; end if;
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

create function public.withdraw_application(app uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.applications where id = app and user_id = (select auth.uid());
  if not found then raise exception 'You can''t withdraw this application' using errcode = '42501'; end if;
end $$;

-- An organiser answers an application; the applicant is emailed.
create function public.set_application(app uuid, new_status text) returns void
language plpgsql security definer set search_path = '' as $$
declare a record; c record; what text;
begin
  if new_status not in ('new', 'accepted', 'waitlisted', 'declined') then raise exception 'Pick accepted, waitlisted or declined' using errcode = '22023'; end if;
  select id, conference_id, user_id, kind, role_title, status into a from public.applications where id = app;
  if a.id is null or not (private.can_edit(a.conference_id) or (select private.is_admin())) then raise exception 'You can''t change this application' using errcode = '42501'; end if;
  if a.status = new_status then return; end if;
  update public.applications set status = new_status, updated_at = now() where id = app;
  if new_status = 'new' then return; end if;
  select name, slug into c from public.conferences where id = a.conference_id;
  what := case a.kind when 'delegate' then 'delegate application' when 'chair' then 'chair application' else 'application for ' || a.role_title end;
  perform private.send_mail(a.user_id, c.name || ': your ' || what,
    c.name,
    case new_status when 'accepted' then 'Your ' || what || ' has been accepted. The organisers will be in touch with what happens next.'
                    when 'waitlisted' then 'Your ' || what || ' is on the waitlist. The organisers will tell you if a place opens.'
                    else 'Your ' || what || ' wasn''t successful this time. Thank you for applying.' end,
    'https://collex.au/conferences/' || c.slug, 'Open the conference', 'You applied to ' || c.name || ' on Collex.');
end $$;

-- Committees and countries for many applications at once (what the allocation screen saves).
create function public.allocate_applications(conf uuid, allocations jsonb) returns integer
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  if not (private.can_edit(conf) or (select private.is_admin())) then raise exception 'You can''t allocate for this conference' using errcode = '42501'; end if;
  update public.applications a
  set committee = left(trim(coalesce(x ->> 'committee', '')), 120), country = left(trim(coalesce(x ->> 'country', '')), 80), updated_at = now(),
      allocation_sent_at = case when a.committee is distinct from left(trim(coalesce(x ->> 'committee', '')), 120) or a.country is distinct from left(trim(coalesce(x ->> 'country', '')), 80) then null else a.allocation_sent_at end
  from jsonb_array_elements(allocations) x
  where a.id = (x ->> 'id')::uuid and a.conference_id = conf;
  get diagnostics n = row_count;
  return n;
end $$;

-- Email every accepted applicant their allocation, once each (again only if it has changed since).
create function public.send_allocations(conf uuid) returns integer
language plpgsql security definer set search_path = '' as $$
declare c record; a record; n integer := 0;
begin
  if not (private.can_edit(conf) or (select private.is_admin())) then raise exception 'You can''t do this for this conference' using errcode = '42501'; end if;
  select name, slug into c from public.conferences where id = conf;
  for a in select id, user_id, committee, country, kind from public.applications
           where conference_id = conf and status = 'accepted' and committee <> '' and allocation_sent_at is null loop
    perform private.send_mail(a.user_id, c.name || ': your allocation', c.name,
      case when a.kind = 'chair' then 'You will chair ' || a.committee || '.'
           when a.country <> '' then 'You will represent ' || a.country || ' in ' || a.committee || '.'
           else 'You are in ' || a.committee || '.' end,
      'https://collex.au/conferences/' || c.slug, 'Open the conference', 'You applied to ' || c.name || ' on Collex.');
    update public.applications set allocation_sent_at = now() where id = a.id;
    n := n + 1;
  end loop;
  return n;
end $$;

-- 3. Emails from the organisers
create table public.broadcasts (
  id uuid primary key default gen_random_uuid(),
  conference_id uuid not null references public.conferences (id) on delete cascade,
  sent_by uuid references auth.users (id) on delete set null,
  audience text not null,
  subject text not null,
  body text not null,
  recipients integer not null,
  created_at timestamptz not null default now()
);
alter table public.broadcasts enable row level security;
revoke all on public.broadcasts from anon, authenticated;
grant select on public.broadcasts to authenticated;
create policy "Organisers read their listing's emails" on public.broadcasts for select to authenticated
  using (private.can_view(conference_id) or (select private.is_admin()));

create function public.send_broadcast(conf uuid, to_audience text, mail_subject text, mail_body text) returns integer
language plpgsql security definer set search_path = '' as $$
declare c record; n integer := 0; r record; subj text := trim(coalesce(mail_subject, '')); txt text := trim(coalesce(mail_body, ''));
begin
  if not (private.can_edit(conf) or (select private.is_admin())) then raise exception 'You can''t send email for this conference' using errcode = '42501'; end if;
  if char_length(subj) < 3 or char_length(subj) > 120 or char_length(txt) < 10 or char_length(txt) > 3000 then
    raise exception 'Write a subject (3 to 120 characters) and a message (10 to 3,000)' using errcode = '22023';
  end if;
  if to_audience not in ('applicants', 'accepted', 'delegates', 'chairs', 'schools', 'followers') then raise exception 'Choose who to send it to' using errcode = '22023'; end if;
  if (select count(*) from public.broadcasts where conference_id = conf and created_at > now() - interval '1 day') >= 5 then
    raise exception 'A conference can send five emails a day' using errcode = '54000';
  end if;
  select name, slug into c from public.conferences where id = conf;
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

-- 4. Reminders: three days and one day before each key date, and a week and a day before the conference starts.
-- A key date is whatever the organiser typed; only a real yyyy-mm-dd date is read as one.
create function private.as_date(t text) returns date
language sql immutable set search_path = '' as $$
  select case when t ~ '^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$' and t !~ '-(02-3[01]|0[469]-31|11-31)$' and (t !~ '-02-29$' or (substr(t, 1, 4)::int % 4 = 0 and (substr(t, 1, 4)::int % 100 <> 0 or substr(t, 1, 4)::int % 400 = 0))) then t::date end
$$;
revoke execute on function private.as_date(text) from public, anon, authenticated;
create table private.reminded (
  conference_id uuid not null references public.conferences (id) on delete cascade,
  what text not null,
  on_date date not null,
  days integer not null,
  primary key (conference_id, what, on_date, days)
);
alter table private.reminded enable row level security;

create function private.queue_reminders() returns integer
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
      perform private.send_mail(f.user_id, r.name || ': ' || r.what || ' ' || case r.days when 1 then 'tomorrow' else 'in ' || r.days || ' days' end,
        r.name, r.what || ' ' || whenText || '.', 'https://collex.au/conferences/' || r.slug, 'Open the conference',
        'You follow ' || r.name || ' on Collex.', 'https://collex.au/unfollow?t=' || f.token);
      n := n + 1;
    end loop;
  end loop;
  return n;
end $$;
revoke execute on function private.queue_reminders() from public, anon, authenticated;

-- 5. Claiming a listing that Collex added
create table public.listing_claims (
  id uuid primary key default gen_random_uuid(),
  conference_id uuid not null references public.conferences (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (char_length(role) between 2 and 80),
  proof text not null check (char_length(proof) between 10 and 800),
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  unique (conference_id, user_id)
);
alter table public.listing_claims enable row level security;
revoke all on public.listing_claims from anon, authenticated;
grant select on public.listing_claims to authenticated;
create policy "People read their own claims, admins all" on public.listing_claims for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));

create function public.claim_listing(conf uuid, your_role text, your_proof text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare c record; me uuid := (select auth.uid()); new_id uuid;
begin
  if me is null then raise exception 'Log in to claim a listing' using errcode = '42501'; end if;
  select id, name, status, submitted_by into c from public.conferences where id = conf;
  if c.id is null or c.status <> 'published' then raise exception 'That listing can''t be claimed' using errcode = '42501'; end if;
  if c.submitted_by is not null then raise exception 'This listing is already run by its organisers. Ask them to add you.' using errcode = '23505'; end if;
  if (select count(*) from public.listing_claims where user_id = me and created_at > now() - interval '1 day') >= 5 then
    raise exception 'That''s a lot of claims for one day. Try again tomorrow.' using errcode = '54000';
  end if;
  insert into public.listing_claims (conference_id, user_id, role, proof) values (conf, me, trim(your_role), trim(your_proof))
  on conflict (conference_id, user_id) do update set role = excluded.role, proof = excluded.proof, status = 'pending', created_at = now(), decided_at = null
  returning id into new_id;
  perform private.log('listing claimed', 'conference', conf::text, c.name, jsonb_build_object('role', trim(your_role)));
  return new_id;
end $$;

create function public.admin_claims() returns table (id uuid, conference_id uuid, conference text, slug text, user_id uuid, name text, email text, role text, proof text, status text, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (select private.is_admin()) then raise exception 'Admins only' using errcode = '42501'; end if;
  return query select k.id, k.conference_id, c.name, c.slug, k.user_id, coalesce(p.full_name, ''), coalesce(p.email, ''), k.role, k.proof, k.status, k.created_at
    from public.listing_claims k join public.conferences c on c.id = k.conference_id left join public.profiles p on p.id = k.user_id
    order by (k.status = 'pending') desc, k.created_at desc limit 200;
end $$;

create function public.decide_claim(claim uuid, approve boolean) returns void
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
  perform private.send_mail(k.user_id, c.name || ': your claim', c.name,
    case when approve then 'Your claim was approved. The listing is now yours to edit and run from Your listings.'
         else 'We couldn''t confirm your claim to this listing. Reply to this email if you think that''s wrong.' end,
    case when approve then 'https://collex.au/listings' else 'https://collex.au/conferences/' || c.slug end,
    case when approve then 'Your listings' else 'Open the conference' end, 'You asked to claim ' || c.name || ' on Collex.');
  perform private.log(case when approve then 'claim approved' else 'claim declined' end, 'conference', c.id::text, c.name, '{}');
end $$;

-- 6. A committee linked to its conference
alter table public.chambers
  add column conference_id uuid references public.conferences (id) on delete set null,
  add column committee text not null default '' check (char_length(committee) <= 120);
create index chambers_conference_idx on public.chambers (conference_id) where conference_id is not null;

-- The conferences a chair can link a committee to: the ones they help run.
create function public.my_conferences() returns table (id uuid, name text, slug text, committees jsonb)
language sql stable security definer set search_path = '' as $$
  select c.id, c.name, c.slug, coalesce((select jsonb_agg(x ->> 'name') from jsonb_array_elements(c.committees) x where coalesce(x ->> 'name', '') <> ''), '[]'::jsonb)
  from public.conferences c
  where c.status in ('published', 'pending') and (private.can_view(c.id) or (select private.is_admin()))
  order by c.start_date desc nulls last
$$;

create function public.link_chamber(cid uuid, conf uuid, committee_name text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.can_manage_chamber(cid) then raise exception 'Only the person who shared this committee can link it' using errcode = '42501'; end if;
  if conf is not null and not (private.can_view(conf) or (select private.is_admin())) then
    raise exception 'You can only link a committee to a conference you help run' using errcode = '42501';
  end if;
  update public.chambers set conference_id = conf, committee = case when conf is null then '' else left(trim(coalesce(committee_name, '')), 120) end where id = cid;
end $$;

create function public.chamber_link(cid uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare c record;
begin
  if not private.in_chamber(cid) then raise exception 'That committee isn''t shared with you' using errcode = '42501'; end if;
  select ch.conference_id, ch.committee, f.name, f.slug into c from public.chambers ch left join public.conferences f on f.id = ch.conference_id where ch.id = cid;
  return jsonb_build_object('conference_id', c.conference_id, 'committee', c.committee, 'name', c.name, 'slug', c.slug);
end $$;

-- The secretariat's wall: every linked committee as it stands. Read-only, for the people who run the listing.
create function public.conference_wall(conf uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (private.can_view(conf) or (select private.is_admin())) then raise exception 'Only the people who run this conference can see its committees' using errcode = '42501'; end if;
  return jsonb_build_object('now', now(), 'rooms', (select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id, 'name', c.name, 'committee', c.committee, 'updated_at', c.updated_at, 'devices', c.devices,
    'state', c.state - 'hist' - 'log' - 'background',
    'seats', (select count(*) from public.chamber_seats s where s.chamber_id = c.id),
    'asks', (select count(*) from public.chamber_asks a where a.chamber_id = c.id and a.status = 'open'),
    'chairs', (select coalesce(jsonb_agg(coalesce(nullif(p.full_name, ''), p.email)), '[]'::jsonb) from
      (select x.owner_id as uid from public.chambers x where x.id = c.id union select m.user_id from public.chamber_members m where m.chamber_id = c.id and m.role = 'chair') u
      join public.profiles p on p.id = u.uid)
  ) order by c.committee, c.name), '[]'::jsonb) from public.chambers c where c.conference_id = conf));
end $$;

-- Awards published from a committee to its conference's page.
create table public.conference_awards (
  id uuid primary key default gen_random_uuid(),
  conference_id uuid not null references public.conferences (id) on delete cascade,
  chamber_id uuid references public.chambers (id) on delete set null,
  committee text not null,
  title text not null,
  state text not null,
  user_id uuid references auth.users (id) on delete set null,
  person text not null default '',
  created_at timestamptz not null default now()
);
create index conference_awards_idx on public.conference_awards (conference_id);
create index conference_awards_user_idx on public.conference_awards (user_id) where user_id is not null;
alter table public.conference_awards enable row level security;
revoke all on public.conference_awards from anon, authenticated;
grant select (id, conference_id, committee, title, state, person, created_at) on public.conference_awards to anon, authenticated;
create policy "Anyone reads the awards of a live conference" on public.conference_awards for select to anon, authenticated
  using (exists (select 1 from public.conferences c where c.id = conference_id and c.status = 'published'));

-- A chair publishes (or publishes again, replacing) the committee's awards. Each award goes to a state; the person is
-- whoever was allocated that state in that committee, or sat in its seat.
create function public.publish_awards(cid uuid) returns integer
language plpgsql security definer set search_path = '' as $$
declare c record; a jsonb; who uuid; st text; n integer := 0;
begin
  select id, name, state, conference_id, committee into c from public.chambers where id = cid;
  if c.id is null or not private.in_chamber(cid) then raise exception 'That committee isn''t shared with you' using errcode = '42501'; end if;
  if c.conference_id is null then raise exception 'Link the committee to its conference first, in Settings' using errcode = '22023'; end if;
  delete from public.conference_awards where chamber_id = cid;
  for a in select * from jsonb_array_elements(coalesce(c.state -> 'awards', '[]'::jsonb)) loop
    st := null; who := null;
    select d ->> 'name' into st from jsonb_array_elements(c.state -> 'delegates') d where d ->> 'id' = a ->> 'who';
    if st is null then continue; end if;
    select ap.user_id into who from public.applications ap
      where ap.conference_id = c.conference_id and ap.status = 'accepted' and lower(ap.country) = lower(st)
        and (ap.committee = '' or lower(ap.committee) in (lower(c.committee), lower(c.name))) limit 1;
    if who is null then select s.user_id into who from public.chamber_seats s where s.chamber_id = cid and s.delegate_id = a ->> 'who' order by s.joined_at limit 1; end if;
    insert into public.conference_awards (conference_id, chamber_id, committee, title, state, user_id, person)
    values (c.conference_id, cid, coalesce(nullif(c.committee, ''), c.name), left(a ->> 'title', 60), st, who,
            coalesce((select nullif(p.full_name, '') from public.profiles p where p.id = who), ''));
    n := n + 1;
  end loop;
  return n;
end $$;

-- 7. A delegate's public record
alter table public.profiles add column public_record boolean not null default false;
grant select (public_record), update (public_record) on public.profiles to authenticated;

create function public.delegate_record(uid uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare p record;
begin
  select id, full_name, school, public_record into p from public.profiles where id = uid;
  if p.id is null or not (p.public_record or p.id = (select auth.uid())) then return null; end if;
  return jsonb_build_object('name', p.full_name, 'school', coalesce(p.school, ''), 'public', p.public_record,
    'conferences', (select coalesce(jsonb_agg(jsonb_build_object('name', c.name, 'slug', c.slug, 'start', c.start_date, 'end', c.end_date, 'kind', a.kind,
        'role', a.role_title, 'committee', a.committee, 'country', a.country) order by c.start_date desc nulls last), '[]'::jsonb)
      from public.applications a join public.conferences c on c.id = a.conference_id where a.user_id = uid and a.status = 'accepted' and c.status = 'published'),
    'awards', (select coalesce(jsonb_agg(jsonb_build_object('title', w.title, 'committee', w.committee, 'state', w.state, 'conference', c.name, 'slug', c.slug, 'start', c.start_date)
        order by c.start_date desc nulls last), '[]'::jsonb)
      from public.conference_awards w join public.conferences c on c.id = w.conference_id where w.user_id = uid and c.status = 'published'));
end $$;

-- 8. Role alerts: an email when a live conference lists new roles of the kinds you asked about.
create table public.role_alerts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  kinds text[] not null,
  token uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now()
);
alter table public.role_alerts enable row level security;
revoke all on public.role_alerts from anon, authenticated;
grant select on public.role_alerts to authenticated;
create policy "Read own role alert" on public.role_alerts for select to authenticated using (user_id = (select auth.uid()));

create function public.set_role_alert(alert_kinds text[]) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := (select auth.uid());
begin
  if me is null then raise exception 'Log in to set an alert' using errcode = '42501'; end if;
  if alert_kinds is null or cardinality(alert_kinds) = 0 then delete from public.role_alerts where user_id = me; return; end if;
  insert into public.role_alerts (user_id, kinds) values (me, alert_kinds[1:10]) on conflict (user_id) do update set kinds = excluded.kinds;
end $$;

create function private.queue_role_alerts() returns trigger
language plpgsql security definer set search_path = '' as $$
declare fresh jsonb; before jsonb := '[]'::jsonb; r record; titles text;
begin
  if new.status <> 'published' then return new; end if;
  if tg_op = 'UPDATE' then
    if old.status = 'published' then before := coalesce(old.roles, '[]'::jsonb); end if;
  end if;
  select coalesce(jsonb_agg(x), '[]'::jsonb) into fresh from jsonb_array_elements(coalesce(new.roles, '[]'::jsonb)) x
    where not exists (select 1 from jsonb_array_elements(before) o where o ->> 'title' = x ->> 'title' and o ->> 'kind' = x ->> 'kind');
  if jsonb_array_length(fresh) = 0 then return new; end if;
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
create trigger conferences_role_alerts after insert or update of roles, status on public.conferences
  for each row execute function private.queue_role_alerts();

do $$
declare f text;
begin
  foreach f in array array[
    'apply_to_conference(uuid, text, text, text, text, text, text, jsonb, text)', 'withdraw_application(uuid)', 'set_application(uuid, text)',
    'allocate_applications(uuid, jsonb)', 'send_allocations(uuid)', 'send_broadcast(uuid, text, text, text)', 'claim_listing(uuid, text, text)',
    'admin_claims()', 'decide_claim(uuid, boolean)', 'my_conferences()', 'link_chamber(uuid, uuid, text)', 'chamber_link(uuid)', 'conference_wall(uuid)',
    'publish_awards(uuid)', 'set_role_alert(text[])']
  loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
-- The public record is read by anyone, signed in or not; it gives nothing unless its owner made it public.
revoke execute on function public.delegate_record(uuid) from public;
grant execute on function public.delegate_record(uuid) to anon, authenticated;

-- Once a day at 8 am Sydney summer time (9 pm UTC): queue the reminders, then ask the mailer to send what is waiting.
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.schedule('collex-reminders', '0 21 * * *', $job$
  select private.queue_reminders();
  select net.http_post(url := 'https://npdaczdwmhbtgitmplxc.supabase.co/functions/v1/mailer', headers := '{"Content-Type":"application/json"}'::jsonb, body := '{}'::jsonb);
$job$);
