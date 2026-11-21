-- A daily limit on uploads. Each bucket already limits the size and kind of a file; nothing limited how many, so one
-- account could fill the storage. The limits are far above what running a conference or a committee needs:
-- 30 cover photos, 60 guides, 120 small photos and 40 committee files per person per day.
-- The count is done by a function that reads storage.objects itself, because a policy can only count the rows the
-- person is allowed to read, and the public buckets have no read policy for them.
create or replace function private.uploads_today(bucket text) returns integer
language sql stable security definer set search_path = '' as $$
  select count(*)::int from storage.objects o
  where o.bucket_id = bucket and o.owner_id = (select auth.uid())::text and o.created_at > now() - interval '24 hours'
$$;
revoke execute on function private.uploads_today(text) from public, anon;
grant execute on function private.uploads_today(text) to authenticated;

drop policy if exists "Upload a cover to your own folder" on storage.objects;
create policy "Upload a cover to your own folder" on storage.objects for insert to authenticated
with check (bucket_id = 'covers' and (storage.foldername(name))[1] = (select auth.uid())::text and private.uploads_today('covers') < 30);

drop policy if exists "Upload a guide to your own folder" on storage.objects;
create policy "Upload a guide to your own folder" on storage.objects for insert to authenticated
with check (bucket_id = 'guides' and (storage.foldername(name))[1] = (select auth.uid())::text and private.uploads_today('guides') < 60);

drop policy if exists "Upload a photo to your own folder" on storage.objects;
create policy "Upload a photo to your own folder" on storage.objects for insert to authenticated
with check (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text and private.uploads_today('photos') < 120);

drop policy if exists "People in a committee add its files" on storage.objects;
create policy "People in a committee add its files" on storage.objects for insert to authenticated
with check (case when bucket_id = 'chamber-files'
  then private.in_room(private.as_uuid((storage.foldername(name))[1])) and (storage.foldername(name))[2] = (select auth.uid())::text
       and private.uploads_today('chamber-files') < 40
  else false end);
