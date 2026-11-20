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

## Usage

Collex launched on 2 November 2026. As of 17 November 2026 it has 18 accounts (17 email-confirmed),
and 10 of them signed in during the past week.

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
applied in numeric order to a Supabase project.

## Contributing

Issues and pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md). If you run or attend a
Sydney MUN conference and something on Collex is wrong or missing, open an issue or use the in-site
report button.

## License

[MIT](LICENSE) © 2026 Oscar Li
