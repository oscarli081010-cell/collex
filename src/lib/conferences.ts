// Conference shape, the demo page, and date helpers. Listings themselves come from Supabase (lib/data.ts).

export type Level = "High school" | "University" | "Open";

export type Committee = {
  name: string;
  topic: string;
  level: string;
  chairs: string;
};

export type Conference = {
  slug: string;
  name: string;
  shortName: string;
  host: string;
  /** ISO dates (yyyy-mm-dd), or null while unknown */
  startDate: string | null;
  endDate: string | null;
  venue: string;
  level: Level | null;
  fee: string;
  delegates: string;
  overview: string;
  keyDates: { label: string; date: string | null }[];
  committees: Committee[];
  guides: { committee: string; released: string | null; url: string | null }[];
  secretariat: { role: string; name: string }[];
  contact: string;
  /** Application form links; null until applications open. */
  delegationUrl?: string | null;
  chairUrl?: string | null;
  isTemplate?: boolean;
};

export const NA = "N/A";

/** A link that is safe to put in href: only http(s) web links pass, so a stored javascript: link can never run. */
export const webUrl = (u: string | null | undefined) => (u && /^https?:\/\//i.test(u.trim()) ? u.trim() : null);

/** The standard page every listing gets. Shown so the structure can be seen before anything is listed. */
export const template: Conference = {
  slug: "template",
  name: "Conference name",
  shortName: NA,
  host: NA,
  startDate: null,
  endDate: null,
  venue: NA,
  level: null,
  fee: NA,
  delegates: NA,
  overview: NA,
  keyDates: [
    { label: "Delegation registration opens", date: null },
    { label: "Chair applications close", date: null },
    { label: "Country allocations sent", date: null },
    { label: "Background guides released", date: null },
    { label: "Position papers due", date: null },
    { label: "Conference day", date: null },
  ],
  committees: [],
  guides: [],
  secretariat: [
    { role: "Secretary-General", name: NA },
    { role: "Deputy Secretary-General", name: NA },
    { role: "Director-General", name: NA },
    { role: "Head of Chairs", name: NA },
  ],
  contact: NA,
  isTemplate: true,
};

export const SEASON_YEAR = 2027;

export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function formatDate(iso: string | null) {
  if (!iso) return NA;
  return new Date(iso + "T00:00:00").toLocaleDateString("en-AU", {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
  });
}

export function formatRange(c: Conference) {
  if (!c.startDate) return NA;
  if (!c.endDate || c.endDate === c.startDate) return formatDate(c.startDate);
  return `${formatDate(c.startDate)} to ${formatDate(c.endDate)}`;
}

/** Listed conferences overlapping the weekend (Fri to Sun) around a date. */
export function clashesNear(list: Conference[], iso: string) {
  const d = new Date(iso + "T00:00:00");
  const day = d.getDay();
  const fri = new Date(d);
  fri.setDate(d.getDate() - ((day + 2) % 7));
  const sun = new Date(fri);
  sun.setDate(fri.getDate() + 2);
  return list.filter((c) => {
    if (!c.startDate) return false;
    const s = new Date(c.startDate + "T00:00:00");
    const e = new Date((c.endDate ?? c.startDate) + "T00:00:00");
    return s <= sun && e >= fri;
  });
}

/** Conferences running on a given day. */
export const onDay = (list: Conference[], iso: string) =>
  list.filter((c) => c.startDate && c.startDate <= iso && (c.endDate ?? c.startDate) >= iso);
