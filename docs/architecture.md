# Architecture

One page on how the pieces fit.

```
Browser (Next.js pages, on Vercel)
   |  reads published listings on the server, 60-second cache         -> Supabase Postgres (tables + RPC functions)
   |  signed-in actions (apply, allocate, run a committee) from the browser -> Supabase Postgres, as the user
   |  after something that queues mail                                -> Edge function (mailer / notify / chamber-invite)
   v
Supabase: Postgres + Auth + Realtime + Storage        pg_cron (daily jobs)
                                                          |
                         private.mail (the outbox) <------+---- queue_reminders()
                                  |
                           mailer edge function  -->  Resend  -->  inboxes
```

## Pages to database

- The site is a Next.js App Router app (`src/app`) deployed on Vercel. There is no server of our own beyond Next.
- Public pages are rendered on the server and revalidated every 60 seconds. They read published listings through
  `src/lib/data.ts` with the publishable key; a failed read throws so Next keeps serving the last good page.
  `/api/refresh` lets an organiser rebuild the cache right after an edit.
- Signed-in screens call Supabase straight from the browser (`src/lib/supabase.ts`). Row-level security and `security
  definer` functions decide what each person may read and change; the publishable key can't do more than that.
- Schema and functions are in `supabase/migrations`, applied by hand in order (see CONTRIBUTING.md).
- Page views are counted without cookies by the `hit` function; client errors are reported to a table; the Admin tabs
  (Visitors, Errors, Health) read them back through `admin_*` functions.

## Edge functions

Three Deno functions in `supabase/functions`, each reading `RESEND_API_KEY` and a direct database connection:

- `mailer`: sends whatever is waiting in `private.mail` (application answers, allocations, organisers' emails, reminders,
  claims, role alerts). Rows are claimed so no email goes twice; a refused email is marked failed, a passing failure is
  retried up to five times.
- `notify`: the "follow" emails when a conference gains application links or guides.
- `chamber-invite`: the "you've been added to a committee" email.

The site calls them after an action that queues mail, and ignores the answer.

## Cron and the outbox

`pg_cron` runs inside Supabase: `collex-reminders` (daily, 9 pm UTC) queues reminders for key dates then calls `mailer`;
`collex-prune-errors` (daily) clears old error reports. Admin > Health shows each job's last run.

## Committees: sync and offline copies

"Chambers" in code and the database, "Committees" on screen. The procedures (Evatt, Trinity, Standard) are pure functions
in `src/lib` with tests; a committee is one JSON state.

- A committee kept only on this laptop is saved in the browser after every change.
- A shared committee lives in the `chambers` table with a **version**. The console (`useChamber`) opens it with
  `open_chamber`, follows changes through Realtime, and polls every 3 seconds in case the live feed drops, sending the
  version it already has so an unchanged committee comes back as a tiny answer.
- Each change is a function replayed on top of the latest state. `save_chamber(new_state, expected_version)` accepts it
  only if no one else saved first; if someone did, the change is replayed on theirs and sent again. Changes that can never
  be saved (too big, not allowed) are undone and the chair is told.
- Delegates on their own devices go through `room_sync` and `room_chair`; they never change the committee, they send
  requests the chair accepts.
- **Offline:** the console keeps a copy of each shared committee (the five most recent, for the signed-in person) in
  `localStorage`, marked with whether it holds unsent changes. With no connection it opens from that copy and sends the
  changes when the connection returns. The display, another tab of the same browser, reads the same copy. A service
  worker (`public/sw.js`) keeps the `/chambers` pages and the site's built files so the pages themselves open offline;
  it never keeps anything from Supabase.

## Checks

`npm test` runs plain tsx scripts over the pure logic (procedures, calendar files, allocation, data parsing, dates,
printables). CI also runs types, lint and a production build. `e2e/` holds optional browser smoke tests.
