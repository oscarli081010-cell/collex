import { supabase } from "./supabase";
import { coverPosition, coverUrl, NA, ROLE_KINDS, scheduleOf, template, webUrl, type Committee, type Conference, type ConferenceSummary, type Role } from "./conferences";

// Server-side reads of published listings. Pages revalidate every minute, so an approval shows up quickly.

// The columns the lists, search and calendars use. Every page gets these through the root layout, so they stay few.
const SUMMARY_COLUMNS = "id, slug, name, short_name, host, start_date, end_date, venue, level, key_dates, delegation_url, chair_url, delegation_opens_at, chair_opens_at, collex_registration, collex_applications, verified, cover_path, cover_x, cover_y, thumb_path, thumb_x, thumb_y";

type SummaryRow = {
  id: string; slug: string; name: string; short_name: string; host: string; start_date: string | null; end_date: string | null;
  venue: string; level: Conference["level"]; key_dates: unknown;
  delegation_url: string | null; chair_url: string | null; delegation_opens_at?: string | null; chair_opens_at?: string | null;
  collex_registration?: boolean; collex_applications?: boolean; verified?: boolean;
  cover_path?: string | null; cover_x?: number | null; cover_y?: number | null; thumb_path?: string | null; thumb_x?: number | null; thumb_y?: number | null;
};
// jsonb columns are typed unknown: they're checked on the way in, never trusted.
type Row = SummaryRow & {
  fee: string; delegates: string; overview: string; contact: string; interest_url?: string | null;
  schedule?: unknown; committees: unknown; guides: unknown; secretariat: unknown; roles?: unknown;
  updated_at?: string; submitted_by?: string | null; claimable?: boolean;
};

const or = (v: unknown): string => (typeof v === "string" && v.trim() ? v : NA);

// Reading jsonb with care: a column that isn't an array is empty, an entry that isn't an object is dropped,
// and a field of the wrong type reads as empty. One bad listing must never break a page.
const objects = (v: unknown) => (Array.isArray(v) ? v : []).filter((x): x is Record<string, unknown> => Boolean(x) && typeof x === "object" && !Array.isArray(x));
const str = (v: unknown) => (typeof v === "string" ? v : "");
const strOrNull = (v: unknown) => (typeof v === "string" ? v : null);

const keyDatesOf = (v: unknown): Conference["keyDates"] => objects(v).map((x) => ({ label: str(x.label), date: strOrNull(x.date) }));
const committeesOf = (v: unknown): Committee[] => objects(v).map((x) => ({ name: str(x.name), topic: str(x.topic), level: str(x.level), chairs: str(x.chairs) }));
const guidesOf = (v: unknown): Conference["guides"] => objects(v).map((x) => ({ committee: str(x.committee), released: strOrNull(x.released), url: webUrl(strOrNull(x.url)) }));
const secretariatOf = (v: unknown): Conference["secretariat"] =>
  objects(v).map((x) => ({ role: str(x.role), name: str(x.name), ...(typeof x.photo === "string" && { photo: x.photo }) }));
// Only well-formed roles; a link that isn't a plain web address is dropped, like every other link.
const rolesOf = (v: unknown): Role[] => objects(v).flatMap((x) => {
  const kind = ROLE_KINDS.find((k) => k.id === x.kind)?.id;
  return kind ? [{ kind, title: str(x.title), note: str(x.note), url: webUrl(strOrNull(x.url)) }] : [];
});

export const summaryFromRow = (r: SummaryRow): ConferenceSummary => ({
  id: r.id,
  // A row with no usable text here (a null from the database) gets an empty string, so a page can't crash on it.
  slug: str(r.slug),
  name: str(r.name),
  shortName: str(r.short_name) || str(r.name),
  host: str(r.host),
  startDate: r.start_date,
  endDate: r.end_date,
  venue: or(r.venue),
  level: r.level,
  keyDates: keyDatesOf(r.key_dates),
  delegationUrl: webUrl(r.delegation_url),
  chairUrl: webUrl(r.chair_url),
  delegationOpensAt: r.delegation_opens_at ?? null,
  chairOpensAt: r.chair_opens_at ?? null,
  collexRegistration: r.collex_registration ?? false,
  collexApplications: r.collex_applications ?? false,
  verified: r.verified ?? false,
  cover: coverUrl(r.cover_path),
  coverPos: coverPosition(r.cover_x, r.cover_y),
  thumb: coverUrl(r.thumb_path ?? null),
  thumbPos: coverPosition(r.thumb_x, r.thumb_y),
});

