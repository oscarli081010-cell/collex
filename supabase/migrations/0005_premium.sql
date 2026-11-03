-- Verified badge, organisers editing their own listings, and following a conference by email.

-- Verified: the listing came from the conference's own secretariat. Only admins set it (see the guard below).
alter table public.conferences add column verified boolean not null default false;
grant update (verified, submitter_role) on public.conferences to authenticated;

-- Organisers may edit their own listing while it is in review or live. Edits stay live and are logged.
create policy "Submitters edit their own" on public.conferences
  for update to authenticated
  using (submitted_by = (select auth.uid()) and status in ('pending', 'published'))
  with check (submitted_by = (select auth.uid()) and status in ('pending', 'published'));

-- Review fields stay with admins: an organiser's edit may not touch status, notes or the badge.
create function private.guard_conference_update() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() and (
    new.status is distinct from old.status or new.review_note is distinct from old.review_note
    or new.verified is distinct from old.verified or new.submitted_by is distinct from old.submitted_by
  ) then
    raise exception 'Only admins can change a listing''s review status.' using errcode = '42501';
  end if;
  return new;
end $$;
revoke execute on function private.guard_conference_update() from public, anon, authenticated;
create trigger conferences_guard before update on public.conferences
  for each row execute function private.guard_conference_update();

-- Follows: a person asks to be emailed about one conference. The token makes each unsubscribe link unique.
create table public.follows (
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  conference_id uuid not null references public.conferences (id) on delete cascade,
  token uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now(),
  primary key (user_id, conference_id)
);
create index follows_conference on public.follows (conference_id);
alter table public.follows enable row level security;
create policy "Read own follows" on public.follows
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Follow a live conference" on public.follows
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.conferences c where c.id = conference_id and c.status = 'published'));
create policy "Unfollow own" on public.follows
  for delete to authenticated using (user_id = (select auth.uid()));
revoke all on public.follows from anon, authenticated;
grant select, delete on public.follows to authenticated;
grant insert (conference_id) on public.follows to authenticated;

-- Unsubscribe from an email link without logging in. The token is random, so it can't be guessed.
create function public.unfollow(t uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare cname text;
begin
  select c.name into cname from public.follows f join public.conferences c on c.id = f.conference_id where f.token = t;
  delete from public.follows where token = t;
  return cname;
end $$;
revoke execute on function public.unfollow(uuid) from public;
grant execute on function public.unfollow(uuid) to anon, authenticated;

-- Outbox: when a live listing gains application links or guides, queue one email per change.
-- The notify edge function sends them and stamps sent_at.
create table private.notifications (
  id bigint generated always as identity primary key,
  conference_id uuid not null references public.conferences (id) on delete cascade,
  kind text not null check (kind in ('delegation', 'chair', 'guides')),
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create function private.queue_notifications() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  old_guides int := (select count(*) from jsonb_array_elements(old.guides) g where g ->> 'url' is not null);
  new_guides int := (select count(*) from jsonb_array_elements(new.guides) g where g ->> 'url' is not null);
begin
  if new.status <> 'published' then return new; end if;
  if old.delegation_url is null and new.delegation_url is not null then
    insert into private.notifications (conference_id, kind) values (new.id, 'delegation');
  end if;
  if old.chair_url is null and new.chair_url is not null then
    insert into private.notifications (conference_id, kind) values (new.id, 'chair');
  end if;
  if new_guides > old_guides then
    insert into private.notifications (conference_id, kind) values (new.id, 'guides');
  end if;
  return new;
end $$;
revoke execute on function private.queue_notifications() from public, anon, authenticated;
create trigger conferences_notify after update on public.conferences
  for each row execute function private.queue_notifications();
