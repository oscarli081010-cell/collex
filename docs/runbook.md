# Conference-day runbook

For whoever is looking after Collex while a conference is running. Nothing here needs code changes.

## The night before

1. Open collex.au on a phone and a laptop. The home page, **Conferences** and the conference's own page should load.
2. Sign in as the organiser and check the conference page: dates, venue, schedule, and (if you use them) the
   applications, allocations and check-in list.
3. Open **Admin > Health** (admins only). It should say **All Good**: no failed emails, nothing waiting more than
   30 minutes, every scheduled job worked. Fix or note anything it flags.
4. Open GitHub **Actions** and check that the last **Uptime** and **Backup** runs are green.
5. For each committee that will run: sign in on the laptop it will run from, open the committee once, and start the
   display (next section). Check the committee's name, delegates and countries are right.
6. Print what you need (placards and country lists) from the conference's Manage tab.
7. Charge the laptop, bring the charger, and have a phone hotspot ready.

## Make the console work without wifi

Do this **once, on the room's own wifi, while signed in**, ideally the night before and again when you arrive.

1. On the laptop that will run the committee, open **collex.au/chambers** and sign in.
2. Open the committee itself, so the laptop keeps a copy. Collex keeps the five most recent committees in the browser,
   for the person signed in on that browser.
3. Open the display page too: **Open Display** inside the committee, or `collex.au/chambers/display?c=` followed by the
   committee's id. The site keeps both pages so they open again with no connection.
4. Reload each page once, then turn the wifi off and reload again. If the committee and display still open, you're set.
5. Don't sign out, and don't clear the browser's site data. With no sign-in kept, the kept copies can't be opened offline.

If the wifi drops during the day, the console keeps working and shows it is offline. Changes are held in the browser
and sent when the connection returns. The display, as another tab of the same browser, keeps following the console.
Don't open the same committee on a second laptop while the first is offline: when both come back, the later save wins
and the first chair is told their unsent changes were replaced.

## The display

Projector or second screen: in the committee, click **Open Display**. It opens `/chambers/display?c=<committee id>`
in a new tab. Drag that tab to the projector and press F11 (full screen). It follows the console live.

## If the site is down

1. Check **status** yourself: open <https://collex.au> in a private window and on your phone's mobile data.
2. Check the **Uptime** workflow in GitHub Actions and the Vercel dashboard (vercel.com > the collex project > Deployments).
3. If the last deployment is the cause, roll back (below).
4. A committee already open on the laptop keeps running without the site. Don't reload it. Keep using it, and fix
   the site afterwards.
5. If you must reload and the site is down, the browser can still open **/chambers** and the display from the kept copy
   (see above), if you did the setup.

## If the database is down

The public pages keep working from their cached copy for a while, then show what they last had. Signing in, applying and
anything that saves will fail. Check <https://status.supabase.com> and the Supabase dashboard (the project may be
paused: click Restore project). Committees open on a laptop keep running and save when the database is back.
If data was lost, see [backups.md](backups.md).

## Roll back a deploy

1. vercel.com > the collex project > **Deployments**.
2. Find the last deployment that was good (the one before the problem began).
3. Click the **...** menu on it and choose **Promote to Production** (or **Instant Rollback** where it is offered).
   collex.au switches in seconds. No rebuild needed.
4. The database is not rolled back by this. If the bad release came with a migration, say so in the notes and fix
   forward rather than undoing the migration by hand.

From a terminal: `npx vercel rollback` (rolls back to the previous production deployment).

## Pause emails

Emails are sent by the Supabase edge functions `mailer`, `notify` and `chamber-invite`. They all need the
`RESEND_API_KEY` secret and answer "not set" without it, leaving everything queued.

- **Pause:** Supabase > Edge Functions > Secrets > delete `RESEND_API_KEY` (write the value down first).
  Nothing is lost; nothing is sent. Admin > Health shows the count waiting.
- **Resume:** add `RESEND_API_KEY` back. Everything waiting goes out on the next run (the daily job, or the next time
  an organiser sends something), so expect a burst.
- **Drop one queued email:** in the Supabase SQL editor, `update private.mail set failed_at = now(), last_error = 'Cancelled by hand' where id = 123;`.
  List what is waiting with `select id, to_user, subject, created_at from private.mail where sent_at is null and failed_at is null order by id;`.

Sign-up and password-reset emails are sent by Supabase Auth itself, not these functions, so this doesn't pause them.
