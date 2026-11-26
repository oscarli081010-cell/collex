import type { MetadataRoute } from "next";
import { getPublished, getSummaries } from "@/lib/data";
import { GUIDES } from "@/lib/guides";

export const revalidate = 60;

// Every public page, plus one entry per published conference (with when its listing last changed), so new listings are found quickly.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = "https://collex.au";
  const pages = ["", "/start", "/calendar", "/conferences", "/teachers", "/practice", "/guides", ...GUIDES.map((g) => `/guides/${g.slug}`), "/chambers", "/past", "/about", "/list", "/privacy", "/terms", "/cookies"].map((p) => ({ url: `${base}${p}` }));
  // The summaries (what every page carries) have no change date; the full listings do. If they can't be read, the summaries still give the addresses.
  const full = await getPublished().catch(() => null);
  const conferences = full
    ? full.map((c) => ({ url: `${base}/conferences/${c.slug}`, ...(c.updatedAt && { lastModified: new Date(c.updatedAt) }) }))
    : (await getSummaries()).map((c) => ({ url: `${base}/conferences/${c.slug}` }));
  return [...pages, ...conferences];
}
