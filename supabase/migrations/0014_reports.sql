-- "Report a problem": anyone can tell the Collex team that a live listing has wrong details, a broken link or
-- something that shouldn't be there. Reports go through one function (nobody writes the table directly), with a limit
-- per listing and overall so it can't be used to flood the inbox. Only admins can read or resolve them.

create table public.reports (
  id bigint generated always as identity primary key,
  conference_id uuid not null references public.conferences (id) on delete cascade,
  reason text not null check (reason in ('details', 'link', 'inappropriate', 'other')),
  note text not null default '' check (length(note) <= 1000),
  reply_to text not null default '' check (length(reply_to) <= 254),
  reporter uuid references auth.users (id) on delete set null,
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index reports_open on public.reports (status, created_at desc);
alter table public.reports enable row level security;
revoke all on public.reports from anon, authenticated;
grant select, delete on public.reports to authenticated;
grant update (status, resolved_at) on public.reports to authenticated;
create policy "Admins read reports" on public.reports for select to authenticated using ((select private.is_admin()));
create policy "Admins resolve reports" on public.reports for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Admins delete reports" on public.reports for delete to authenticated using ((select private.is_admin()));

create function public.report_listing(conf uuid, reason text, note text default '', reply_to text default '') returns void
language plpgsql security definer set search_path = '' as $$
declare n text := trim(coalesce(note, '')); r text := trim(coalesce(reply_to, ''));
begin
  if not exists (select 1 from public.conferences c where c.id = conf and c.status = 'published') then
    raise exception 'That listing isn''t live' using errcode = 'P0002';
  end if;
  if reason not in ('details', 'link', 'inappropriate', 'other') then raise exception 'Choose what''s wrong' using errcode = '22023'; end if;
  if length(n) > 1000 then raise exception 'Keep it under 1000 characters' using errcode = '22001'; end if;
  if reason = 'other' and n = '' then raise exception 'Say what''s wrong' using errcode = '22023'; end if;
  if r <> '' and (length(r) > 254 or r !~ '^\S+@\S+\.\S+$') then raise exception 'That email doesn''t look right' using errcode = '22023'; end if;
  if (select count(*) from public.reports x where x.conference_id = conf and x.created_at > now() - interval '1 hour') >= 5
     or (select count(*) from public.reports x where x.created_at > now() - interval '1 hour') >= 60 then
    raise exception 'Too many reports just now. Try again later, or email hello@collex.au.' using errcode = '54000';
  end if;
  insert into public.reports (conference_id, reason, note, reply_to, reporter)
  values (conf, reason, n, r, (select auth.uid()));
end $$;
revoke execute on function public.report_listing(uuid, text, text, text) from public;
grant execute on function public.report_listing(uuid, text, text, text) to anon, authenticated;
