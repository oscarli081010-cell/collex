# Contributing to Collex

Thanks for helping. Collex is small and maintained by one person, so keeping changes focused makes
them quick to review.

## Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

You need a Supabase project for anything that touches accounts or data. Apply the files in
`supabase/migrations` in order. Never commit `.env*.local` files or keys.

## Making a change

1. Open an issue first for anything larger than a small fix, so we agree on the approach.
2. Branch from `main` and keep the pull request to one change.
3. Run `npm run typecheck`, `npm run lint` and `npm test`, and make sure there are no errors. (Lint warnings are a
   to-do list, not a blocker; don't add new ones.)
4. Describe what changed and why, and include a screenshot for visual changes.

## Guidelines

- Pages must work on a phone and respect reduced-motion settings.
- Keep copy plain and accurate. Unknown conference details show "N/A", never a guess.
- Database changes go in a new numbered migration; do not edit an applied one.
- Button labels are in Title Case. Empty states use the shared `board.empty` block.

## Naming: Chambers in code, Committees on screen

The feature is called **Committees** everywhere a person reads it. In code it is **chamber**: the `chambers` and
`chamber_members` tables, `src/lib/chamber.ts`, `useChamber`, the `/chambers` address and the
`chamber-invite` edge function. Don't rename one to match the other; use "committee" in anything shown to people and
"chamber" in identifiers.

## Migrations

- Files are `supabase/migrations/NNNN_name.sql`, numbered in order from 0001. Take the next free number.
- They are applied **by hand**, one file at a time, in the Supabase SQL editor (or whichever Supabase tooling you
  use); there is no automatic runner and nothing records which have been applied. Say in the commit which ones
  need applying.
- Never edit one that has been applied: write a new one. Write them so running one twice is harmless
  (`if not exists`, `create or replace`, drop-then-create for function signatures).
- Order matters only when one depends on another. 0033 (schedule and announcements) was applied after 0034
  (OAuth profiles); they change different objects (announcements and schedule against the new-user profile function), so the order made no difference, but expect a fresh project
  to take them in numeric order.
- Apply a migration **before** deploying site code that needs it.

## Release checklist

Before the site changes:

1. `npm run typecheck`
2. `npm run lint` (no errors)
3. `npm test`
4. `npm run build` (needs `.env.local`)
5. Apply any new migration(s) in `supabase/migrations` by hand, then check the feature in the database.
6. Deploy changed edge functions (`supabase/functions/*`), for example
   `npx supabase functions deploy mailer --project-ref <your project ref>`, and check any new secret is set.
7. Deploy the site: `npx vercel --prod`.
8. Smoke check: open collex.au, then `E2E_BASE_URL=https://collex.au npm run test:e2e`, and by hand sign in and try the
   thing you changed. Look at Admin > Health.

If it goes wrong, see "Roll back a deploy" in [docs/runbook.md](docs/runbook.md).

## Continuous integration

`.github/workflows/check.yml` runs typecheck, lint, tests and the build on every push. The build needs the two public
Supabase values: add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` under repository
**Settings > Secrets and variables > Actions > Variables**. Until then the build step is skipped with a notice.
`uptime.yml` and `backup.yml` are described in [docs/backups.md](docs/backups.md) and the runbook.

## Reporting a problem

For wrong or missing conference details, open an issue with the conference name and a link to the
source. For security issues, email the contact address on the [about page](https://collex.au/about)
instead of opening a public issue.
