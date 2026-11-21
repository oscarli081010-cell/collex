-- 0041: delegates' seats are fixed once taken, and a committee can make each new seat wait for a chair's approval.
--  * A seat can no longer be changed or given up by the person in it: only a chair frees it (room_unseat).
--  * "Chairs Approve Seats" lives in the room settings as room->>'approveSeats' (off unless a chair turns it on).
--    With it on, a new seat is pending until a chair approves it (room_approve_seat) or declines it (room_unseat).
--  * A pending seat sees only that it is waiting: room_sync, votes, notes, requests and files all need an approved seat,
--    because they all go through private.seat_of. Pending seats still count toward the three people per state.
-- Safe to run twice.

alter table public.chamber_seats add column if not exists approved boolean not null default true;

-- The approved seat of the person calling, in a committee with devices on. When a chair turns approval off again, the
-- seats still waiting count as approved, so nobody is left stuck on the waiting screen.
create or replace function private.seat_of(cid uuid)
returns text language sql stable security definer set search_path = '' as $$
  select s.delegate_id from public.chamber_seats s join public.chambers c on c.id = s.chamber_id
  where s.chamber_id = cid and s.user_id = (select auth.uid()) and c.devices
    and (s.approved or coalesce(c.room ->> 'approveSeats', '') <> 'true')
$$;
revoke execute on function private.seat_of(uuid) from public, anon;
grant execute on function private.seat_of(uuid) to authenticated, service_role;

create or replace function public.room_take_seat(code text, delegate text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  clean text := upper(regexp_replace(coalesce(code, ''), '[^A-Za-z0-9]', '', 'g'));
  cid uuid;
  ask boolean;
  had text;
begin
  if me is null then raise exception 'Log in to join a committee' using errcode = '42501'; end if;
  if (select count(*) from private.chamber_join_tries where user_id = me and at > now() - interval '15 minutes') >= 20 then
    raise exception 'Too many tries. Wait a few minutes and try again.' using errcode = '54000';
  end if;
  insert into private.chamber_join_tries (user_id) values (me);
  select id, coalesce(room ->> 'approveSeats', '') = 'true' into cid, ask from public.chambers where delegate_code = clean and devices;
  if cid is null then return null; end if;
  if not private.is_delegate(cid, delegate) then raise exception 'That state isn''t in this committee' using errcode = 'P0002'; end if;
  select delegate_id into had from public.chamber_seats where chamber_id = cid and user_id = me;
  if had = delegate then return cid; end if; -- already sitting there (or waiting to): carry on
  if had is not null then
    raise exception 'You already have a seat in this committee. Ask the chair if it isn''t right.' using errcode = '23505';
  end if;
  if (select count(*) from public.chamber_seats where chamber_id = cid and delegate_id = delegate) >= 3 then
    raise exception 'Three people already sit as that state. Ask the chair if that isn''t right.' using errcode = '54000';
  end if;
  insert into public.chamber_seats (chamber_id, user_id, delegate_id, approved)
  values (cid, me, delegate, not ask or private.in_chamber(cid))
  on conflict (chamber_id, user_id) do nothing;
  return cid;
end $$;
revoke execute on function public.room_take_seat(text, text) from public, anon;
grant execute on function public.room_take_seat(text, text) to authenticated, service_role;

-- Only a chair frees a seat (and declining a seat request is the same thing).
create or replace function public.room_unseat(cid uuid, target uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.in_chamber(cid) then
    raise exception 'Only a chair can do that' using errcode = '42501';
  end if;
  delete from public.chamber_seats where chamber_id = cid and user_id = target;
end $$;
revoke execute on function public.room_unseat(uuid, uuid) from public, anon;
grant execute on function public.room_unseat(uuid, uuid) to authenticated, service_role;

create or replace function public.room_approve_seat(cid uuid, target uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.in_chamber(cid) then
    raise exception 'Only a chair can do that' using errcode = '42501';
  end if;
  update public.chamber_seats set approved = true where chamber_id = cid and user_id = target;
end $$;
revoke execute on function public.room_approve_seat(uuid, uuid) from public, anon;
grant execute on function public.room_approve_seat(uuid, uuid) to authenticated, service_role;

-- As before (with 0039's ceilings: seats 300, votes 2000), with each seat's `approved`.
create or replace function public.room_chair(cid uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare c record;
begin
  select id, devices, delegate_code, room into c from public.chambers where id = cid;
  if c.id is null or not private.in_chamber(cid) then
    raise exception 'That committee isn''t shared with you' using errcode = '42501';
  end if;
  return jsonb_build_object('on', c.devices, 'code', c.delegate_code, 'room', c.room,
    'seats', (select coalesce(jsonb_agg(jsonb_build_object('user_id', s.user_id, 'delegate_id', s.delegate_id,
        'approved', s.approved or coalesce(c.room ->> 'approveSeats', '') <> 'true',
        'name', coalesce(nullif(p.full_name, ''), p.email, 'A delegate')) order by s.joined_at), '[]'::jsonb)
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
grant execute on function public.room_chair(uuid) to authenticated, service_role;

-- As before; a seat still waiting for a chair gets only that it is waiting, with nothing of the committee.
create or replace function public.room_sync(cid uuid, known integer default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare c record; me uuid := (select auth.uid()); seat text := private.seat_of(cid); same boolean; waiting text;
begin
  select id, name, state, version, room, devices into c from public.chambers where id = cid;
  if c.id is not null and c.devices and seat is null then
    select s.delegate_id into waiting from public.chamber_seats s where s.chamber_id = cid and s.user_id = me and not s.approved;
    if waiting is not null then
      return jsonb_build_object('pending', true, 'name', c.name, 'seat', waiting, 'now', now(),
        'seat_name', (select d ->> 'name' from jsonb_array_elements(c.state -> 'delegates') d where d ->> 'id' = waiting limit 1));
    end if;
  end if;
  if c.id is null or seat is null or not c.devices then
    raise exception 'You don''t have a seat in this committee' using errcode = '42501';
  end if;
  same := known is not null and known = c.version;
  return case when same then jsonb_build_object('same', true) else jsonb_build_object('state', c.state - 'hist' - 'scores' - 'awards', 'name', c.name) end
    || jsonb_build_object(
    'version', c.version, 'now', now(), 'seat', seat, 'room', c.room,
    'asks', (select coalesce(jsonb_agg(to_jsonb(a) order by a.created_at desc), '[]'::jsonb) from
      (select id, kind, body, status, created_at from public.chamber_asks where chamber_id = cid and user_id = me order by created_at desc limit 12) a),
    'notes', (select coalesce(jsonb_agg(to_jsonb(n) order by n.created_at), '[]'::jsonb) from
      (select id, from_id, to_id, body, created_at from public.chamber_notes
       where chamber_id = cid and (to_id = 'all' or to_id = seat or from_id = seat) order by created_at desc limit 80) n),
    'files', (select coalesce(jsonb_agg(to_jsonb(f) order by f.created_at desc), '[]'::jsonb) from
      (select id, from_id, name, path, size, created_at, user_id = me as mine from public.chamber_files where chamber_id = cid order by created_at desc limit 60) f),
    'votes', (select coalesce(jsonb_object_agg(v.key, v.ballot), '{}'::jsonb) from public.chamber_votes v where v.chamber_id = cid and v.delegate_id = seat and v.at > now() - interval '6 hours'));
end $$;
revoke execute on function public.room_sync(uuid, integer) from public, anon;
grant execute on function public.room_sync(uuid, integer) to authenticated, service_role;
