-- Key dates (registration opens, papers due, and so on) can be set when a listing is first sent, not only by editing it
-- afterwards. They are stored as a short list of { label, date }, so the list gets the same kind of shape check the
-- other lists have: at most 20, each with a short label, and a date that is either empty or a real yyyy-mm-dd.

grant insert (key_dates) on public.conferences to authenticated;

alter table public.conferences
  add constraint conferences_key_dates_shape check (
    jsonb_typeof(key_dates) = 'array' and jsonb_array_length(key_dates) <= 20
    and not jsonb_path_exists(key_dates, '$[*] ? (!(@.label.type() == "string" && @.label like_regex "^.{1,80}$"))')
    and not jsonb_path_exists(key_dates, '$[*].date ? (@.type() == "string" && !(@ like_regex "^[0-9]{4}-[0-9]{2}-[0-9]{2}$"))')
  );
