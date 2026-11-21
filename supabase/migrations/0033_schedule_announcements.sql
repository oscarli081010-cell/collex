-- Two additions to a conference's page.
--
-- 1. A day schedule: what happens when on the day (registration, opening ceremony, committee sessions, lunch). Stored on
--    the listing as a short list, like the key dates, so the same people edit it with the same limits, the edit shows in
--    the listing's activity, and it can be undone.
-- 2. Announcements: short notes the organisers post that everyone on the conference's page sees straight away. Read
--    through row level security; every write goes through a function.

-- 1. Schedule
-- Each item is { day, time, title, place }: day is a yyyy-mm-dd date or null (a one-day conference needs none), time is
-- "HH:MM" on a 24-hour clock or empty (an item can be on the schedule without a set time), title is 1 to 120 characters,
-- place is up to 120. At most 60 items, and no other keys, so the list can't carry anything the page doesn't show.
alter table public.conferences
  add column schedule jsonb not null default '[]'::jsonb,
  add constraint conferences_schedule_shape check (
    jsonb_typeof(schedule) = 'array' and jsonb_array_length(schedule) <= 60
    -- A backstop on size. Sixty full items of text in any language stay well under it.
    and pg_column_size(schedule) <= 80000
    and not jsonb_path_exists(schedule, '$[*] ? (@.type() != "object")')
    and not jsonb_path_exists(schedule, '$[*] ? (@.type() == "object").keyvalue() ? (!(@.key == "day" || @.key == "time" || @.key == "title" || @.key == "place"))')
    and not jsonb_path_exists(schedule, '$[*] ? (!(@.title.type() == "string" && @.title like_regex "^.{1,120}$"))')
    and not jsonb_path_exists(schedule, '$[*] ? (!(@.day == null || (@.day.type() == "string" && @.day like_regex "^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$")))')
    and not jsonb_path_exists(schedule, '$[*] ? (!(@.time.type() == "string" && @.time like_regex "^(([01][0-9]|2[0-3]):[0-5][0-9])?$"))')
    and not jsonb_path_exists(schedule, '$[*].place ? (!(@.type() == "string" && @ like_regex "^.{0,120}$"))')
  );

-- Organisers set it when a listing is first sent and when they edit it, exactly as they do the key dates. The guard
-- triggers only watch the review status, the badge and the photos, so they need nothing for this column.
grant insert (schedule), update (schedule) on public.conferences to authenticated;

-- The audit trigger and listing_history work on every column without naming them, so an edit to the schedule is
-- recorded (as "schedule") with no change there. Undo names the fields it may put back, so the schedule is added to
-- both lists. Each function is otherwise exactly as 0017 left it.
create or replace function private.undoable_fields() returns text[]
language sql immutable set search_path = '' as $$
  select array['name', 'short_name', 'host', 'start_date', 'end_date', 'venue', 'level', 'fee', 'delegates', 'overview', 'contact',
               'delegation_url', 'chair_url', 'interest_url', 'key_dates', 'committees', 'guides', 'secretariat', 'roles',
               'delegation_opens_at', 'chair_opens_at', 'schedule']
$$;

create or replace function public.undo_edit(entry bigint) returns void
language plpgsql security definer set search_path = '' as $$
declare
  a record;
  b jsonb;
  r public.conferences;
