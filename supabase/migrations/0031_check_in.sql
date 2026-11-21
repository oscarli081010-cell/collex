-- Day-of check-in. Each application gets a check-in code that its owner shows as a QR code from their account page; one
-- of the conference's organisers scans it (or ticks the person off by hand in Manage) to mark them as arrived.
-- Reading: the code and the arrival time are read through the applications policy that already exists (the applicant
-- reads their own row, the conference's organisers read theirs). 0026 revoked everything on applications and then granted
-- select on the whole table, which covers columns added later, so no grant is needed here. There is no insert, update or
-- delete grant on applications, so these columns change only through the two functions below.

alter table public.applications
  add column checkin_token uuid not null default gen_random_uuid(),
  add column checked_in_at timestamptz,
  add column checked_in_by uuid references auth.users (id) on delete set null;
create unique index applications_checkin_token_idx on public.applications (checkin_token);

-- What scanning a code does. An unknown code gives null. Only someone who can edit the conference (or an admin) may check
-- people in; anyone else, including the delegate scanning their own code, is refused. A second scan changes nothing and
-- says so, keeping the time of the first.
create function public.check_in(token uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare a record; c record; me uuid := (select auth.uid()); stamp timestamptz; outcome text;
begin
  select x.id, x.conference_id, x.kind, x.role_title, x.name, x.school, x.committee, x.country, x.status, x.checked_in_at
  into a from public.applications x where x.checkin_token = token;
  if a.id is null then return null; end if;
  if not (private.can_edit(a.conference_id) or (select private.is_admin())) then
    raise exception 'Only the conference''s organisers can check people in' using errcode = '42501';
  end if;
  stamp := a.checked_in_at;
  if a.status <> 'accepted' then
    outcome := 'not_accepted';
  else
    -- One statement decides who was first, so two people scanning the same code at once can't both get 'ok'.
    update public.applications x set checked_in_at = now(), checked_in_by = me
    where x.id = a.id and x.checked_in_at is null and x.status = 'accepted'
    returning x.checked_in_at into stamp;
    if found then
      outcome := 'ok';
    else
      select x.checked_in_at into stamp from public.applications x where x.id = a.id;
      outcome := case when stamp is null then 'not_accepted' else 'already' end;
    end if;
  end if;
  select name, slug into c from public.conferences where id = a.conference_id;
  return jsonb_build_object('status', outcome, 'id', a.id, 'name', a.name, 'school', a.school, 'kind', a.kind, 'role_title', a.role_title,
    'committee', a.committee, 'country', a.country, 'conference_name', c.name, 'conference_slug', c.slug, 'checked_in_at', stamp);
end $$;

-- Ticking someone off by hand in Manage, or undoing a check-in. Ticking someone who is already in keeps the first time.
create function public.set_checked_in(app uuid, arrived boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare a record;
begin
  if arrived is null then raise exception 'Say whether they have arrived' using errcode = '22023'; end if;
  select x.id, x.conference_id, x.status into a from public.applications x where x.id = app;
  if a.id is null then raise exception 'That application no longer exists' using errcode = 'P0002'; end if;
  if not (private.can_edit(a.conference_id) or (select private.is_admin())) then
    raise exception 'Only the conference''s organisers can check people in' using errcode = '42501';
  end if;
  if a.status <> 'accepted' then raise exception 'Only accepted applications can be checked in' using errcode = '22023'; end if;
  update public.applications x
  set checked_in_at = case when arrived then now() end, checked_in_by = case when arrived then (select auth.uid()) end
  where x.id = app and (x.checked_in_at is null) = arrived;
end $$;

-- Signed-in people only, like the other functions; the checks above decide who may actually use them.
revoke execute on function public.check_in(uuid) from public, anon;
grant execute on function public.check_in(uuid) to authenticated;
revoke execute on function public.set_checked_in(uuid, boolean) from public, anon;
grant execute on function public.set_checked_in(uuid, boolean) to authenticated;
