-- Two additions to a listing.
--
-- 1. The secretariat could only be set by editing a listing that already existed; a new listing can carry it now.
-- 2. Roles needed: a conference says what help it is looking for (chairs, crisis staff, press, photographers, tech,
--    logistics) and how to apply. Stored on the listing as a short list, like committees and guides, so the same
--    people edit it with the same limits, and it shows on the public "Roles" board once the listing is live.

grant insert (secretariat) on public.conferences to authenticated;

alter table public.conferences
  add column roles jsonb not null default '[]',
  add constraint conferences_roles_shape check (jsonb_typeof(roles) = 'array' and jsonb_array_length(roles) <= 12 and pg_column_size(roles) <= 20000),
  -- every role names one of the known kinds
  add constraint conferences_roles_kind check (not jsonb_path_exists(roles,
    '$[*] ? (!(@.kind == "chair" || @.kind == "crisis" || @.kind == "press" || @.kind == "photo" || @.kind == "tech" || @.kind == "logistics" || @.kind == "other"))')),
  -- an apply link, when there is one, is a plain web address, like every other link on a listing
  add constraint conferences_roles_web check (not jsonb_path_exists(roles, '$[*].url ? (@.type() == "string" && !(@ like_regex "^https?://"))'));

grant insert (roles), update (roles) on public.conferences to authenticated;
