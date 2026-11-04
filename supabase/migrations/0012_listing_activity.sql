-- Activity for the people who run a listing: who changed what, and how many are following.
-- The audit log was readable only by admins and an edit recorded nothing about what it touched. Now an edit records
-- which fields it changed (their names only, never what was in them), and two read-only functions let the owner and
-- accepted co-organisers (and admins) see their own listing's history and follower count. Counts only, never who.

create or replace function private.audit_conferences() returns trigger
language plpgsql security definer set search_path = '' as $$
declare changed jsonb;
begin
  if tg_op = 'INSERT' then
    perform private.log('submitted', 'conference', new.id::text, new.name, jsonb_build_object('status', new.status));
  elsif tg_op = 'DELETE' then
    perform private.log('deleted', 'conference', old.id::text, old.name, '{}');
    return old;
  elsif new.status is distinct from old.status then
    perform private.log(
      case new.status when 'published' then 'approved' when 'rejected' then 'rejected'
                      when 'unpublished' then 'unpublished' else 'reopened' end,
      'conference', new.id::text, new.name,
      jsonb_build_object('from', old.status, 'to', new.status, 'note', new.review_note));
  else
    select coalesce(jsonb_agg(n.key order by n.key), '[]'::jsonb) into changed
    from jsonb_each(to_jsonb(new)) n
    where n.value is distinct from (to_jsonb(old) -> n.key) and n.key not in ('updated_at', 'published_at');
    perform private.log('edited', 'conference', new.id::text, new.name, jsonb_build_object('fields', changed));
  end if;
  return new;
end $$;

-- A listing's history, newest first, for the people who edit it (and admins). Who did it is a name, not an email,
-- except for team changes, where the person affected is named as the Team panel already does.
create function public.listing_history(conf uuid)
returns table (at timestamptz, who text, action text, fields jsonb, note text, subject text)
language sql stable security definer set search_path = '' as $$
  select a.at,
         case when a.actor is null then 'Collex' else coalesce(nullif(p.full_name, ''), a.actor_email) end,
         a.action,
         coalesce(a.detail -> 'fields', '[]'::jsonb),
         nullif(a.detail ->> 'note', ''),
         coalesce(a.detail ->> 'invitee', a.detail ->> 'organiser')
  from public.audit_log a
  left join public.profiles p on p.id = a.actor
  where a.target_type = 'conference' and a.target_id = conf::text
    and (private.can_edit(conf) or private.is_admin())
  order by a.at desc
  limit 100
$$;

-- How many people follow a listing, for the people who edit it (and admins). Nobody else gets a number.
create function public.listing_followers(conf uuid) returns bigint
language sql stable security definer set search_path = '' as $$
  select case when private.can_edit(conf) or private.is_admin()
              then (select count(*) from public.follows where conference_id = conf) end
$$;

revoke execute on function public.listing_history(uuid) from public, anon;
revoke execute on function public.listing_followers(uuid) from public, anon;
grant execute on function public.listing_history(uuid) to authenticated;
grant execute on function public.listing_followers(uuid) to authenticated;
