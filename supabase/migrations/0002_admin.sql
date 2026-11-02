-- Admins, conference listings with review, and an audit log written by triggers.

create schema if not exists private;
grant usage on schema private to authenticated;

-- Accounts whose email is listed here become admins when they sign up.
create table private.admin_emails (email text primary key);
insert into private.admin_emails (email) values ('oscar.li081010@gmail.com');

alter table public.profiles add column email text not null default '';
alter table public.profiles add column is_admin boolean not null default false;
update public.profiles p set email = u.email from auth.users u where u.id = p.id;
update public.profiles set is_admin = true where email in (select email from private.admin_emails);

-- Users may edit only these columns of their own profile (not is_admin or email).
revoke update on public.profiles from authenticated, anon;
grant update (full_name, school, role) on public.profiles to authenticated;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, full_name, school, role, is_admin)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'school', ''),
    case when new.raw_user_meta_data ->> 'role' in ('Delegate', 'Chair', 'Secretariat')
      then new.raw_user_meta_data ->> 'role' else 'Delegate' end,
    exists (select 1 from private.admin_emails a where lower(a.email) = lower(new.email))
  );
  return new;
end $$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

create function private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select is_admin from public.profiles where id = (select auth.uid())), false)
$$;
revoke execute on function private.is_admin() from public, anon;
grant execute on function private.is_admin() to authenticated;

create policy "Admins read all profiles" on public.profiles
  for select to authenticated using ((select private.is_admin()));

-- Conferences: submitted as pending, published by an admin.
create table public.conferences (
  id uuid primary key default gen_random_uuid(),
  slug text unique,
  status text not null default 'pending' check (status in ('pending', 'published', 'rejected', 'unpublished')),
  name text not null check (length(trim(name)) > 0),
  short_name text not null default '',
  host text not null check (length(trim(host)) > 0),
  start_date date,
  end_date date check (end_date is null or start_date is null or end_date >= start_date),
  venue text not null default '',
  level text check (level in ('High school', 'University', 'Open')),
  fee text not null default '',
  delegates text not null default '',
  overview text not null default '',
  contact text not null default '',
  delegation_url text,
  chair_url text,
  key_dates jsonb not null default '[]',
  committees jsonb not null default '[]',
  guides jsonb not null default '[]',
  secretariat jsonb not null default '[]',
  submitter_role text not null default '',
  submitted_by uuid references auth.users (id) on delete set null default auth.uid(),
  review_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);
create index conferences_status_start on public.conferences (status, start_date);
create index conferences_submitted_by on public.conferences (submitted_by);

alter table public.conferences enable row level security;

create policy "Anyone reads published conferences" on public.conferences
  for select to anon, authenticated using (status = 'published');
create policy "Submitters read their own" on public.conferences
  for select to authenticated using (submitted_by = (select auth.uid()));
create policy "Admins read all" on public.conferences
  for select to authenticated using ((select private.is_admin()));
create policy "Signed-in users submit for review" on public.conferences
  for insert to authenticated with check (status = 'pending' and submitted_by = (select auth.uid()));
create policy "Admins update" on public.conferences
  for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Admins delete" on public.conferences
  for delete to authenticated using ((select private.is_admin()));

-- Slug from the name, made unique; publish time stamped on first publish.
create function private.conference_defaults() returns trigger
language plpgsql security definer set search_path = '' as $$
declare base text; candidate text; n int := 1;
begin
  if new.slug is null or new.slug = '' then
    base := trim(both '-' from regexp_replace(lower(new.name), '[^a-z0-9]+', '-', 'g'));
    if base = '' then base := 'conference'; end if;
    candidate := base;
    while exists (select 1 from public.conferences where slug = candidate and id <> new.id) loop
      n := n + 1; candidate := base || '-' || n;
    end loop;
    new.slug := candidate;
  end if;
  if new.status = 'published' and new.published_at is null then new.published_at := now(); end if;
  new.updated_at := now();
  return new;
end $$;
create trigger conferences_defaults before insert or update on public.conferences
  for each row execute function private.conference_defaults();

-- Audit log: written only by triggers, read only by admins.
create table public.audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor uuid,
  actor_email text not null default '',
  action text not null,
  target_type text not null,
  target_id text not null,
  target_label text not null default '',
  detail jsonb not null default '{}'
);
create index audit_log_at on public.audit_log (at desc);
alter table public.audit_log enable row level security;
create policy "Admins read the audit log" on public.audit_log
  for select to authenticated using ((select private.is_admin()));

create function private.log(action text, target_type text, target_id text, target_label text, detail jsonb)
returns void language sql security definer set search_path = '' as $$
  insert into public.audit_log (actor, actor_email, action, target_type, target_id, target_label, detail)
  values ((select auth.uid()), coalesce((select email from public.profiles where id = (select auth.uid())), 'system'),
          action, target_type, target_id, target_label, detail)
$$;

create function private.audit_conferences() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    perform private.log('submitted', 'conference', new.id::text, new.name, jsonb_build_object('status', new.status));
  elsif tg_op = 'DELETE' then
    perform private.log('deleted', 'conference', old.id::text, old.name, '{}');
    return old;
  elsif new.status is distinct from old.status then
    perform private.log(
      case new.status when 'published' then 'approved' when 'rejected' then 'rejected'
                      when 'unpublished' then 'unpublished' else 'reopened' end,
      'conference', new.id::text, new.name,
      jsonb_build_object('from', old.status, 'to', new.status, 'note', new.review_note));
  else
    perform private.log('edited', 'conference', new.id::text, new.name, '{}');
  end if;
  return new;
end $$;
create trigger conferences_audit after insert or update or delete on public.conferences
  for each row execute function private.audit_conferences();

create function private.audit_profiles() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.is_admin is distinct from old.is_admin then
    perform private.log(case when new.is_admin then 'made admin' else 'removed admin' end,
                        'user', new.id::text, new.email, '{}');
  end if;
  return new;
end $$;
create trigger profiles_audit after update on public.profiles
  for each row execute function private.audit_profiles();

-- Admins grant or remove admin through this, so the column stays locked for everyone else.
create function public.set_admin(target uuid, make_admin boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() then raise exception 'Only admins can do this'; end if;
  if target = auth.uid() and not make_admin then raise exception 'You cannot remove your own admin access'; end if;
  update public.profiles set is_admin = make_admin where id = target;
end $$;
revoke execute on function public.set_admin(uuid, boolean) from public, anon;
grant execute on function public.set_admin(uuid, boolean) to authenticated;

-- Internal helpers: only the triggers use these.
revoke execute on function private.log(text, text, text, text, jsonb) from public, anon, authenticated;
revoke execute on function private.audit_conferences() from public, anon, authenticated;
revoke execute on function private.audit_profiles() from public, anon, authenticated;
revoke execute on function private.conference_defaults() from public, anon, authenticated;
