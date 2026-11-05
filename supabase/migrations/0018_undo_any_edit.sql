-- Undo works on any edit that kept old values, not only the newest one touching those fields. It is offered while the
-- listing still differs from how it was before that edit (so an undone edit stops offering undo), and the undo itself is
-- logged as a new edit, so it can be undone too.
create or replace function private.can_undo(entry bigint) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.audit_log a
    join public.conferences c on c.id::text = a.target_id
    where a.id = entry and a.target_type = 'conference' and a.action = 'edited'
      and coalesce(a.detail -> 'before', '{}'::jsonb) <> '{}'::jsonb
      and c.status in ('pending', 'published')
      and private.can_edit(c.id)
      and exists (
        select 1 from jsonb_each(a.detail -> 'before') b
        where b.value is distinct from (to_jsonb(c) -> b.key))
  )
$$;