begin
  if not private.can_undo(entry) then
    raise exception 'That change can''t be undone any more' using errcode = '42501';
  end if;
  select target_id, detail into a from public.audit_log where id = entry;
  b := a.detail -> 'before';
  r := jsonb_populate_record(null::public.conferences, b);
  update public.conferences c set
    name = case when b ? 'name' then r.name else c.name end,
    short_name = case when b ? 'short_name' then r.short_name else c.short_name end,
    host = case when b ? 'host' then r.host else c.host end,
    start_date = case when b ? 'start_date' then r.start_date else c.start_date end,
    end_date = case when b ? 'end_date' then r.end_date else c.end_date end,
    venue = case when b ? 'venue' then r.venue else c.venue end,
    level = case when b ? 'level' then r.level else c.level end,
    fee = case when b ? 'fee' then r.fee else c.fee end,
    delegates = case when b ? 'delegates' then r.delegates else c.delegates end,
    overview = case when b ? 'overview' then r.overview else c.overview end,
    contact = case when b ? 'contact' then r.contact else c.contact end,
    delegation_url = case when b ? 'delegation_url' then r.delegation_url else c.delegation_url end,
    chair_url = case when b ? 'chair_url' then r.chair_url else c.chair_url end,
    interest_url = case when b ? 'interest_url' then r.interest_url else c.interest_url end,
    key_dates = case when b ? 'key_dates' then r.key_dates else c.key_dates end,
    committees = case when b ? 'committees' then r.committees else c.committees end,
    guides = case when b ? 'guides' then r.guides else c.guides end,
    secretariat = case when b ? 'secretariat' then r.secretariat else c.secretariat end,
    roles = case when b ? 'roles' then r.roles else c.roles end,
    delegation_opens_at = case when b ? 'delegation_opens_at' then r.delegation_opens_at else c.delegation_opens_at end,
    chair_opens_at = case when b ? 'chair_opens_at' then r.chair_opens_at else c.chair_opens_at end,
    schedule = case when b ? 'schedule' then r.schedule else c.schedule end
  where c.id = a.target_id::uuid;
end $$;

-- 2. Announcements
create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  conference_id uuid not null references public.conferences (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);
create index announcements_conference_idx on public.announcements (conference_id, created_at desc);
alter table public.announcements enable row level security;
revoke all on public.announcements from anon, authenticated;
-- Everything but who posted it, as with a conference's awards: an account's id is never shown to the public.
grant select (id, conference_id, body, created_at) on public.announcements to anon, authenticated;

-- Two rules, because anon can't call the private permission helpers: a rule that applied to anon and called them would
-- make every signed-out read fail.
create policy "Anyone reads the announcements of a live conference" on public.announcements for select to anon, authenticated
  using (exists (select 1 from public.conferences c where c.id = conference_id and c.status = 'published'));
create policy "The team reads its conference's announcements" on public.announcements for select to authenticated
  using (private.can_view(conference_id) or (select private.is_admin()));

-- Post one. Only the people who can edit the conference (or an admin), while it is in review or live, like every other
-- change to a listing. At most 20 a day per conference, so a page can't be flooded.
create function public.post_announcement(conf uuid, note text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  c record;
  -- trim() only strips spaces, so a note of nothing but line breaks would otherwise count as written.
  txt text := btrim(coalesce(note, ''), E' \t\r\n');
  new_id uuid;
begin
  if not (private.can_edit(conf) or (select private.is_admin())) then
    raise exception 'You can''t post announcements for this conference' using errcode = '42501';
  end if;
  select id, status into c from public.conferences where id = conf;
  if c.id is null then raise exception 'That conference no longer exists' using errcode = 'P0002'; end if;
  if c.status not in ('pending', 'published') and not (select private.is_admin()) then
    raise exception 'This listing can''t be edited right now' using errcode = '42501';
  end if;
  if char_length(txt) < 1 or char_length(txt) > 500 then
    raise exception 'Write an announcement of 1 to 500 characters' using errcode = '22023';
  end if;
  if (select count(*) from public.announcements where conference_id = conf and created_at > now() - interval '1 day') >= 20 then
    raise exception 'A conference can post 20 announcements a day. Try again tomorrow.' using errcode = '54000';
  end if;
  insert into public.announcements (conference_id, body, created_by) values (conf, txt, (select auth.uid()))
  returning id into new_id;
  return new_id;
end $$;

-- Take one down. Allowed whatever the listing's status, so an old note can always be cleared.
create function public.delete_announcement(ann uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare conf uuid;
begin
  select conference_id into conf from public.announcements where id = ann;
  if conf is null then raise exception 'That announcement no longer exists' using errcode = 'P0002'; end if;
  if not (private.can_edit(conf) or (select private.is_admin())) then
    raise exception 'You can''t delete announcements for this conference' using errcode = '42501';
  end if;
  delete from public.announcements where id = ann;
end $$;

-- Signed-in people only, like the other functions; the checks above decide who may actually use them.
revoke execute on function public.post_announcement(uuid, text) from public, anon;
grant execute on function public.post_announcement(uuid, text) to authenticated;
revoke execute on function public.delete_announcement(uuid) from public, anon;
grant execute on function public.delete_announcement(uuid) to authenticated;
