-- Admins can see every shared committee, rename it, fix its saved state or delete it; and the audit log now records
-- accounts being made and committees being started, shared, edited and deleted.

create policy "Admins read all chambers" on public.chambers
  for select to authenticated using ((select private.is_admin()));
create policy "Admins read all chamber members" on public.chamber_members
  for select to authenticated using ((select private.is_admin()));

-- Every shared committee with who runs it and a small summary of where it is up to.
create function public.admin_chambers()
returns table (id uuid, name text, owner_email text, owner_name text, members integer, version integer, created_at timestamptz, updated_at timestamptz, summary jsonb)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (select private.is_admin()) then raise exception 'Admins only' using errcode = '42501'; end if;
  return query
  select c.id, c.name, coalesce(p.email, ''), coalesce(p.full_name, ''),
         (select count(*) from public.chamber_members m where m.chamber_id = c.id)::integer,
         c.version, c.created_at, c.updated_at,
         jsonb_build_object(
           'rules', c.state ->> 'rules', 'step', c.state ->> 'step', 'topic', c.state ->> 'topic',
           'delegates', case when jsonb_typeof(c.state -> 'delegates') = 'array' then jsonb_array_length(c.state -> 'delegates') else 0 end,
           'level', c.state #>> '{tr,level}', 'week', c.state #>> '{tr,week}',
           'log', case when jsonb_typeof(c.state -> 'log') = 'array' then
                    (select coalesce(jsonb_agg(x.e order by x.i desc), '[]'::jsonb)
                       from (select t.e, t.i from jsonb_array_elements(c.state -> 'log') with ordinality as t(e, i) order by t.i desc limit 8) x)
                  else '[]'::jsonb end)
  from public.chambers c left join public.profiles p on p.id = c.owner_id
  order by c.updated_at desc;
end $$;

-- The whole saved committee, for the debug view.
create function public.admin_chamber_state(cid uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare s jsonb;
begin
  if not (select private.is_admin()) then raise exception 'Admins only' using errcode = '42501'; end if;
  select state into s from public.chambers where id = cid;
  return s;
end $$;

-- Rename a committee or change its topic; or, with `new_state`, replace what is saved (for putting a stuck committee right).
-- The version goes up, so every device following it picks the change up.
create function public.admin_edit_chamber(cid uuid, new_name text, new_topic text, new_state jsonb default null) returns void
language plpgsql security definer set search_path = '' as $$
declare c record; nm text; st jsonb;
begin
  if not (select private.is_admin()) then raise exception 'Admins only' using errcode = '42501'; end if;
  select id, name, state into c from public.chambers where id = cid for update;
  if c.id is null then raise exception 'That committee no longer exists' using errcode = 'P0002'; end if;
  st := coalesce(new_state, c.state);
  nm := left(trim(coalesce(new_name, st ->> 'name', c.name)), 80);
  if char_length(nm) < 2 then raise exception 'A committee needs a name' using errcode = '22023'; end if;
  st := jsonb_set(st, '{name}', to_jsonb(nm));
  if new_topic is not null then st := jsonb_set(st, '{topic}', to_jsonb(left(trim(new_topic), 160))); end if;
  update public.chambers set state = st, name = nm, version = version + 1, updated_at = now() where id = cid;
  perform private.log('edited', 'chamber', cid::text, nm, jsonb_build_object('raw', new_state is not null));
end $$;

-- Deleting is logged, whoever does it.
create or replace function public.delete_chamber(cid uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare nm text;
begin
  select name into nm from public.chambers where id = cid;
  delete from public.chambers where id = cid and (owner_id = (select auth.uid()) or (select private.is_admin()));
  if not found then raise exception 'Only the person who shared this committee can delete it' using errcode = '42501'; end if;
  perform private.log('deleted', 'chamber', cid::text, coalesce(nm, 'a committee'), '{}');
end $$;

-- Sharing a committee is logged. (create_chamber is replaced in full, with that one line added.)
create or replace function public.create_chamber(initial jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare new_id uuid; nm text;
begin
  if (select auth.uid()) is null then raise exception 'Log in to share a committee' using errcode = '42501'; end if;
  if (select count(*) from public.chambers where owner_id = (select auth.uid())) >= 20 then
    raise exception 'You can share up to 20 committees. Delete one you''ve finished with.' using errcode = '54000';
  end if;
  nm := left(trim(coalesce(initial ->> 'name', '')), 80);
  insert into public.chambers (owner_id, name, state) values ((select auth.uid()), nm, initial) returning id into new_id;
  perform private.log('shared a chamber', 'chamber', new_id::text, nm, '{}');
  return new_id;
end $$;

-- A signed-in chair starting a committee in their browser. Nothing is kept but the fact, the name and the procedure.
create function public.note_chamber_started(label text, procedure text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then return; end if;
  if (select count(*) from public.audit_log where actor = (select auth.uid()) and action = 'started a chamber' and at > now() - interval '1 hour') >= 20 then return; end if;
  perform private.log('started a chamber', 'chamber', '', left(trim(coalesce(label, '')), 80), jsonb_build_object('procedure', left(coalesce(procedure, ''), 30)));
end $$;

-- A new account.
create function private.audit_signup() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.audit_log (actor, actor_email, action, target_type, target_id, target_label, detail)
  values (new.id, coalesce(nullif(new.email, ''), 'Someone'), 'created an account', 'user', new.id::text, '', '{}');
  return new;
end $$;
create trigger profiles_audit_signup after insert on public.profiles for each row execute function private.audit_signup();

revoke execute on function public.admin_chambers() from public, anon;
revoke execute on function public.admin_chamber_state(uuid) from public, anon;
revoke execute on function public.admin_edit_chamber(uuid, text, text, jsonb) from public, anon;
revoke execute on function public.note_chamber_started(text, text) from public, anon;
revoke execute on function private.audit_signup() from public, anon, authenticated;
grant execute on function public.admin_chambers() to authenticated;
grant execute on function public.admin_chamber_state(uuid) to authenticated;
grant execute on function public.admin_edit_chamber(uuid, text, text, jsonb) to authenticated;
grant execute on function public.note_chamber_started(text, text) to authenticated;
