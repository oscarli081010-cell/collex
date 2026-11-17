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
- **Chambers**: a speaking-time timer and a display screen for running a committee.
- **Admin review** of listings, with a "Verified" status for confirmed conferences.

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
