-- Site-wide announcements: a short line an admin puts at the top of the home page ("Follow us on Instagram").
-- One shows at a time. Anyone can read the one that's showing; only admins can post, switch or delete them, and
-- every change goes in the audit log. (public.announcements is taken: that's a conference's own notes.)

create table public.site_notices (
  id uuid primary key default gen_random_uuid(),
  body text not null check (char_length(btrim(body)) between 1 and 140),
  link_label text check (link_label is null or char_length(btrim(link_label)) between 1 and 30),
  -- A page on Collex ("/list") or a secure address elsewhere; nothing else, so no javascript: links.
  link_url text check (link_url is null or (char_length(link_url) <= 500 and link_url ~ '^(https://[^[:space:]<>"]+|/([^/[:space:]<>"][^[:space:]<>"]*)?)$')),
  audience text not null default 'everyone' check (audience in ('everyone', 'signed_in')),
  active boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  check ((link_url is null) = (link_label is null))
);
-- At most one showing.
create unique index site_notices_one_active on public.site_notices ((true)) where active;
create index site_notices_created on public.site_notices (created_at desc);

alter table public.site_notices enable row level security;
create policy "Anyone reads the notice that's showing" on public.site_notices
  for select to anon, authenticated using (active);
create policy "Admins read every notice" on public.site_notices
  for select to authenticated using ((select private.is_admin()));

-- Reads only, and only these columns; every write goes through the functions below.
revoke all on public.site_notices from public, anon, authenticated;
grant select (id, body, link_label, link_url, audience, active, created_at) on public.site_notices to anon, authenticated;

create function public.post_site_notice(note text, label text default null, url text default null, who text default 'everyone')
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  new_id uuid;
  b text := btrim(coalesce(note, ''));
  l text := nullif(btrim(coalesce(label, '')), '');
  u text := nullif(btrim(coalesce(url, '')), '');
begin
  if not (select private.is_admin()) then raise exception 'Only admins can post announcements' using errcode = '42501'; end if;
  if (l is null) <> (u is null) then raise exception 'A link needs both its words and its address' using errcode = '22023'; end if;
  update public.site_notices set active = false where active;
  insert into public.site_notices (body, link_label, link_url, audience, active, created_by)
  values (b, l, u, coalesce(who, 'everyone'), true, (select auth.uid()))
  returning id into new_id;
  perform private.log('posted an announcement', 'site_notice', new_id::text, '“' || left(b, 80) || '”', jsonb_build_object('audience', who, 'link', u));
  return new_id;
end $$;

create function public.set_site_notice(notice uuid, showing boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare b text;
begin
  if not (select private.is_admin()) then raise exception 'Only admins can change announcements' using errcode = '42501'; end if;
  select body into b from public.site_notices where id = notice;
  if b is null then raise exception 'That announcement no longer exists' using errcode = 'P0002'; end if;
  if showing then update public.site_notices set active = false where active and id <> notice; end if;
  update public.site_notices set active = showing where id = notice;
  perform private.log(case when showing then 'showed an announcement' else 'hid an announcement' end, 'site_notice', notice::text, '“' || left(b, 80) || '”', '{}');
end $$;

create function public.delete_site_notice(notice uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare b text;
begin
  if not (select private.is_admin()) then raise exception 'Only admins can delete announcements' using errcode = '42501'; end if;
  delete from public.site_notices where id = notice returning body into b;
  if b is null then raise exception 'That announcement no longer exists' using errcode = 'P0002'; end if;
  perform private.log('deleted an announcement', 'site_notice', notice::text, '“' || left(b, 80) || '”', '{}');
end $$;

revoke execute on function public.post_site_notice(text, text, text, text), public.set_site_notice(uuid, boolean), public.delete_site_notice(uuid) from public, anon;
grant execute on function public.post_site_notice(text, text, text, text), public.set_site_notice(uuid, boolean), public.delete_site_notice(uuid) to authenticated;

-- Browsers read "/\host" as "//host", another site; no backslashes at all.
alter table public.site_notices add constraint site_notices_link_no_backslash check (link_url is null or position(chr(92) in link_url) = 0);
