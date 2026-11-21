-- Visitors and ordinary signed-in users can no longer read who sent a listing or its review notes from the table.
-- Admins read them through admin_conferences(), a listing's own team through my_listings(). The site (from the
-- deploy of 0035/0036) selects only the columns below. A new column on conferences needs adding to this grant.
revoke select on public.conferences from anon, authenticated;
grant select (id, slug, status, name, short_name, host, start_date, end_date, venue, level, fee, delegates, overview, contact, delegation_url, chair_url, key_dates, committees, guides, secretariat, created_at, updated_at, published_at, verified, cover_path, interest_url, roles, delegation_opens_at, chair_opens_at, collex_registration, cover_x, cover_y, collex_applications, thumb_path, thumb_x, thumb_y, schedule, claimable) on public.conferences to anon, authenticated;
notify pgrst, 'reload schema';
