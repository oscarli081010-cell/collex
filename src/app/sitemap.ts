import type { MetadataRoute } from "next";
import { getPublished } from "@/lib/data";

export const revalidate = 60;

// Every public page, plus one entry per published conference, so new listings are found quickly.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = "https://collex.au";
  const pages = ["", "/calendar", "/conferences", "/roles", "/past", "/about", "/list", "/privacy", "/terms", "/cookies"].map((p) => ({ url: `${base}${p}` }));
  const conferences = (await getPublished()).map((c) => ({ url: `${base}/conferences/${c.slug}` }));
  return [...pages, ...conferences];
}
