import { supabase } from "./supabase";
import { coverPosition, coverUrl, NA, ROLE_KINDS, template, webUrl, type Conference, type Role } from "./conferences";

// Server-side reads of published listings. Pages revalidate every minute, so an approval shows up quickly.

type Row = {
  id: string; slug: string; name: string; short_name: string; host: string; start_date: string | null; end_date: string | null;
  venue: string; level: Conference["level"]; fee: string; delegates: string; overview: string; contact: string;
  delegation_url: string | null; chair_url: string | null; delegation_opens_at?: string | null; chair_opens_at?: string | null; interest_url?: string | null; collex_registration?: boolean;
  key_dates: Conference["keyDates"]; committees: Conference["committees"]; guides: Conference["guides"];
  secretariat: Conference["secretariat"]; roles?: Partial<Role>[] | null;
  verified?: boolean; updated_at?: string; collex_applications?: boolean; submitted_by?: string | null; cover_path?: string | null; cover_x?: number | null; cover_y?: number | null; thumb_path?: string | null; thumb_x?: number | null; thumb_y?: number | null;
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
  keyDates: r.key_dates ?? [],
  committees: r.committees ?? [],
  guides: (r.guides ?? []).map((g) => ({ ...g, url: webUrl(g.url) })),
  secretariat: r.secretariat ?? [],
  // Only well-formed roles; a link that isn't a plain web address is dropped, like every other link.
  roles: (r.roles ?? []).filter((x) => ROLE_KINDS.some((k) => k.id === x.kind))
    .map((x) => ({ kind: x.kind!, title: x.title ?? "", note: x.note ?? "", url: webUrl(x.url) })),
  contact: or(r.contact),
  delegationUrl: webUrl(r.delegation_url),
  chairUrl: webUrl(r.chair_url),
  delegationOpensAt: r.delegation_opens_at ?? null,
  chairOpensAt: r.chair_opens_at ?? null,
  interestUrl: webUrl(r.interest_url),
  collexRegistration: r.collex_registration ?? false,
  collexApplications: r.collex_applications ?? false,
  claimable: r.submitted_by === null,
  verified: r.verified ?? false,
  cover: coverUrl(r.cover_path),
  coverPos: coverPosition(r.cover_x, r.cover_y),
  thumb: coverUrl(r.thumb_path ?? null),
  thumbPos: coverPosition(r.thumb_x, r.thumb_y),
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
