-- Papers (shared working papers and draft resolutions) were tried and taken out again. 0025 and 0026 no longer create
-- them; this clears them from a database that ran the earlier versions. Safe to run where they never existed.
do $$
declare f regprocedure; def text;
begin
  if to_regclass('public.chamber_papers') is null then return; end if;
  foreach f in array array['public.room_sync(uuid)'::regprocedure, 'public.room_chair(uuid)'::regprocedure, 'public.conference_wall(uuid)'::regprocedure] loop
    def := pg_get_functiondef(f);
    def := regexp_replace(def, E'\\n[ ]*''papers'', \\(select coalesce[^\\n]*\\n[^\\n]*chamber_papers[^\\n]*', '', 'g');
    def := regexp_replace(def, E'\\n[ ]*''papers'', \\(select count[^\\n]*chamber_papers[^\\n]*', '', 'g');
    if def like '%chamber_papers%' then raise exception 'papers still in %', f; end if;
    execute def;
  end loop;
end $$;
drop function if exists public.paper_create(uuid, text), public.paper_open(uuid), public.paper_save(uuid, text, jsonb, text[], integer),
  public.paper_status(uuid, text, text), public.paper_sign(uuid, boolean), public.paper_delete(uuid);
do $$ begin if to_regclass('public.chamber_papers') is not null then drop function if exists private.can_edit_paper(public.chamber_papers); end if; end $$;
drop table if exists public.chamber_papers;
