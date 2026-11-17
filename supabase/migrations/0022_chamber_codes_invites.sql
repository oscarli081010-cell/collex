-- Two easier ways onto a shared committee.
-- 1. A join code: six letters and digits (no 0/O or 1/I), made by the owner, that any logged-in chair can type in to join.
--    The owner can make a new one (the old stops working) or turn it off. Every attempt counts towards a limit of
--    10 tries in 15 minutes per account, so codes can't be guessed.
-- 2. An email: when the owner adds someone by their account email, they are emailed a link to the committee. The email
--    is queued here and sent by the chamber-invite edge function, so only people really added are ever emailed.

alter table public.chambers add column join_code text unique check (join_code ~ '^[A-HJ-NP-Z2-9]{6}$');

create table private.chamber_mail (
  id bigint generated always as identity primary key,
  chamber_id uuid not null references public.chambers (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  inviter text not null,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index chamber_mail_unsent_idx on private.chamber_mail (id) where sent_at is null;
alter table private.chamber_mail enable row level security;

create table private.chamber_join_tries (
  user_id uuid not null references auth.users (id) on delete cascade,
  at timestamptz not null default now()
);
create index chamber_join_tries_idx on private.chamber_join_tries (user_id, at);
alter table private.chamber_join_tries enable row level security;

-- Adding someone now also queues their email.
create or replace function public.add_chamber_member(cid uuid, invitee_email text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  c record;
  who record;
  me text;
begin
  select id, owner_id into c from public.chambers where id = cid;
  if c.id is null or c.owner_id is distinct from (select auth.uid()) then
    raise exception 'Only the person who shared this committee can add people' using errcode = '42501';
  end if;
  select id, email, full_name into who from public.profiles where lower(email) = lower(trim(invitee_email));
  if who.id is null then
    raise exception 'Nobody has a Collex account with that email yet. Ask them to sign up first, or give them the join code.' using errcode = 'P0002';
  end if;
  if who.id = c.owner_id then raise exception 'You already run this committee' using errcode = '23505'; end if;
  if exists (select 1 from public.chamber_members where chamber_id = cid and user_id = who.id) then
    raise exception 'They''re already on this committee' using errcode = '23505';
  end if;
  if (select count(*) from public.chamber_members where chamber_id = cid) >= 10 then
    raise exception 'A committee can have up to 10 other people' using errcode = '54000';
  end if;
  insert into public.chamber_members (chamber_id, user_id) values (cid, who.id);
  select coalesce(nullif(full_name, ''), email, 'A chair') into me from public.profiles where id = (select auth.uid());
  insert into private.chamber_mail (chamber_id, user_id, inviter) values (cid, who.id, coalesce(me, 'A chair'));
  return coalesce(nullif(who.full_name, ''), who.email);
end $$;

-- The committee's join code. Anyone on it can see the code; only the owner makes a new one or turns it off.
-- action: 'get', 'new' or 'off'. Returns the code, or null when there is none.
create function public.chamber_code(cid uuid, action text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  c record;
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
  b bytea;
begin
  select id, owner_id, join_code into c from public.chambers where id = cid;
  if c.id is null or not private.in_chamber(cid) then
    raise exception 'That committee isn''t shared with you' using errcode = '42501';
  end if;
  if action = 'get' then return c.join_code; end if;
  if c.owner_id is distinct from (select auth.uid()) then
    raise exception 'Only the person who shared this committee can change its code' using errcode = '42501';
  end if;
  if action = 'off' then
    update public.chambers set join_code = null where id = cid;
    return null;
  end if;
  if action <> 'new' then raise exception 'Unknown action' using errcode = '22023'; end if;
  loop
    b := extensions.gen_random_bytes(6);
    code := '';
    for i in 0..5 loop
      code := code || substr(alphabet, (get_byte(b, i) % 32) + 1, 1);
    end loop;
    exit when not exists (select 1 from public.chambers where join_code = code);
  end loop;
  update public.chambers set join_code = code where id = cid;
  return code;
end $$;

-- Join a committee by its code. Returns the committee's id.
create function public.join_chamber(code text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  clean text := upper(regexp_replace(coalesce(code, ''), '[^A-Za-z0-9]', '', 'g'));
  c record;
begin
  if me is null then raise exception 'Log in to join a committee' using errcode = '42501'; end if;
  if (select count(*) from private.chamber_join_tries where user_id = me and at > now() - interval '15 minutes') >= 10 then
    raise exception 'Too many tries. Wait a few minutes and try again.' using errcode = '54000';
  end if;
  insert into private.chamber_join_tries (user_id) values (me);
  delete from private.chamber_join_tries where at < now() - interval '1 day';
  select id, owner_id into c from public.chambers where join_code = clean;
  -- No match returns null rather than raising, so the try above is kept and counts towards the limit.
  if c.id is null then return null; end if;
  if c.owner_id = me or exists (select 1 from public.chamber_members where chamber_id = c.id and user_id = me) then
    return c.id;
  end if;
  if (select count(*) from public.chamber_members where chamber_id = c.id) >= 10 then
    raise exception 'That committee is full: it can have up to 10 other people' using errcode = '54000';
  end if;
  insert into public.chamber_members (chamber_id, user_id) values (c.id, me);
  return c.id;
end $$;

revoke execute on function public.chamber_code(uuid, text) from public, anon;
revoke execute on function public.join_chamber(text) from public, anon;
grant execute on function public.chamber_code(uuid, text) to authenticated;
grant execute on function public.join_chamber(text) to authenticated;
