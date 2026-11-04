-- Background guides as PDF files. An organiser can upload a committee's guide instead of linking to one; the file
-- lives in a public "guides" bucket, in a folder named after the account that uploaded it, and the listing stores
-- the file's public address in its guides (the same place a pasted link goes).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('guides', 'guides', true, 10485760, array['application/pdf']);

-- Signed-in people may add files to their own folder only. Nobody can list, replace or delete through the API;
-- the bucket is public, so a guide loads for everyone by its address.
create policy "Upload a guide to your own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'guides' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- A new listing can carry its guides from the start (until now they could only be added by editing it afterwards).
-- The same web-address rule as before still applies to every guide (conferences_guides_web).
grant insert (guides) on public.conferences to authenticated;
