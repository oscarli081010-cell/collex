-- An organiser can send people to their own interest form (a Google Form, say) instead of Collex's one-tap
-- expression of interest. Same rule as the registration and chair links: a plain web address only.

alter table public.conferences
  add column interest_url text
  constraint conferences_interest_url_web check (interest_url is null or (interest_url ~ '^https?://\S+$' and length(interest_url) <= 500));

-- Reading is already open (the table grants select to everyone); writing is limited to the people who may edit a listing.
grant insert (interest_url), update (interest_url) on public.conferences to authenticated;
