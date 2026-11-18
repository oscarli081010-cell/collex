-- Awards are gone from Collex: chairs keep their marks, but nothing is published. The table was empty when dropped.
drop function if exists public.publish_awards(uuid);
drop table if exists public.conference_awards;

create or replace function public.delegate_record(uid uuid)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to ''
as $function$
declare p record;
begin
  select id, full_name, school, public_record into p from public.profiles where id = uid;
  if p.id is null or not (p.public_record or p.id = (select auth.uid())) then return null; end if;
  return jsonb_build_object('name', p.full_name, 'school', coalesce(p.school, ''), 'public', p.public_record,
    'conferences', (select coalesce(jsonb_agg(jsonb_build_object('name', c.name, 'slug', c.slug, 'start', c.start_date, 'end', c.end_date, 'kind', a.kind,
        'role', a.role_title, 'committee', a.committee, 'country', a.country) order by c.start_date desc nulls last), '[]'::jsonb)
      from public.applications a join public.conferences c on c.id = a.conference_id where a.user_id = uid and a.status = 'accepted' and c.status = 'published'));
end $function$;
