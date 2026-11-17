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
`supabase/migrations` in order. Never commit `.env*` files or keys.

## Making a change

1. Open an issue first for anything larger than a small fix, so we agree on the approach.
2. Branch from `main` and keep the pull request to one change.
3. Run `npm run build` and make sure it passes before opening the PR.
4. Describe what changed and why, and include a screenshot for visual changes.

## Guidelines

- Pages must work on a phone and respect reduced-motion settings.
- Keep copy plain and accurate. Unknown conference details show "N/A", never a guess.
- Database changes go in a new numbered migration; do not edit an applied one.

## Reporting a problem

For wrong or missing conference details, open an issue with the conference name and a link to the
source. For security issues, email the contact address on the [about page](https://collex.au/about)
instead of opening a public issue.
