import { defineConfig, devices } from "@playwright/test";

// Smoke tests against a running copy of the site. Point them at it with E2E_BASE_URL (default: a local server on 3100).
// Not part of `npm test` or CI: it needs a browser (`npx playwright install chromium`) and a running site. See README.md in this folder.
export default defineConfig({
  testDir: ".",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3100",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
