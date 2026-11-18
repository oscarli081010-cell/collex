-- Delegates on their own devices, as an option a chair turns on for a shared committee.
-- Most school conferences are device-free, so a committee starts with this off and nothing here is used.
--
-- With it on, the committee has a second code, for delegates. A delegate (logged in) types it, takes their state's seat
-- and from then on can follow the debate, ask for the floor, raise a point, propose a motion, hand in or sign an
-- amendment, vote, pass notes and share files. None of that changes the committee itself: a delegate's request waits
-- in the chairs' inbox and a chair accepts it, so the President's ruling stays final and only chairs write the state.
-- Chairs can read every note.
-- No table here has a grant: everything goes through the functions below.

alter table public.chambers
  add column devices boolean not null default false,
  add column delegate_code text unique check (delegate_code ~ '^[A-Z2-9]{6}$'),
  add column room jsonb not null default '{}'::jsonb check (jsonb_typeof(room) = 'object' and pg_column_size(room) <= 8192);

create table public.chamber_seats (
  chamber_id uuid not null references public.chambers (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  delegate_id text not null check (char_length(delegate_id) between 1 and 80),
  joined_at timestamptz not null default now(),
  primary key (chamber_id, user_id)
);
create index chamber_seats_user_idx on public.chamber_seats (user_id);

create table public.chamber_asks (
  id uuid primary key default gen_random_uuid(),
  chamber_id uuid not null references public.chambers (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  delegate_id text not null,
  kind text not null check (kind in ('floor', 'point', 'motion', 'amendment', 'sign')),
  body jsonb not null default '{}'::jsonb check (jsonb_typeof(body) = 'object' and pg_column_size(body) <= 4096),
  status text not null default 'open' check (status in ('open', 'done', 'dismissed', 'withdrawn')),
  created_at timestamptz not null default now()
);
create index chamber_asks_idx on public.chamber_asks (chamber_id, status, created_at);

create table public.chamber_votes (
  chamber_id uuid not null references public.chambers (id) on delete cascade,
  key text not null check (char_length(key) between 1 and 200),
  delegate_id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  ballot text not null check (char_length(ballot) between 1 and 20),
  at timestamptz not null default now(),
  primary key (chamber_id, key, delegate_id)
);

create table public.chamber_notes (
  id uuid primary key default gen_random_uuid(),
  chamber_id uuid not null references public.chambers (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  from_id text not null,   -- 'chair', or the state's id
  to_id text not null,     -- 'chair', 'all' (an announcement from the chairs), or a state's id
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);
create index chamber_notes_idx on public.chamber_notes (chamber_id, created_at);

create table public.chamber_files (
  id uuid primary key default gen_random_uuid(),
  chamber_id uuid not null references public.chambers (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  from_id text not null,
  name text not null check (char_length(name) between 1 and 120),
  path text not null unique check (char_length(path) <= 300),
  size integer not null check (size between 1 and 10485760),
  created_at timestamptz not null default now()
);
create index chamber_files_idx on public.chamber_files (chamber_id, created_at);

alter table public.chamber_seats enable row level security;
alter table public.chamber_asks enable row level security;
alter table public.chamber_votes enable row level security;
alter table public.chamber_notes enable row level security;
alter table public.chamber_files enable row level security;
revoke all on public.chamber_seats, public.chamber_asks, public.chamber_votes, public.chamber_notes, public.chamber_files from anon, authenticated;

-- The state whose seat the caller has taken, or null.
create function private.seat_of(cid uuid) returns text
language sql stable security definer set search_path = '' as $$
  select s.delegate_id from public.chamber_seats s join public.chambers c on c.id = s.chamber_id
  where s.chamber_id = cid and s.user_id = (select auth.uid()) and c.devices
$$;
-- A chair of the committee, or a delegate seated in it.
create function private.in_room(cid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.in_chamber(cid) or private.seat_of(cid) is not null
$$;
create function private.is_delegate(cid uuid, did text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.chambers c, jsonb_array_elements(c.state -> 'delegates') d where c.id = cid and d ->> 'id' = did)
$$;
create function private.new_code() returns text
language plpgsql security definer set search_path = '' as $$
declare alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; code text; b bytea;
begin
  loop
    b := extensions.gen_random_bytes(6);
    code := '';
    for i in 0..5 loop code := code || substr(alphabet, (get_byte(b, i) % 32) + 1, 1); end loop;
    exit when not exists (select 1 from public.chambers where join_code = code or delegate_code = code);
  end loop;
  return code;
end $$;
revoke execute on function private.seat_of(uuid), private.in_room(uuid), private.is_delegate(uuid, text), private.new_code() from public, anon;
grant execute on function private.seat_of(uuid), private.in_room(uuid) to authenticated;

-- Chairs: turn delegates' devices on or off, or make a new delegate code. 'get' reads it.
create function public.chamber_devices(cid uuid, action text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare c record;
begin
  select id, devices, delegate_code into c from public.chambers where id = cid;
  if c.id is null or not (private.in_chamber(cid) or (select private.is_admin())) then
    raise exception 'That committee isn''t shared with you' using errcode = '42501';
  end if;
  if action = 'get' then return jsonb_build_object('on', c.devices, 'code', c.delegate_code); end if;
  if not private.can_manage_chamber(cid) then
    raise exception 'Only the person who shared this committee can change this' using errcode = '42501';
  end if;
  if action = 'on' then
    update public.chambers set devices = true, delegate_code = coalesce(delegate_code, private.new_code()) where id = cid;
  elsif action = 'off' then
    update public.chambers set devices = false where id = cid;
  elsif action = 'new' then
    update public.chambers set delegate_code = private.new_code() where id = cid;
  else raise exception 'Unknown action' using errcode = '22023';
  end if;
  select devices, delegate_code into c from public.chambers where id = cid;
  return jsonb_build_object('on', c.devices, 'code', c.delegate_code);
end $$;

-- A delegate types the code: the committee's name and its states, with how many people already sit as each.
-- Counts as a try, like the chairs' code, so codes can't be guessed at speed. No match returns null.
create function public.room_peek(code text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  clean text := upper(regexp_replace(coalesce(code, ''), '[^A-Za-z0-9]', '', 'g'));
  c record;
begin
  if me is null then raise exception 'Log in to join a committee' using errcode = '42501'; end if;
  if (select count(*) from private.chamber_join_tries where user_id = me and at > now() - interval '15 minutes') >= 20 then
    raise exception 'Too many tries. Wait a few minutes and try again.' using errcode = '54000';
  end if;
  insert into private.chamber_join_tries (user_id) values (me);
  select id, name, state into c from public.chambers where delegate_code = clean and devices;
  if c.id is null then return null; end if;
  return jsonb_build_object('id', c.id, 'name', c.name, 'topic', coalesce(c.state ->> 'topic', ''),
    'mine', (select s.delegate_id from public.chamber_seats s where s.chamber_id = c.id and s.user_id = me),
    'delegates', (select coalesce(jsonb_agg(jsonb_build_object('id', d ->> 'id', 'name', d ->> 'name',
        'taken', (select count(*) from public.chamber_seats s where s.chamber_id = c.id and s.delegate_id = d ->> 'id' and s.user_id <> me)) order by d ->> 'name'), '[]'::jsonb)
      from jsonb_array_elements(c.state -> 'delegates') d));
end $$;

-- Take (or change to) a state's seat. Up to three people can share one state.
create function public.room_take_seat(code text, delegate text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  clean text := upper(regexp_replace(coalesce(code, ''), '[^A-Za-z0-9]', '', 'g'));
  cid uuid;
begin
  if me is null then raise exception 'Log in to join a committee' using errcode = '42501'; end if;
  select id into cid from public.chambers where delegate_code = clean and devices;
  if cid is null then raise exception 'No committee has that code. Check it with the chair.' using errcode = 'P0002'; end if;
  if not private.is_delegate(cid, delegate) then raise exception 'That state isn''t in this committee' using errcode = 'P0002'; end if;
  if (select count(*) from public.chamber_seats where chamber_id = cid and delegate_id = delegate and user_id <> me) >= 3 then
    raise exception 'Three people already sit as that state. Ask the chair if that isn''t right.' using errcode = '54000';
  end if;
  insert into public.chamber_seats (chamber_id, user_id, delegate_id) values (cid, me, delegate)
  on conflict (chamber_id, user_id) do update set delegate_id = excluded.delegate_id;
  return cid;
end $$;

-- A delegate leaves, or a chair takes someone's seat away.
create function public.room_unseat(cid uuid, target uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if target is distinct from (select auth.uid()) and not private.in_chamber(cid) then
    raise exception 'Only a chair can do that' using errcode = '42501';
  end if;
  delete from public.chamber_seats where chamber_id = cid and user_id = target;
end $$;

-- The committees the caller sits in as a delegate.
create function public.my_seats() returns table (id uuid, name text, topic text, delegate text, updated_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select c.id, c.name, coalesce(c.state ->> 'topic', ''),
         coalesce((select d ->> 'name' from jsonb_array_elements(c.state -> 'delegates') d where d ->> 'id' = s.delegate_id), ''), c.updated_at
  from public.chamber_seats s join public.chambers c on c.id = s.chamber_id
  where s.user_id = (select auth.uid()) and c.devices
  order by c.updated_at desc
$$;

-- What a delegate's device shows, in one call: the committee (without the chairs' marks, awards and undo history),
-- their seat, their requests, the notes they can see, the files, the papers and their votes.
create function public.room_sync(cid uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare c record; me uuid := (select auth.uid()); seat text := private.seat_of(cid);
begin
  select id, name, state, version, room, devices into c from public.chambers where id = cid;
  if c.id is null or seat is null or not c.devices then
    raise exception 'You don''t have a seat in this committee' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'state', c.state - 'hist' - 'scores' - 'awards', 'version', c.version, 'name', c.name, 'now', now(), 'seat', seat, 'room', c.room,
    'asks', (select coalesce(jsonb_agg(to_jsonb(a) order by a.created_at desc), '[]'::jsonb) from
      (select id, kind, body, status, created_at from public.chamber_asks where chamber_id = cid and user_id = me order by created_at desc limit 12) a),
    'notes', (select coalesce(jsonb_agg(to_jsonb(n) order by n.created_at), '[]'::jsonb) from
      (select id, from_id, to_id, body, created_at from public.chamber_notes
       where chamber_id = cid and (to_id = 'all' or to_id = seat or from_id = seat) order by created_at desc limit 80) n),
    'files', (select coalesce(jsonb_agg(to_jsonb(f) order by f.created_at desc), '[]'::jsonb) from
      (select id, from_id, name, path, size, created_at, user_id = me as mine from public.chamber_files where chamber_id = cid order by created_at desc limit 60) f),
    'votes', (select coalesce(jsonb_object_agg(v.key, v.ballot), '{}'::jsonb) from public.chamber_votes v where v.chamber_id = cid and v.delegate_id = seat and v.at > now() - interval '6 hours'));
end $$;

-- What the chairs' console adds when devices are on: who is seated, the inbox, every note, the files, papers and votes.
create function public.room_chair(cid uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare c record;
begin
  select id, devices, delegate_code, room into c from public.chambers where id = cid;
  if c.id is null or not private.in_chamber(cid) then
    raise exception 'That committee isn''t shared with you' using errcode = '42501';
  end if;
  return jsonb_build_object('on', c.devices, 'code', c.delegate_code, 'room', c.room,
    'seats', (select coalesce(jsonb_agg(jsonb_build_object('user_id', s.user_id, 'delegate_id', s.delegate_id, 'name', coalesce(nullif(p.full_name, ''), p.email, 'A delegate')) order by s.joined_at), '[]'::jsonb)
      from public.chamber_seats s left join public.profiles p on p.id = s.user_id where s.chamber_id = cid),
    'asks', (select coalesce(jsonb_agg(to_jsonb(a) order by a.created_at), '[]'::jsonb) from
      (select id, delegate_id, kind, body, status, created_at from public.chamber_asks where chamber_id = cid and status = 'open' order by created_at limit 80) a),
    'notes', (select coalesce(jsonb_agg(to_jsonb(n) order by n.created_at), '[]'::jsonb) from
      (select id, from_id, to_id, body, created_at from public.chamber_notes where chamber_id = cid order by created_at desc limit 150) n),
    'files', (select coalesce(jsonb_agg(to_jsonb(f) order by f.created_at desc), '[]'::jsonb) from
      (select id, from_id, name, path, size, created_at, true as mine from public.chamber_files where chamber_id = cid order by created_at desc limit 60) f),
    'votes', (select coalesce(jsonb_agg(jsonb_build_object('key', v.key, 'delegate_id', v.delegate_id, 'ballot', v.ballot)), '[]'::jsonb)
      from public.chamber_votes v where v.chamber_id = cid and v.at > now() - interval '6 hours'));
end $$;

-- A delegate's request to the chairs. At most 6 wait at once from one person.
create function public.room_ask(cid uuid, kind text, body jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare seat text := private.seat_of(cid); new_id uuid; me uuid := (select auth.uid());
begin
  if seat is null then raise exception 'You don''t have a seat in this committee' using errcode = '42501'; end if;
  if (select count(*) from public.chamber_asks where chamber_id = cid and user_id = me and status = 'open') >= 6 then
    raise exception 'You have six requests waiting. Wait for the chair, or withdraw one.' using errcode = '54000';
  end if;
  if kind = 'floor' and exists (select 1 from public.chamber_asks a where a.chamber_id = cid and a.delegate_id = seat and a.kind = 'floor' and a.status = 'open') then
    raise exception 'Your state has already asked for the floor' using errcode = '23505';
  end if;
  insert into public.chamber_asks (chamber_id, user_id, delegate_id, kind, body) values (cid, me, seat, kind, coalesce(body, '{}'::jsonb)) returning id into new_id;
  delete from public.chamber_asks where chamber_id = cid and status <> 'open' and created_at < now() - interval '2 days';
  return new_id;
end $$;

-- The delegate withdraws their own request; a chair marks one done or dismisses it.
create function public.room_ask_set(ask uuid, new_status text) returns void
language plpgsql security definer set search_path = '' as $$
declare a record;
begin
  select id, chamber_id, user_id, status into a from public.chamber_asks where id = ask;
  if a.id is null then return; end if;
  if new_status = 'withdrawn' and a.user_id = (select auth.uid()) then
    update public.chamber_asks set status = 'withdrawn' where id = ask and status = 'open';
  elsif new_status in ('done', 'dismissed') and private.in_chamber(a.chamber_id) then
    update public.chamber_asks set status = new_status where id = ask and status = 'open';
  else raise exception 'You can''t change that request' using errcode = '42501';
  end if;
end $$;

-- A delegate's vote on whatever is being voted on (`key` names it). An empty ballot takes the vote back.
create function public.room_vote(cid uuid, vote_key text, ballot text) returns void
language plpgsql security definer set search_path = '' as $$
declare seat text := private.seat_of(cid);
begin
  if seat is null then raise exception 'You don''t have a seat in this committee' using errcode = '42501'; end if;
  if coalesce(ballot, '') = '' then
    delete from public.chamber_votes where chamber_id = cid and key = vote_key and delegate_id = seat;
  else
    insert into public.chamber_votes (chamber_id, key, delegate_id, user_id, ballot) values (cid, vote_key, seat, (select auth.uid()), ballot)
    on conflict (chamber_id, key, delegate_id) do update set ballot = excluded.ballot, user_id = excluded.user_id, at = now();
  end if;
  delete from public.chamber_votes where chamber_id = cid and at < now() - interval '2 days';
end $$;
create function public.room_clear_votes(cid uuid, vote_key text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.in_chamber(cid) then raise exception 'Only a chair can do that' using errcode = '42501'; end if;
  delete from public.chamber_votes where chamber_id = cid and key = vote_key;
end $$;

-- A note. From a delegate it goes to the chairs or (if the chairs allow it) to another state; from a chair, to a state or to everyone.
create function public.room_note(cid uuid, to_whom text, body text) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := (select auth.uid()); seat text := private.seat_of(cid); chair boolean := private.in_chamber(cid); rule text; clean text := trim(coalesce(body, ''));
begin
  if not chair and seat is null then raise exception 'You don''t have a seat in this committee' using errcode = '42501'; end if;
  if char_length(clean) < 1 or char_length(clean) > 500 then raise exception 'A note is 1 to 500 characters' using errcode = '22023'; end if;
  if (select count(*) from public.chamber_notes where chamber_id = cid and user_id = me and created_at > now() - interval '5 minutes') >= 30 then
    raise exception 'That''s a lot of notes. Wait a few minutes.' using errcode = '54000';
  end if;
  -- A chair who has also taken a seat (to see what delegates see) writes to the chairs as that state.
  if chair and not (seat is not null and to_whom = 'chair') then
    if to_whom <> 'all' and not private.is_delegate(cid, to_whom) then raise exception 'Choose who the note is for' using errcode = '22023'; end if;
    insert into public.chamber_notes (chamber_id, user_id, from_id, to_id, body) values (cid, me, 'chair', to_whom, clean);
  else
    select coalesce(room ->> 'notes', 'on') into rule from public.chambers where id = cid;
    if rule = 'off' then raise exception 'The chairs have turned notes off' using errcode = '42501'; end if;
    if to_whom <> 'chair' then
      if rule = 'chair' then raise exception 'Notes go to the chairs only in this committee' using errcode = '42501'; end if;
      if to_whom = seat or not private.is_delegate(cid, to_whom) then raise exception 'Choose who the note is for' using errcode = '22023'; end if;
    end if;
    insert into public.chamber_notes (chamber_id, user_id, from_id, to_id, body) values (cid, me, seat, to_whom, clean);
  end if;
  delete from public.chamber_notes where chamber_id = cid and created_at < now() - interval '14 days';
end $$;

-- Chairs: the room's own settings (who may pass notes, the straw poll).
create function public.room_set(cid uuid, new_room jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.in_chamber(cid) then raise exception 'Only a chair can do that' using errcode = '42501'; end if;
  update public.chambers set room = coalesce(new_room, '{}'::jsonb) where id = cid;
end $$;

-- Files. The file itself goes to the private "chamber-files" bucket, in the committee's folder; this records it.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chamber-files', 'chamber-files', false, 10485760, array['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'text/plain',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']);
-- The folder's name is only read as a committee's id inside the CASE, and only when it looks like one, so these
-- policies can never raise an error for a file in another bucket.
create function private.as_uuid(t text) returns uuid
language sql immutable set search_path = '' as $$
  select case when t ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then t::uuid end
$$;
revoke execute on function private.as_uuid(text) from public, anon;
grant execute on function private.as_uuid(text) to authenticated;
create policy "People in a committee add its files" on storage.objects
  for insert to authenticated
  with check (case when bucket_id = 'chamber-files' then private.in_room(private.as_uuid((storage.foldername(name))[1])) and (storage.foldername(name))[2] = (select auth.uid())::text else false end);
create policy "People in a committee read its files" on storage.objects
  for select to authenticated
  using (case when bucket_id = 'chamber-files' then private.in_room(private.as_uuid((storage.foldername(name))[1])) else false end);
create policy "Chairs and uploaders delete a committee's files" on storage.objects
  for delete to authenticated
  using (case when bucket_id = 'chamber-files' then private.in_chamber(private.as_uuid((storage.foldername(name))[1])) or (storage.foldername(name))[2] = (select auth.uid())::text else false end);

create function public.room_file_add(cid uuid, file_name text, file_path text, file_size integer) returns uuid
language plpgsql security definer set search_path = '' as $$
declare me uuid := (select auth.uid()); seat text := private.seat_of(cid); chair boolean := private.in_chamber(cid); new_id uuid;
begin
  if not chair and seat is null then raise exception 'You don''t have a seat in this committee' using errcode = '42501'; end if;
  if file_path not like cid::text || '/' || me::text || '/%' then raise exception 'That file isn''t in this committee''s folder' using errcode = '22023'; end if;
  if (select count(*) from public.chamber_files where chamber_id = cid) >= 200 then raise exception 'This committee has 200 files. Remove one first.' using errcode = '54000'; end if;
  if not chair and (select count(*) from public.chamber_files where chamber_id = cid and user_id = me) >= 10 then raise exception 'You can share up to 10 files' using errcode = '54000'; end if;
  insert into public.chamber_files (chamber_id, user_id, from_id, name, path, size)
  values (cid, me, case when chair then 'chair' else seat end, left(trim(file_name), 120), file_path, file_size) returning id into new_id;
  return new_id;
end $$;
create function public.room_file_remove(file uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare f record;
begin
  select id, chamber_id, user_id, path into f from public.chamber_files where id = file;
  if f.id is null then return null; end if;
  if f.user_id is distinct from (select auth.uid()) and not private.in_chamber(f.chamber_id) then
    raise exception 'Only the chairs or whoever shared it can remove a file' using errcode = '42501';
  end if;
  delete from public.chamber_files where id = file;
  return f.path;
end $$;

-- The lists of committees now say Standard or Custom for a committee on the general rules.
create or replace function public.my_chambers()
returns table (id uuid, name text, is_owner boolean, owner_name text, updated_at timestamptz,
               role text, topic text, rules text, step text, delegates integer, members integer)
language sql stable security definer set search_path = '' as $$
  select c.id, c.name, c.owner_id = (select auth.uid()), coalesce(nullif(p.full_name, ''), p.email, 'A chair'), c.updated_at,
         case when c.owner_id = (select auth.uid()) then 'owner'
              else coalesce((select m.role from public.chamber_members m where m.chamber_id = c.id and m.user_id = (select auth.uid())), 'chair') end,
         coalesce(c.state ->> 'topic', ''), coalesce(c.state ->> 'style', c.state ->> 'rules', 'evatt'), coalesce(c.state ->> 'step', ''),
         case when jsonb_typeof(c.state -> 'delegates') = 'array' then jsonb_array_length(c.state -> 'delegates') else 0 end,
         (select count(*)::integer from public.chamber_members m where m.chamber_id = c.id)
  from public.chambers c left join public.profiles p on p.id = c.owner_id
  where private.in_chamber(c.id)
  order by c.updated_at desc
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'chamber_devices(uuid, text)', 'room_peek(text)', 'room_take_seat(text, text)', 'room_unseat(uuid, uuid)', 'my_seats()', 'room_sync(uuid)', 'room_chair(uuid)',
    'room_ask(uuid, text, jsonb)', 'room_ask_set(uuid, text)', 'room_vote(uuid, text, text)', 'room_clear_votes(uuid, text)', 'room_note(uuid, text, text)',
    'room_set(uuid, jsonb)', 'room_file_add(uuid, text, text, integer)', 'room_file_remove(uuid)']
  loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
