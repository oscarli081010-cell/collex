-- Open Roles is switched off for now. Organisers can no longer post roles and the site no longer shows them, so the
-- database stops emailing about them too: role alerts no longer send, and the weekly digest no longer lists open roles.
-- The role_alerts table, the trigger and every conference's roles stay as they are, so this can be switched back on.

create or replace function private.queue_role_alerts() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  return new;
end $$;
revoke execute on function private.queue_role_alerts() from public, anon, authenticated;

create or replace function private.queue_digest(force boolean default false) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  here timestamp := now() at time zone 'Australia/Sydney';
  today date := (now() at time zone 'Australia/Sydney')::date;
  fresh text; soon text; body text; p record; n integer := 0;
begin
  -- The job runs at 20:00 and 21:00 UTC on Sundays; only the run that is 7am Monday in Sydney does anything.
  if not force and (extract(isodow from here) <> 1 or extract(hour from here) <> 7) then return 0; end if;
  insert into private.digest_weeks (week) values (today) on conflict (week) do nothing;
  if not found then return 0; end if;

  select string_agg(line, E'\n' order by pub_at desc) into fresh from (
    select '• ' || c.name || coalesce(' · ' || to_char(c.start_date, 'FMDD FMMon')
             || case when c.end_date > c.start_date then '–' || to_char(c.end_date, 'FMDD FMMon') else '' end, '') as line,
           c.published_at as pub_at
    from public.conferences c
    where c.status = 'published' and c.published_at > now() - interval '7 days'
    order by c.published_at desc limit 12) x;

  select string_agg(line, E'\n' order by d, line) into soon from (
    select '• ' || to_char(e.d, 'FMDy FMDD FMMon') || ': ' || e.name || ' – ' || e.what as line, e.d from (
      select c.name, k.label as what, k.d from public.conferences c,
        lateral (select left(x ->> 'label', 80) as label, private.as_date(x ->> 'date') as d from jsonb_array_elements(c.key_dates) x
                 where coalesce(x ->> 'label', '') <> '') k
        where c.status = 'published'
      union all select c.name, 'Delegate applications open', (c.delegation_opens_at at time zone 'Australia/Sydney')::date
        from public.conferences c where c.status = 'published' and c.delegation_opens_at is not null
      union all select c.name, 'Chair applications open', (c.chair_opens_at at time zone 'Australia/Sydney')::date
        from public.conferences c where c.status = 'published' and c.chair_opens_at is not null
      union all select c.name, 'The conference begins', c.start_date
        from public.conferences c where c.status = 'published' and c.start_date is not null
    ) e where e.d between today and today + 14
    order by e.d limit 20) y;

  if fresh is null and soon is null then return 0; end if;
  body := concat_ws(E'\n\n',
    case when fresh is not null then E'New on Collex this week\n' || fresh end,
    case when soon is not null then E'Coming up in the next two weeks\n' || soon end);

  for p in select pr.id, pr.digest_token from public.profiles pr join auth.users u on u.id = pr.id
           where pr.digest and pr.digest_token is not null and u.email is not null loop
    perform private.send_mail(p.id, 'This week in Sydney MUN', 'This week in Sydney MUN', body,
      'https://collex.au/conferences', 'See all conferences', 'You asked Collex for a weekly email about Sydney MUN.',
      'https://collex.au/unfollow?t=' || p.digest_token);
    n := n + 1;
  end loop;
  update private.digest_weeks set queued = n where week = today;
  return n;
end $$;
revoke execute on function private.queue_digest(boolean) from public, anon, authenticated;
