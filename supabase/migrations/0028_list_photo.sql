-- A separate photo for the lists. The conference page shows the cover cropped wide; the lists show a square, which
-- can now be its own photo (a logo, say) with its own framing. Empty means the lists use the cover.
alter table public.conferences
  add column thumb_path text constraint conferences_thumb_path_shape check (thumb_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$'),
  add column thumb_x smallint check (thumb_x between 0 and 100),
  add column thumb_y smallint check (thumb_y between 0 and 100);
grant insert (thumb_path, thumb_x, thumb_y), update (thumb_path, thumb_x, thumb_y) on public.conferences to authenticated;

-- Like the cover, the list photo must sit in the folder of whoever set it.
create or replace function private.guard_conference_update() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() and (
    new.status is distinct from old.status or new.review_note is distinct from old.review_note
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

create or replace function private.guard_conference_cover() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() and (
    (new.cover_path is not null and split_part(new.cover_path, '/', 1) is distinct from (select auth.uid())::text)
    or (new.thumb_path is not null and split_part(new.thumb_path, '/', 1) is distinct from (select auth.uid())::text)
  ) then
    raise exception 'Upload the photo again before saving.' using errcode = '42501';
  end if;
  return new;
end $$;
