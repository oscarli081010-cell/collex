-- Cover images: an organiser attaches a photo to their listing. Files live in a public "covers" bucket,
-- each in a folder named after the account that uploaded it; the listing stores the file's path.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('covers', 'covers', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']);

-- Signed-in people may add files to their own folder only. Nobody can list, replace or delete through the API;
-- the bucket is public, so the pictures themselves load for everyone by their address.
create policy "Upload a cover to your own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'covers' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- The path must point into the folder of whoever listed the conference, so nobody can borrow someone else's file.
alter table public.conferences add column cover_path text
  check (cover_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$' and split_part(cover_path, '/', 1) = submitted_by::text);
grant insert (cover_path), update (cover_path) on public.conferences to authenticated;
