import { expect, test } from "@playwright/test";
import { expectNoSideScroll, firstConferencePath, watchErrors } from "./helpers";

// Public pages that need no login. Written to pass on an empty database.

test("home loads and shows the site", async ({ page }) => {
  const errors = watchErrors(page);
  const res = await page.goto("/");
  expect(res?.status()).toBe(200);
  await expect(page).toHaveTitle(/Collex/);
  await expect(page.locator("main")).toContainText(/Collex|conference/i);
  // Either some conferences are listed or the page says there are none; never a blank page.
  const listed = await page.locator('a[href^="/conferences/"]').count();
  if (listed === 0) await expect(page.locator("main")).toContainText(/no |none|list/i);
  expect(errors).toEqual([]);
});

test("conferences directory: search narrows and clears", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/conferences");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const search = page.getByPlaceholder("Search conferences or schools");
  await expect(search).toBeVisible();
  await expect(page.getByLabel("Month").first()).toBeAttached();
  await expect(page.getByLabel("Level").first()).toBeAttached();
  // Only the list itself: the footer links to the demo page whatever the search says.
  const rows = page.locator('main a[href^="/conferences/"]');
  const before = await rows.count();
  await search.fill("zzzz-no-such-conference");
  await expect(rows).toHaveCount(0);
  await page.getByRole("button", { name: "Clear search" }).click();
  await expect(search).toHaveValue("");
  await expect(rows).toHaveCount(before);
  expect(errors).toEqual([]);
});

test("a conference page shows its dates and the .ics download works", async ({ page, request }) => {
  const errors = watchErrors(page);
  const path = await firstConferencePath(page);
  test.skip(!path, "no conference is listed in this database");
  const res = await page.goto(path!);
  expect(res?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.locator("main")).toContainText(/Key dates|Dates|\d{4}|Date to be announced/i);
  const ics = await request.get(`${path}/calendar.ics`);
  // A conference with no dates yet has no calendar file (its Add to calendar button is off until dates are announced).
  const undated = /Date to be announced/i.test(await page.locator("main").innerText());
  if (undated && ics.status() === 404) return;
  expect(ics.status()).toBe(200);
  expect(ics.headers()["content-type"]).toContain("text/calendar");
  expect(await ics.text()).toMatch(/^BEGIN:VCALENDAR/);
  expect(errors).toEqual([]);
});

test("the whole-circuit calendar file and sitemap respond", async ({ request }) => {
  const ics = await request.get("/calendar.ics");
  expect(ics.status()).toBe(200);
  expect(await ics.text()).toMatch(/^BEGIN:VCALENDAR[\s\S]*END:VCALENDAR\r?\n$/);
  expect((await request.get("/sitemap.xml")).status()).toBe(200);
});

test("calendar renders", async ({ page }) => {
  const errors = watchErrors(page);
  const res = await page.goto("/calendar");
  expect(res?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  expect(errors).toEqual([]);
});

test("guides list and one guide", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/guides");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const first = page.locator('a[href^="/guides/"]').first();
  await expect(first).toBeVisible();
  const href = await first.getAttribute("href");
  const res = await page.goto(href!);
  expect(res?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  expect(errors).toEqual([]);
});

test("log in shows errors on an empty submit", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/login");
  const submit = page.getByRole("button", { name: /^Log In$/ });
  await expect(submit).toBeVisible();
  test.skip(await submit.isDisabled(), "the site has no database configured, so the form is switched off");
  await submit.click();
  await expect(page.getByText("Add a valid email.")).toBeVisible();
  expect(errors).toEqual([]);
});

test("an unknown address shows the 404 page", async ({ page }) => {
  const res = await page.goto("/this-page-does-not-exist");
  expect(res?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/out of order/i);
  await expect(page.getByRole("link", { name: "Go Home" })).toBeVisible();
});

test.describe("on a 375px phone", () => {
  test.use({ viewport: { width: 375, height: 812 } });
  for (const path of ["/", "/conferences", "/calendar", "/guides", "/guides/your-first-conference", "/login", "/signup", "/no-such-page"]) {
    test(`no sideways scroll on ${path}`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await expectNoSideScroll(page);
    });
  }
  test("no sideways scroll on a conference page", async ({ page }) => {
    const path = await firstConferencePath(page);
    test.skip(!path, "no conference is listed in this database");
    await page.goto(path!);
    await page.waitForLoadState("networkidle");
    await expectNoSideScroll(page);
  });
});