export const fromRow = (r: Row): Conference => ({
  ...summaryFromRow(r),
  fee: or(r.fee),
  delegates: or(r.delegates),
  overview: or(r.overview),
  // A listing saved before the schedule existed has none, and the page must never break on a bad one.
  schedule: scheduleOf(r.schedule),
  committees: committeesOf(r.committees),
  guides: guidesOf(r.guides),
  secretariat: secretariatOf(r.secretariat),
  roles: rolesOf(r.roles),
  contact: or(r.contact),
  interestUrl: webUrl(r.interest_url),
  claimable: r.claimable ?? r.submitted_by === null,
  updatedAt: r.updated_at,
});

// Every column a visitor may read. The submitter and the review notes are left out: only admins and the listing's own
// team see those (through admin_conferences and my_listings), so they are never selected here. A new column on
// `conferences` must be added to this list and to the column grants in the database.
export const PUBLIC_COLUMNS = "id, slug, status, name, short_name, host, start_date, end_date, venue, level, fee, delegates, overview, contact, delegation_url, chair_url, key_dates, committees, guides, secretariat, created_at, updated_at, published_at, verified, cover_path, interest_url, roles, delegation_opens_at, chair_opens_at, collex_registration, cover_x, cover_y, collex_applications, thumb_path, thumb_x, thumb_y, schedule, claimable";

// A failed read throws rather than returning nothing: under ISR, Next then keeps serving the last good page instead of
// caching an empty site (or a 404) for a minute. Only "no rows" is empty.
const PAGE = 1000; // PostgREST returns at most this many rows per request
async function published<T>(columns: string): Promise<T[]> {
  if (!supabase) return [];
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    // id breaks ties in the date order, so no row is skipped or repeated between pages.
    const { data, error } = await supabase.from("conferences").select(columns).eq("status", "published")
      .order("start_date").order("id").range(from, from + PAGE - 1);
    if (error) throw new Error(`Loading conferences failed: ${error.message}`);
    out.push(...(data as T[]));
    if (data.length < PAGE) return out;
  }
}

/** Every published listing in full. For server pages that show the heavy fields (open roles, for one). */
export async function getPublished(): Promise<Conference[]> {
  return (await published<Row>(PUBLIC_COLUMNS)).map(fromRow);
}

/** Every published listing, only what lists, search and the calendars show. */
// The list goes into every page (the layout reads it), so a failed read falls back to the last list this server got,
// and a page rendered on request (a delegate's record, say) still opens while the database is briefly unreachable.
// With no earlier list to fall back on it still throws, so an empty site is never cached.
let lastSummaries: ConferenceSummary[] | null = null;
export async function getSummaries(): Promise<ConferenceSummary[]> {
  try {
    return (lastSummaries = (await published<SummaryRow>(SUMMARY_COLUMNS)).map(summaryFromRow));
  } catch (e) {
    if (lastSummaries) return lastSummaries;
    throw e;
  }
}

export async function getBySlug(slug: string): Promise<Conference | null> {
  // The demo's slug has an underscore, which a real listing's slug (made from its name by the database) never has.
  if (slug === template.slug) return template;
  if (!supabase) return null;
  const { data, error } = await supabase.from("conferences").select(PUBLIC_COLUMNS).eq("status", "published").eq("slug", slug).maybeSingle();
  if (error) throw new Error(`Loading conference "${slug}" failed: ${error.message}`);
  return data ? fromRow(data as Row) : null;
}
