-- 0042: chairs can release their marks to delegates, privately, and joined seats only list approved ones.
--  * A chair of a committee linked to a conference releases the marks (release_marks). What each state has at that
--    moment is copied into public.chamber_feedback, so later changes stay with the chairs until they release again.
--  * Each delegate sees only their own mark and note (my_feedback), on their account page. Nobody else does.
--    A person is matched to a state by an accepted delegate application to that conference whose committee and country
--    match (ignoring case and spaces at the ends) when no other committee of that conference has the same name, or by
--    an approved seat for that state in the committee when it is the only seat for that state. A withdrawn delegate
--    application to the conference gets nothing.
--  * The chairs can take the marks back (withdraw_marks), which removes the copies.
--  * my_seats no longer lists a seat still waiting for a chair to approve it (0041 added chamber_seats.approved).
-- Safe to run twice. Needs 0041 first.

create table if not exists public.chamber_feedback (
  id uuid primary key default gen_random_uuid(),
  chamber_id uuid not null references public.chambers (id) on delete cascade,
  conference_id uuid not null references public.conferences (id) on delete cascade,
  committee_name text not null default '' check (char_length(committee_name) <= 120),
  state_id text not null check (char_length(state_id) <= 100),
  state_name text not null check (char_length(state_name) <= 80),
  mark numeric(3, 1) check (mark is null or (mark >= 0 and mark <= 10)),
  note text not null default '' check (char_length(note) <= 400),
  released_at timestamptz not null default now(),
  released_by uuid references auth.users (id) on delete set null,
  unique (chamber_id, state_id)
);
create index if not exists chamber_feedback_conference_idx on public.chamber_feedback (conference_id);

-- Delegates never read the table itself: only my_feedback(), which gives each person their own rows.
-- The chairs of the committee can read what they released and delete it.
alter table public.chamber_feedback enable row level security;
revoke all on public.chamber_feedback from public, anon, authenticated;
grant select, delete on public.chamber_feedback to authenticated;
drop policy if exists "Chairs read their committee's released marks" on public.chamber_feedback;
create policy "Chairs read their committee's released marks" on public.chamber_feedback for select to authenticated
  using ((select private.in_chamber(chamber_id)));
drop policy if exists "Chairs delete their committee's released marks" on public.chamber_feedback;
create policy "Chairs delete their committee's released marks" on public.chamber_feedback for delete to authenticated
  using ((select private.in_chamber(chamber_id)));

