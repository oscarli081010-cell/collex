# Collex

**One calendar for every Model United Nations conference in Sydney.**
Live at [collex.au](https://collex.au).

Conference details usually live across school websites, social posts and group chats, so deadlines get
missed and dates clash. Collex puts every conference on one calendar and gives each one the same
standard page: dates, host, committees, background guides, fees, venue and how to apply. It is free
for delegates, chairs, teachers and organisers.

## Features

- **Season calendar and directory** with filters by month, level and format.
- **Date-clash checker**: pick a weekend and see what else is on.
- **Standard conference pages** with key dates, committees, secretariat, fees, venue and applications.
- **Accounts**: follow conferences and get updates.
- **Organiser tools**: list a conference, manage it, and register delegations.
- **Committees**: run a committee from one laptop under Evatt, Trinity Grammar MUN, Standard or Custom procedure: roll call,
  speakers' list, timers, motions, amendments, votes by placard or roll call, chairs' marks, and a display
  for the projector. Optionally, delegates join from their own devices to ask for the floor, vote and pass notes.
- **Applications and allocation**: delegates and chairs apply on Collex; organisers answer, allocate committees and
  countries, and email everyone at once.
- **Live committee wall** for the secretariat.
- **Printable placards and country lists** for each committee, from the allocations or a typed list.
- **Reminders** before key dates, **role alerts**, and a public **MUN record** for delegates who turn it on.
- **Guides** for chairs, delegates and organisers, and an installable app that opens Committees offline.
- **Admin review** of listings, with a "Verified" status for confirmed conferences.

## Stack

Next.js (App Router) and TypeScript, Supabase (Postgres, auth, edge functions), Lenis for smooth
scroll, deployed on Vercel.

## How a listing's workspace is organised

Everything an organiser does with one listing lives in `src/components/listing/`. A listing has tabs (Activity,
Manage, Edit listing, Organisers), and each tab is a stack of sections with a list beside them.

- `tabs.tsx` says which tabs there are and their addresses; `registry.tsx` says what each one shows.
- `Workspace.tsx` loads the listing once and frames whichever tab the address names (`Shell.tsx`, `Nav.tsx`).
- Each tab has a folder (`activity/`, `manage/`, `edit/`, `organisers/`) whose `index.tsx` lists its sections.
- A section is one file that is handed the listing (`types.ts`, `ListingCtx`) and draws one card (`Section.tsx`).

To add a feature, write a section and add one line to its tab's list. To add a tab, add it to `tabs.tsx` and
`registry.tsx` and give it a route that renders `ListingPages`.

## Run it locally

```bash
npm install
cp .env.example .env.local   # then fill in your Supabase URL and publishable key
npm run dev
```

Open <http://localhost:3000>. The database schema is in [`supabase/migrations`](supabase/migrations),
applied in numeric order to a Supabase project. Without the two Supabase variables the site still opens, with
empty lists and log in switched off.

## Environment variables

| Variable | Where | What |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `.env.local`, Vercel, GitHub (for CI builds) | Your Supabase project's address. Public. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | same | The project's publishable key. Public. |
| `RESEND_API_KEY` | Supabase edge function secrets | Lets the edge functions send email. |
| `SUPABASE_DB_URL` | GitHub secret | Connection string for the nightly backup ([docs/backups.md](docs/backups.md)). |
| `BACKUP_PASSPHRASE` | GitHub secret | Encrypts that backup. |
| `E2E_BASE_URL` | shell | The address the browser tests open (default `http://localhost:3100`). |

See [`.env.example`](.env.example) for the full list with notes.

## Checks

```bash
npm run typecheck   # TypeScript
npm run lint        # ESLint (Next's rules); some rules report warnings, only errors fail
npm test            # plain tsx scripts over the pure logic: committee procedures, .ics files, allocation, data parsing, dates, printables
npm run build       # production build (runs the tests first)
```

The same four run on every push in GitHub Actions. The build step needs the two public Supabase variables set as
repository variables and is skipped with a notice until they are.

### Browser smoke tests

`e2e/` has Playwright tests for the public pages. They are not part of `npm test` or CI.

```bash
npx playwright install chromium   # once
npm run build && npx next start -p 3100
npm run test:e2e                  # or: E2E_BASE_URL=https://collex.au npm run test:e2e
```

## Deploy

The site runs on Vercel. [CONTRIBUTING.md](CONTRIBUTING.md) has the release checklist; in short, check, apply any new
migration, deploy changed edge functions, then `npx vercel --prod`. Operations notes are in [docs/](docs):
[architecture](docs/architecture.md), [conference-day runbook](docs/runbook.md), [backups](docs/backups.md).
GitHub Actions also pings the live site every 30 minutes and backs up the database nightly.

## Contributing

Issues and pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md). If you run or attend a
Sydney MUN conference and something on Collex is wrong or missing, open an issue or use the in-site
report button.

## License

[MIT](LICENSE) © 2026 Oscar Li
