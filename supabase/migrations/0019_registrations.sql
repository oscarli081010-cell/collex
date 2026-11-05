-- Registrations: a school signs a delegation up to a conference on Collex, and the organisers sort them (accept, waitlist,
-- decline) from the listing's Manage tab. Everyone who can see a listing can see its registrations; only people who can
-- edit it change their status. A person sees and can withdraw their own. Writes go through the functions below, so the
-- table itself has no insert, update or delete grants.
-- A listing takes registrations here only when its organisers switch it on (Manage tab). Off, nothing changes: the
-- Register button keeps going to their own form, or stays shut.
alter table public.conferences add column collex_registration boolean not null default false;
grant update (collex_registration) on public.conferences to authenticated;

create table public.registrations (
  id uuid primary key default gen_random_uuid(),
  conference_id uuid not null references public.conferences (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  school text not null check (char_length(school) between 2 and 120),
  contact_name text not null check (char_length(contact_name) between 2 and 100),
  contact_email text not null check (char_length(contact_email) <= 254 and contact_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  delegates integer not null check (delegates between 1 and 200),
  notes text check (char_length(notes) <= 1000),
  status text not null default 'new' check (status in ('new', 'accepted', 'waitlisted', 'declined')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (conference_id, user_id)
);
create index registrations_conference_idx on public.registrations (conference_id, status);

alter table public.registrations enable row level security;
revoke all on public.registrations from anon, authenticated;
grant select on public.registrations to authenticated;

create policy "People read their own registration and their listing's"
  on public.registrations for select to authenticated
  using (user_id = (select auth.uid()) or private.can_view(conference_id) or (select private.is_admin()));

-- Sign a delegation up. The listing has to be live and its registration opening time (if it has one) reached.
create function public.register_delegation(conf uuid, school_name text, person_name text, person_email text, delegate_count integer, note text default null)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  c record;
  new_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'Log in to register' using errcode = '42501'; end if;
  select id, name, status, collex_registration, delegation_opens_at, end_date into c from public.conferences where id = conf;
  if c.id is null or c.status <> 'published' then
    raise exception 'This conference isn''t taking registrations' using errcode = '42501';
  end if;
  if not c.collex_registration then
    raise exception 'This conference registers through its own form' using errcode = '42501';
  end if;
  if c.delegation_opens_at is not null and c.delegation_opens_at > now() then
    raise exception 'Registration hasn''t opened yet' using errcode = '42501';
  end if;
  if c.end_date is not null and c.end_date < (now() at time zone 'Australia/Sydney')::date then
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

-- An organiser who can edit the listing moves a registration between the four states.
create function public.set_registration_status(reg uuid, new_status text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  r record;
  cname text;
begin
  if new_status not in ('new', 'accepted', 'waitlisted', 'declined') then
    raise exception 'Pick accepted, waitlisted or declined' using errcode = '22023';
  end if;
  select id, conference_id, school, status into r from public.registrations where id = reg;
  if r.id is null or not (private.can_edit(r.conference_id) or private.is_admin()) then
    raise exception 'You can''t change this registration' using errcode = '42501';
  end if;
  if r.status = new_status then return; end if;
  update public.registrations set status = new_status, updated_at = now() where id = reg;
  select name into cname from public.conferences where id = r.conference_id;
  perform private.log('registration ' || new_status, 'conference', r.conference_id::text, cname, jsonb_build_object('school', r.school));
end $$;

-- The person who registered takes it back. This is also how a registration is deleted.
create function public.withdraw_registration(reg uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  r record;
  cname text;
begin
  select id, conference_id, school, user_id into r from public.registrations where id = reg;
  if r.id is null or r.user_id is distinct from (select auth.uid()) then
    raise exception 'You can''t withdraw this registration' using errcode = '42501';
  end if;
  delete from public.registrations where id = reg;
  select name into cname from public.conferences where id = r.conference_id;
  perform private.log('registration withdrawn', 'conference', r.conference_id::text, cname, jsonb_build_object('school', r.school));
end $$;

revoke execute on function public.register_delegation(uuid, text, text, text, integer, text) from public, anon;
revoke execute on function public.set_registration_status(uuid, text) from public, anon;
revoke execute on function public.withdraw_registration(uuid) from public, anon;
grant execute on function public.register_delegation(uuid, text, text, text, integer, text) to authenticated;
grant execute on function public.set_registration_status(uuid, text) to authenticated;
grant execute on function public.withdraw_registration(uuid) to authenticated;
