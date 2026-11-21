-- Visitor counts and error reports, for the Admin page.
-- Nothing here identifies a person: no cookies, no IP addresses, no account ids. Both tables are only touched by the functions below.

-- ---------- Visitor counts: per day and page, how many views and how many first views in a browser tab ----------
create table private.page_hits (
  day date not null,
  path text not null,
  views integer not null default 0,
  visits integer not null default 0,
  primary key (day, path)
);
alter table private.page_hits enable row level security;
revoke all on private.page_hits from public, anon, authenticated;

-- One tidy form of an address: no query or hash, lower case, no trailing slash, at most 120 characters.
-- The error log uses it as it is (ids in addresses are already gone with the query); the counter then checks it against the site's real pages.
create function private.clean_path(page text) returns text
language sql immutable set search_path = '' as $$
  select coalesce(nullif(regexp_replace(left(lower(split_part(split_part(trim(coalesce(page, '')), '#', 1), '?', 1)), 120), '(.)/+$', '\1'), ''), '/')
$$;
revoke execute on function private.clean_path(text) from public, anon, authenticated;

-- The counter turns anything that is not one of the site's real pages into "/other", so a stranger cannot fill the table with made-up addresses.
create function private.known_path(p text) returns text
language sql immutable set search_path = '' as $$
  select case
    when p = '/' then p
    when p ~ '^/(calendar|conferences|past|roles|guides|about|chambers|list|listings|login|signup|account|activity|manage|organisers|checkin|privacy|terms|cookies|admin|unfollow)$' then p
    when p ~ '^/conferences/[a-z0-9-]{1,80}$' then p
    when p ~ '^/guides/[a-z0-9-]{1,80}$' then p
    when p ~ '^/chambers/(display|room)$' then p
    when p ~ '^/delegates(/|$)' then '/delegates'
    else '/other'
  end
$$;
revoke execute on function private.known_path(text) from public, anon, authenticated;

create function public.hit(page text, first boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  d date := (now() at time zone 'Australia/Sydney')::date;
  p text;
begin
  p := private.known_path(private.clean_path($1));
  -- A day never holds more than 500 different pages; past that, new ones count as "/other".
  if p <> '/other'
     and not exists (select 1 from private.page_hits h where h.day = d and h.path = p)
     and (select count(*) from private.page_hits h where h.day = d) >= 500 then
    p := '/other';
  end if;
  insert into private.page_hits as h (day, path, views, visits)
  values (d, p, 1, case when coalesce($2, false) then 1 else 0 end)
  on conflict (day, path) do update
    set views = h.views + 1, visits = h.visits + case when coalesce($2, false) then 1 else 0 end;
exception when others then
  -- A counter must never break a page.
  null;
end $$;
revoke execute on function public.hit(text, boolean) from public;
grant execute on function public.hit(text, boolean) to anon, authenticated;

-- Admin only: views and visits for each of the last N days (every day present, zero or not), and the 20 busiest pages over the same period.
create function public.admin_hits(days integer default 30) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  n integer := greatest(1, least(coalesce($1, 30), 365));
  sydney_day date := (now() at time zone 'Australia/Sydney')::date;
  series jsonb;
  best jsonb;
begin
  if not (select private.is_admin()) then raise exception 'Admins only' using errcode = '42501'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('day', to_char(g.d, 'YYYY-MM-DD'), 'views', coalesce(t.views, 0), 'visits', coalesce(t.visits, 0)) order by g.d), '[]'::jsonb)
    into series
    from (select sydney_day - i as d from generate_series(0, n - 1) as i) g
    left join (select h.day, sum(h.views)::integer as views, sum(h.visits)::integer as visits
                 from private.page_hits h where h.day >= sydney_day - (n - 1) group by h.day) t on t.day = g.d;
  select coalesce(jsonb_agg(jsonb_build_object('path', r.path, 'views', r.views, 'visits', r.visits) order by r.views desc, r.path), '[]'::jsonb)
    into best
    from (select h.path, sum(h.views)::integer as views, sum(h.visits)::integer as visits
            from private.page_hits h where h.day >= sydney_day - (n - 1)
            group by h.path order by sum(h.views) desc, h.path limit 20) r;
  return jsonb_build_object('days', series, 'pages', best);
end $$;
revoke execute on function public.admin_hits(integer) from public, anon;
grant execute on function public.admin_hits(integer) to authenticated;

-- ---------- Error reports: what broke, where, how often ----------
create table private.client_errors (
  id bigint generated always as identity primary key,
  day date not null,
  message text not null,
  path text not null,
  stack text not null default '',
  agent text not null default '',
  count integer not null default 1,
  first_at timestamptz not null default now(),
  last_at timestamptz not null default now(),
  constraint client_errors_dedupe unique (day, message, path)
);
alter table private.client_errors enable row level security;
revoke all on private.client_errors from public, anon, authenticated;
create index client_errors_last_at on private.client_errors (last_at desc);

-- Parameters are read as $1..$4 because they share names with the table's columns.
create function public.report_error(message text, stack text, page text, agent text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  m text := left(trim(coalesce($1, '')), 300);
  st text := left(trim(coalesce($2, '')), 2000);
  pg text := private.clean_path($3);
  ag text := left(trim(coalesce($4, '')), 200);
  d date := (now() at time zone 'Australia/Sydney')::date;
begin
  if m = '' then return; end if;
  -- A flood of different errors in one hour (a broken release, or someone poking at it) stops being recorded.
  if (select count(*) from private.client_errors e where e.first_at > now() - interval '1 hour') > 300 then return; end if;
  insert into private.client_errors as e (day, message, path, stack, agent)
  values (d, m, pg, st, ag)
  on conflict on constraint client_errors_dedupe do update
    set count = e.count + 1, last_at = now();
exception when others then
  -- Reporting a fault must never cause another one.
  null;
end $$;
revoke execute on function public.report_error(text, text, text, text) from public;
grant execute on function public.report_error(text, text, text, text) to anon, authenticated;

create function public.admin_errors() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (select private.is_admin()) then raise exception 'Admins only' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', r.id, 'day', r.day, 'message', r.message, 'path', r.path, 'stack', r.stack, 'agent', r.agent,
                                        'count', r.count, 'first_at', r.first_at, 'last_at', r.last_at) order by r.last_at desc)
    from (select * from private.client_errors order by last_at desc limit 200) r
  ), '[]'::jsonb);
end $$;
revoke execute on function public.admin_errors() from public, anon;
grant execute on function public.admin_errors() to authenticated;

create function public.admin_clear_errors() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not (select private.is_admin()) then raise exception 'Admins only' using errcode = '42501'; end if;
  delete from private.client_errors where true;
end $$;
revoke execute on function public.admin_clear_errors() from public, anon;
grant execute on function public.admin_clear_errors() to authenticated;
