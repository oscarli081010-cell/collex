-- Polling without downloading the whole committee every few seconds. The chairs' console asks open_chamber every 3
-- seconds and every delegate's device asks room_sync every 2.5 seconds, and both used to send back the whole committee
-- each time. Each now takes the version the caller already has (`known`). When it is still the current one, the answer
-- leaves the committee out and says `same: true`; everything that can change without the version moving is still sent.
--
-- The committee (state, and the name saved with it) only changes through save_chamber and the admin restore, and both
-- move the version. What can change without it, and so is always sent:
--   open_chamber: whether the caller owns it, their role and whether they manage it (people added or removed).
--   room_sync:    the seat, the room settings, the requests, notes, files and votes, and the devices being on at all.
-- The permission checks run first, exactly as before, so a caller who lost access still gets 42501.
--
-- `known` has a default, so the site already deployed, which calls these with `cid` only, keeps getting the full answer.
-- Each is dropped and created again rather than replaced: `create or replace` with a new argument list would add a
-- second function beside the old one, and PostgREST would then refuse a call with `cid` alone as ambiguous.
-- A migration runs as one transaction, so there is no moment when either function is missing.

drop function if exists public.open_chamber(uuid);
create function public.open_chamber(cid uuid, known integer default null)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare c record; r text;
begin
  select id, owner_id, name, state, version into c from public.chambers where id = cid;
  if c.id is null or not private.in_chamber(cid) then
    raise exception 'That committee isn''t shared with you' using errcode = '42501';
  end if;
  r := case when c.owner_id = (select auth.uid()) then 'owner'
            else coalesce((select role from public.chamber_members where chamber_id = cid and user_id = (select auth.uid())), 'chair') end;
  if known is not null and known = c.version then
    return jsonb_build_object('same', true, 'version', c.version, 'name', c.name,
                              'owner', c.owner_id = (select auth.uid()), 'role', r, 'manage', private.can_manage_chamber(cid), 'now', now());
  end if;
  return jsonb_build_object('state', c.state, 'version', c.version, 'name', c.name,
                            'owner', c.owner_id = (select auth.uid()), 'role', r, 'manage', private.can_manage_chamber(cid), 'now', now());
end $$;

drop function if exists public.room_sync(uuid);
create function public.room_sync(cid uuid, known integer default null)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare c record; me uuid := (select auth.uid()); seat text := private.seat_of(cid); same boolean;
begin
  select id, name, state, version, room, devices into c from public.chambers where id = cid;
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

-- A new function can be run by anyone until told otherwise: the same grants as the ones it replaces.
revoke execute on function public.open_chamber(uuid, integer) from public, anon;
revoke execute on function public.room_sync(uuid, integer) from public, anon;
grant execute on function public.open_chamber(uuid, integer) to authenticated;
grant execute on function public.room_sync(uuid, integer) to authenticated;

-- PostgREST reads the new argument lists now rather than on its next reload.
notify pgrst, 'reload schema';
