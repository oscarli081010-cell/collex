-- Least privilege: the API roles get only what the app uses. Row rules (RLS) still decide which rows.
revoke all on public.conferences, public.profiles, public.audit_log from anon, authenticated;

grant select on public.conferences to anon, authenticated;
-- Submitters send only the form's fields. Status, slug, review notes and dates stamped by Collex use their defaults.
grant insert (name, short_name, host, submitter_role, start_date, end_date, venue, level, contact, fee,
              delegation_url, chair_url, overview, committees, submitted_by)
  on public.conferences to authenticated;
-- Admins only, through the "Admins update" and "Admins delete" rules.
grant update (status, review_note, name, short_name, host, start_date, end_date, venue, level, fee, delegates,
              overview, contact, delegation_url, chair_url, key_dates, committees, guides, secretariat)
  on public.conferences to authenticated;
grant delete on public.conferences to authenticated;

grant select on public.profiles to authenticated;
grant update (full_name, school, role, theme) on public.profiles to authenticated;

grant select on public.audit_log to authenticated;

-- Links must be web links, so a listing can never carry a javascript: link. Text has sensible size limits.
alter table public.conferences
  add constraint conferences_delegation_url_web check (delegation_url is null or (delegation_url ~ '^https?://\S+$' and length(delegation_url) <= 500)),
  add constraint conferences_chair_url_web check (chair_url is null or (chair_url ~ '^https?://\S+$' and length(chair_url) <= 500)),
  add constraint conferences_guides_web check (not jsonb_path_exists(guides, '$[*].url ? (@.type() == "string" && !(@ like_regex "^https?://"))')),
  add constraint conferences_text_sizes check (
    length(name) <= 200 and length(short_name) <= 80 and length(host) <= 200 and length(venue) <= 200
    and length(fee) <= 120 and length(delegates) <= 120 and length(overview) <= 4000 and length(contact) <= 254
    and length(submitter_role) <= 120 and length(review_note) <= 2000),
  add constraint conferences_json_sizes check (
    pg_column_size(committees) <= 20000 and pg_column_size(key_dates) <= 10000
    and pg_column_size(guides) <= 20000 and pg_column_size(secretariat) <= 10000);

alter table public.profiles
  add constraint profiles_text_sizes check (length(full_name) <= 120 and length(school) <= 200);

-- Rate limit: at most 5 listings per account per day, so nobody can flood the review queue. Admins are exempt.
create function private.limit_submissions() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() and (
    select count(*) from public.conferences
    where submitted_by = new.submitted_by and created_at > now() - interval '1 day'
  ) >= 5 then
    raise exception 'Too many listings today. Try again tomorrow.' using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke execute on function private.limit_submissions() from public, anon, authenticated;
create trigger conferences_rate_limit before insert on public.conferences
  for each row execute function private.limit_submissions();
