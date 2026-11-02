// Single source of conference data. Swap this for Supabase later; pages only use the exports below.

export type Level = "High school" | "University" | "Open";
export type Format = "In person" | "Online" | "Hybrid";

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
  suburb: string;
  level: Level | null;
  format: Format | null;
  fee: string;
  delegates: string;
  overview: string;
  keyDates: { label: string; date: string | null }[];
  committees: Committee[];
  guides: { committee: string; released: string | null; url: string | null }[];
  secretariat: { role: string; name: string }[];
  contact: string;
  website: string;
  isTemplate?: boolean;
};

export const NA = "N/A";

/** The standard page every listing gets. Shown so the structure can be seen before anything is listed. */
export const template: Conference = {
  slug: "template",
  name: "Conference name",
  shortName: NA,
  host: NA,
  startDate: null,
  endDate: null,
  venue: NA,
  suburb: NA,
  level: null,
  format: null,
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
  committees: [
    { name: NA, topic: NA, level: NA, chairs: NA },
    { name: NA, topic: NA, level: NA, chairs: NA },
    { name: NA, topic: NA, level: NA, chairs: NA },
  ],
  guides: [
    { committee: NA, released: null, url: null },
    { committee: NA, released: null, url: null },
  ],
  secretariat: [
    { role: "Secretary-General", name: NA },
    { role: "Deputy Secretary-General", name: NA },
    { role: "Director-General", name: NA },
    { role: "Head of Chairs", name: NA },
  ],
  contact: NA,
  website: NA,
  isTemplate: true,
};

/** Real listings. Empty until the first conference is listed. */
export const conferences: Conference[] = [];

export const allPages: Conference[] = [template, ...conferences];

export const SEASON_YEAR = 2027;

export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function getConference(slug: string) {
  return allPages.find((c) => c.slug === slug);
}

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
export function clashesNear(iso: string) {
  const d = new Date(iso + "T00:00:00");
  const day = d.getDay();
  const fri = new Date(d);
  fri.setDate(d.getDate() - ((day + 2) % 7));
  const sun = new Date(fri);
  sun.setDate(fri.getDate() + 2);
  return conferences.filter((c) => {
    if (!c.startDate) return false;
    const s = new Date(c.startDate + "T00:00:00");
    const e = new Date((c.endDate ?? c.startDate) + "T00:00:00");
    return s <= sun && e >= fri;
  });
}

export function inMonth(month: number) {
  return conferences.filter((c) => c.startDate && new Date(c.startDate).getMonth() === month);
}
