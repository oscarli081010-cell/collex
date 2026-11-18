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
- **Chambers**: run a committee from one laptop under Evatt, Trinity Grammar MUN, Standard or Custom procedure: roll call,
  speakers' list, timers, motions, amendments, votes by placard or roll call, chairs' marks and awards, and a display
  for the projector. Optionally, delegates join from their own devices to ask for the floor, vote and pass notes.
- **Applications and allocation**: delegates and chairs apply on Collex; organisers answer, allocate committees and
  countries, and email everyone at once.
- **Live committee wall** for the secretariat, and awards published to the conference's page.
- **Reminders** before key dates, **role alerts**, and a public **MUN record** for delegates who turn it on.
- **Guides** for chairs, delegates and organisers, and an installable app that opens Chambers offline.
- **Admin review** of listings, with a "Verified" status for confirmed conferences.

## Usage

Collex launched on 2 November 2026. As of 17 November 2026 it has 18 accounts (17 email-confirmed),
and 10 of them signed in during the past week.

## Stack

Next.js (App Router) and TypeScript, Supabase (Postgres, auth, edge functions), Lenis for smooth
scroll, deployed on Vercel.

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
