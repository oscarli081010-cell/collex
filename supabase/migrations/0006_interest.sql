-- Expressions of interest: a signed-in person tells a live conference they're keen, before registering.
-- Each person can send one per conference and withdraw it. Organisers see how many, not who.

create table public.interests (
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  conference_id uuid not null references public.conferences (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, conference_id)
);
create index interests_conference on public.interests (conference_id);
alter table public.interests enable row level security;
create policy "Read own interest" on public.interests
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Express interest in a live conference" on public.interests
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.conferences c where c.id = conference_id and c.status = 'published'));
create policy "Withdraw own interest" on public.interests
  for delete to authenticated using (user_id = (select auth.uid()));
revoke all on public.interests from anon, authenticated;
grant select, delete on public.interests to authenticated;
grant insert (conference_id) on public.interests to authenticated;

-- The count for each listing the caller submitted (every listing, for admins). Never names who sent them.
create function public.interest_counts() returns table (conference_id uuid, interested bigint)
language sql stable security definer set search_path = '' as $$
  select c.id, count(i.user_id)
  from public.conferences c left join public.interests i on i.conference_id = c.id
  where c.submitted_by = (select auth.uid()) or private.is_admin()
  group by c.id
$$;
revoke execute on function public.interest_counts() from public, anon;
grant execute on function public.interest_counts() to authenticated;
