-- Sign-in with Google. A Google account arrives with `name` (and usually `full_name`) but no school or role.
-- Email sign-ups behave exactly as before; this only adds fallbacks:
--   * if `full_name` is missing or empty, use `name`, so a Google user's profile is not left with a blank name;
--   * cut the name at 120 characters, the limit profiles_text_sizes enforces, so an overlong Google name can
--     never make the insert fail and block the sign-up.
-- Nothing else changes: school stays empty (it is optional), role is Delegate, admins are still matched by email,
-- and the Google picture is deliberately not copied (avatar_url only accepts files in our own photos bucket).
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, full_name, school, role, is_admin)
  values (
    new.id,
    coalesce(new.email, ''),
    left(coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), nullif(new.raw_user_meta_data ->> 'name', ''), ''), 120),
    coalesce(new.raw_user_meta_data ->> 'school', ''),
    case when new.raw_user_meta_data ->> 'role' in ('Delegate', 'Chair', 'Secretariat')
      then new.raw_user_meta_data ->> 'role' else 'Delegate' end,
    exists (select 1 from private.admin_emails a where lower(a.email) = lower(new.email))
  );
  return new;
end $$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
