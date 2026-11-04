-- Photos of people: a profile picture on an account, and a photo for each person on a listing's secretariat.
-- Files live in a public "photos" bucket, each in a folder named after the account that uploaded it. The pictures are
-- small (the site shrinks them to a square before uploading), so the limit is low.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', true, 1048576, array['image/jpeg', 'image/png', 'image/webp']);

-- Signed-in people may add files to their own folder only. Nobody can list, replace or delete through the API;
-- the bucket is public, so a photo loads for everyone by its address.
create policy "Upload a photo to your own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- An account's own picture: the address of a file in that account's own folder.
alter table public.profiles add column avatar_url text
  check (avatar_url ~ ('^https://npdaczdwmhbtgitmplxc\.supabase\.co/storage/v1/object/public/photos/' || id::text || '/[0-9a-f-]{36}\.(jpg|png|webp)$'));
grant update (avatar_url) on public.profiles to authenticated;

-- A secretariat member's photo is the address of a file in the photos bucket, like nothing else.
alter table public.conferences add constraint conferences_secretariat_photo check (not jsonb_path_exists(secretariat,
  '$[*].photo ? (@.type() == "string" && !(@ like_regex "^https://npdaczdwmhbtgitmplxc\\.supabase\\.co/storage/v1/object/public/photos/[0-9a-f-]{36}/[0-9a-f-]{36}\\.(jpg|png|webp)$"))'));
