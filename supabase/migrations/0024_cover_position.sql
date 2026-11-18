-- Where a cover photo is framed. The organiser drags the photo in the listing form to choose which part shows on the
-- conference page and in the lists. Each is a percentage across (x) and down (y), as in CSS object-position;
-- empty means the middle.
alter table public.conferences
  add column cover_x smallint check (cover_x between 0 and 100),
  add column cover_y smallint check (cover_y between 0 and 100);
grant insert (cover_x, cover_y), update (cover_x, cover_y) on public.conferences to authenticated;
