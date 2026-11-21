-- Resubmitting a listing. The owner and editors of a rejected or taken-down (unpublished) listing can now edit it and
-- send it for review again: its status goes back to pending and the admins see it in the queue. Nothing else changes:
-- only an admin publishes, rejects or takes down a listing, sets its review note or verified badge, or changes who owns
-- it. The status change is written to the activity log by private.audit_conferences like every other one
-- (as "reopened", from rejected/unpublished to pending). Needs 0039 and 0040, which leave guard_conference_update as it
-- was. Safe to run twice.

drop policy if exists "Organisers edit their listings" on public.conferences;
create policy "Organisers edit their listings" on public.conferences for update to authenticated
using (private.can_edit(id) and status in ('pending', 'published', 'rejected', 'unpublished'))
with check (private.can_edit(id) and status in ('pending', 'published', 'rejected', 'unpublished'));

-- As before, except that a non-admin may move a rejected or unpublished listing back to pending.
create or replace function private.guard_conference_update() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() and (
    (new.status is distinct from old.status
      and not (old.status in ('rejected', 'unpublished') and new.status = 'pending'))
    or new.review_note is distinct from old.review_note
    or new.verified is distinct from old.verified or new.submitted_by is distinct from old.submitted_by
  ) then
    raise exception 'Only admins can change a listing''s review status.' using errcode = '42501';
  end if;
  if not private.is_admin() and (
    (new.cover_path is distinct from old.cover_path and new.cover_path is not null
      and split_part(new.cover_path, '/', 1) is distinct from (select auth.uid())::text)
    or (new.thumb_path is distinct from old.thumb_path and new.thumb_path is not null
      and split_part(new.thumb_path, '/', 1) is distinct from (select auth.uid())::text)
  ) then
    raise exception 'Upload the photo again before saving.' using errcode = '42501';
  end if;
  return new;
end $$;
revoke execute on function private.guard_conference_update() from public, anon, authenticated;