-- Release the chairs' marks as they stand now, replacing anything released before. Each state's mark is the average of
-- its four marks out of 10 (one decimal place), or none when all four are 0; a state with no marks and no note is left out.
-- Returns how many states were released.
create or replace function public.release_marks(cid uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare c record; n integer;
begin
  if not private.in_chamber(cid) then
    raise exception 'Only a chair of this committee can do that' using errcode = '42501';
  end if;
  select id, conference_id, committee, state into c from public.chambers where id = cid;
  if c.conference_id is null then
    raise exception 'Link this committee to a conference first' using errcode = 'P0001';
  end if;
  delete from public.chamber_feedback where chamber_id = cid;
  insert into public.chamber_feedback (chamber_id, conference_id, committee_name, state_id, state_name, mark, note, released_by)
  select cid, c.conference_id, left(coalesce(c.committee, ''), 120), left(d ->> 'id', 100), left(d ->> 'name', 80),
    case when x.total > 0 then round(x.total / 4.0, 1) end,
    left(coalesce(sc ->> 'note', ''), 400), (select auth.uid())
  from jsonb_array_elements(coalesce(c.state -> 'delegates', '[]'::jsonb)) d
  cross join lateral (select c.state -> 'scores' -> (d ->> 'id') as sc) s
  cross join lateral (select least(40, greatest(0,
      coalesce((sc ->> 'speaking')::numeric, 0) + coalesce((sc ->> 'diplomacy')::numeric, 0)
    + coalesce((sc ->> 'knowledge')::numeric, 0) + coalesce((sc ->> 'procedure')::numeric, 0))) as total) x
  where jsonb_typeof(sc) = 'object' and coalesce(d ->> 'id', '') <> '' and coalesce(d ->> 'name', '') <> ''
    and (x.total > 0 or btrim(coalesce(sc ->> 'note', '')) <> '');
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.release_marks(uuid) from public, anon;
grant execute on function public.release_marks(uuid) to authenticated, service_role;

-- Take the released marks back: delegates no longer see them.
create or replace function public.withdraw_marks(cid uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.in_chamber(cid) then
    raise exception 'Only a chair of this committee can do that' using errcode = '42501';
  end if;
  delete from public.chamber_feedback where chamber_id = cid;
end $$;
revoke execute on function public.withdraw_marks(uuid) from public, anon;
grant execute on function public.withdraw_marks(uuid) to authenticated, service_role;

-- For the chairs: when the marks were last released (null if they aren't out), and to how many states.
create or replace function public.marks_released(cid uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.in_chamber(cid) then
    raise exception 'That committee isn''t shared with you' using errcode = '42501';
  end if;
  return (select jsonb_build_object('released_at', max(released_at), 'states', count(*)) from public.chamber_feedback where chamber_id = cid);
end $$;
revoke execute on function public.marks_released(uuid) from public, anon;
grant execute on function public.marks_released(uuid) to authenticated, service_role;

-- For a delegate: the marks and notes released to them, newest first. Only their own.
create or replace function public.my_feedback()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('conference', r.conference, 'slug', r.slug, 'committee', r.committee, 'state', r.state,
    'mark', r.mark, 'note', r.note, 'released_at', r.released_at) order by r.released_at desc), '[]'::jsonb)
  from (
    select distinct f.id, cf.name as conference, cf.slug, f.committee_name as committee, f.state_name as state, f.mark, f.note, f.released_at
    from public.chamber_feedback f
    join public.conferences cf on cf.id = f.conference_id
    where (select auth.uid()) is not null and (
      (exists (select 1 from public.applications a
        where a.conference_id = f.conference_id and a.user_id = (select auth.uid()) and a.kind = 'delegate' and a.status = 'accepted'
          and lower(btrim(a.committee)) = lower(btrim(f.committee_name)) and btrim(a.committee) <> ''
          and lower(btrim(a.country)) = lower(btrim(f.state_name)) and btrim(a.country) <> '')
        -- Only when no other committee of the conference has the same name: otherwise "France in Security Council"
        -- could be either room's France, and a mark must never reach the wrong person.
        and not exists (select 1 from public.chambers o where o.conference_id = f.conference_id and o.id <> f.chamber_id
          and lower(btrim(coalesce(o.committee, ''))) = lower(btrim(f.committee_name))))
      or (exists (select 1 from public.chamber_seats s join public.chambers c on c.id = s.chamber_id
        where s.chamber_id = f.chamber_id and s.user_id = (select auth.uid()) and s.delegate_id = f.state_id
          and (s.approved or coalesce(c.room ->> 'approveSeats', '') <> 'true'))
        -- Anyone with the room code can sit as a state, so a seat alone is enough only when it is the one seat for that
        -- state; a shared state reaches its delegates through their accepted applications instead.
        and (select count(*) from public.chamber_seats s2 where s2.chamber_id = f.chamber_id and s2.delegate_id = f.state_id) = 1
        -- Someone who withdrew their application to this conference gets nothing, even if they kept a seat.
        and not exists (select 1 from public.applications w where w.conference_id = f.conference_id
          and w.user_id = (select auth.uid()) and w.kind = 'delegate' and w.status = 'withdrawn')))
  ) r
$$;
revoke execute on function public.my_feedback() from public, anon;
grant execute on function public.my_feedback() to authenticated, service_role;

-- As before, without seats still waiting for a chair to approve them. As in 0041, when the chairs turn approval off
-- again, a seat still waiting counts as approved.
create or replace function public.my_seats() returns table (id uuid, name text, topic text, delegate text, updated_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select c.id, c.name, coalesce(c.state ->> 'topic', ''),
         coalesce((select d ->> 'name' from jsonb_array_elements(c.state -> 'delegates') d where d ->> 'id' = s.delegate_id), ''), c.updated_at
  from public.chamber_seats s join public.chambers c on c.id = s.chamber_id
  where s.user_id = (select auth.uid()) and c.devices and (s.approved or coalesce(c.room ->> 'approveSeats', '') <> 'true')
  order by c.updated_at desc
$$;
revoke execute on function public.my_seats() from public, anon;
grant execute on function public.my_seats() to authenticated, service_role;
