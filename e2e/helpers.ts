import { expect, type Page } from "@playwright/test";

/** Collects what the page logs as errors, so a test can say the page loaded cleanly. */
export function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const text = m.text();
    // A missing favicon or an extension's request is not the site's fault.
    if (/favicon|chrome-extension|ERR_BLOCKED_BY_CLIENT/i.test(text)) return;
    errors.push(`console: ${text}`);
  });
  return errors;
}

/** The page is no wider than the screen (a pixel of slack for rounding). */
export async function expectNoSideScroll(page: Page) {
  const { scroll, view, wide } = await page.evaluate(() => {
    const view = window.innerWidth;
    const wide = [...document.querySelectorAll("body *")].filter((e) => e.getBoundingClientRect().right > view + 1).slice(0, 5)
      .map((e) => `${e.tagName.toLowerCase()}.${String(e.className).slice(0, 40)} right=${Math.round(e.getBoundingClientRect().right)}`);
    return { scroll: document.documentElement.scrollWidth, view, wide };
  });
  expect(scroll, `page is ${scroll}px wide on a ${view}px screen; widest: ${wide.join(" | ")}`).toBeLessThanOrEqual(view + 1);
}

/** The first listed conference's address (like /conferences/some-slug), or null when the database has none. */
export async function firstConferencePath(page: Page): Promise<string | null> {
  await page.goto("/conferences");
  const hrefs = await page.locator('a[href^="/conferences/"]').evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).getAttribute("href") ?? ""));
  return hrefs.find((h) => /^\/conferences\/[^/?#]+$/.test(h) && !h.endsWith("/demo_listing")) ?? null;
}
