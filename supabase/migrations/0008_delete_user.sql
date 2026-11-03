-- Admins delete accounts. Deleting the login removes the profile, follows and interests with it (they cascade);
-- the person's listings stay, with no submitter, so a live conference page doesn't vanish with them.
-- Admins can't delete themselves or another admin: remove admin access first, so it is always two deliberate steps.
create function public.delete_user(target uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare who text;
begin
  if not private.is_admin() then raise exception 'Only admins can do this' using errcode = '42501'; end if;
  if target = (select auth.uid()) then raise exception 'You cannot delete your own account here' using errcode = '42501'; end if;
  select email into who from public.profiles where id = target and not is_admin;
  if who is null then raise exception 'Remove their admin access first, or the account is already gone' using errcode = '42501'; end if;
  perform private.log('deleted user', 'user', target::text, who, '{}');
  delete from auth.users where id = target;
end $$;
revoke execute on function public.delete_user(uuid) from public, anon;
grant execute on function public.delete_user(uuid) to authenticated;
