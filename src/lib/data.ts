import { supabase } from "./supabase";
import { coverUrl, NA, ROLE_KINDS, template, webUrl, type Conference, type Role } from "./conferences";

// Server-side reads of published listings. Pages revalidate every minute, so an approval shows up quickly.

type Row = {
  id: string; slug: string; name: string; short_name: string; host: string; start_date: string | null; end_date: string | null;
  venue: string; level: Conference["level"]; fee: string; delegates: string; overview: string; contact: string;
  delegation_url: string | null; chair_url: string | null; interest_url?: string | null;
  key_dates: Conference["keyDates"]; committees: Conference["committees"]; guides: Conference["guides"];
  secretariat: Conference["secretariat"]; roles?: Partial<Role>[] | null;
  verified?: boolean; updated_at?: string; cover_path?: string | null;
};

const or = (v: string | null | undefined) => (v && v.trim() ? v : NA);

export const fromRow = (r: Row): Conference => ({
  id: r.id,
  slug: r.slug,
  name: r.name,
  shortName: r.short_name || r.name,
  host: r.host,
  startDate: r.start_date,
  endDate: r.end_date,
  venue: or(r.venue),
  level: r.level,
  fee: or(r.fee),
  delegates: or(r.delegates),
  overview: or(r.overview),
  keyDates: r.key_dates?.length ? r.key_dates : template.keyDates,
  committees: r.committees ?? [],
  guides: (r.guides ?? []).map((g) => ({ ...g, url: webUrl(g.url) })),
  secretariat: r.secretariat?.length ? r.secretariat : template.secretariat,
  // Only well-formed roles; a link that isn't a plain web address is dropped, like every other link.
  roles: (r.roles ?? []).filter((x) => ROLE_KINDS.some((k) => k.id === x.kind))
    .map((x) => ({ kind: x.kind!, title: x.title ?? "", note: x.note ?? "", url: webUrl(x.url) })),
  contact: or(r.contact),
  delegationUrl: webUrl(r.delegation_url),
  chairUrl: webUrl(r.chair_url),
  interestUrl: webUrl(r.interest_url),
  verified: r.verified ?? false,
  cover: coverUrl(r.cover_path),
  updatedAt: r.updated_at,
});

export async function getPublished(): Promise<Conference[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from("conferences").select("*").eq("status", "published").order("start_date");
  if (error) { console.error("Loading conferences failed:", error.message); return []; }
  return (data as Row[]).map(fromRow);
}

export async function getBySlug(slug: string): Promise<Conference | null> {
  if (slug === template.slug) return template;
  if (!supabase) return null;
  const { data } = await supabase.from("conferences").select("*").eq("status", "published").eq("slug", slug).maybeSingle();
  return data ? fromRow(data as Row) : null;
}
