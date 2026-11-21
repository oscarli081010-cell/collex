# End-to-end smoke tests

These open the public pages that need no login in a real browser. They are not part of `npm test` or CI.

```bash
npx playwright install chromium            # once; downloads a browser
npm run build && npx next start -p 3100    # a local copy (needs .env.local), or skip this and use the live site
npm run test:e2e                           # against http://localhost:3100
E2E_BASE_URL=https://collex.au npm run test:e2e   # against the live site
```

The tests tolerate an empty database: anything that needs a listed conference is skipped when there is none.
The signed-in flows (list a conference, apply, allocate, run a committee) are skipped placeholders in
`signed-in.spec.ts`; they need a test account.
