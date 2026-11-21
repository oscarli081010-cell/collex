// Conference shape, the demo page, and date helpers. Listings themselves come from Supabase (lib/data.ts).

export type Level = "High school" | "University" | "Open";

/** What a conference can ask for help with. The ids are the only kinds the database accepts. */
export const ROLE_KINDS = [
  { id: "chair", label: "Chair" },
  { id: "crisis", label: "Crisis staff" },
  { id: "press", label: "Press and media" },
  { id: "photo", label: "Photography" },
  { id: "tech", label: "Tech" },
  { id: "logistics", label: "Logistics" },
  { id: "other", label: "Other" },
] as const;
export type RoleKind = (typeof ROLE_KINDS)[number]["id"];
export const roleLabel = (k: RoleKind) => ROLE_KINDS.find((r) => r.id === k)?.label ?? "Other";
/** Help a conference is looking for. With no apply link, people are pointed to the organisers. */
export type Role = { kind: RoleKind; title: string; note: string; url: string | null };

export type Committee = {
  name: string;
  topic: string;
  level: string;
  chairs: string;
};

export type Conference = {
  /** Database id; the demo page has none. */
  id?: string;
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
  /** Roles the conference needs filled; empty for most. */
  roles?: Role[];
  secretariat: { role: string; name: string; photo?: string }[];
  contact: string;
  /** Application form links; null until applications open. */
  delegationUrl?: string | null;
  chairUrl?: string | null;
  /** When registration and chair applications open, if the organiser scheduled it (ISO timestamps). */
  delegationOpensAt?: string | null;
  chairOpensAt?: string | null;
  /** The organiser's own interest form (Google Forms and the like). When set, it replaces Collex's interest button. */
  interestUrl?: string | null;
  /** The organisers take registrations on Collex (their listing's Manage tab) rather than through their own form. */
  collexRegistration?: boolean;
  /** The organisers take applications from individuals (delegates, chairs, people for open roles) on Collex. */
  collexApplications?: boolean;
  /** Collex added this listing and nobody runs it yet, so its organisers can claim it. */
  claimable?: boolean;
  isTemplate?: boolean;
  /** Set by an admin when the listing came from the conference's own secretariat. */
  verified?: boolean;
  /** Address of the organiser's cover photo, if they added one. */
  cover?: string | null;
  /** Which part of the cover photo shows where it is cropped, as CSS object-position ("50% 30%"). */
  coverPos?: string | null;
  /** A separate photo for the lists (square), and where it is framed. Without one the lists use the cover. */
  thumb?: string | null;
  thumbPos?: string | null;
  /** ISO timestamp of the last change to the listing. */
  updatedAt?: string;
};

/** The stored marker for "not given". It stays "N/A" because saved listings hold it and code compares against it; visitors see `shown()`. */
export const NA = "N/A";

/** What a visitor reads in place of an unknown value. Never put this into data, files or search results. */
export const TBA = "To be announced";
export const DATE_TBA = "Date to be announced";

/** A stored value as a visitor should see it: the "not given" marker reads as "To be announced". */
export const shown = (v: string | null | undefined) => (!v || v === NA ? TBA : v);

/** Where a cover photo is framed, from the two percentages saved with the listing. Neither saved means the middle. */
export const coverPosition = (x: number | null | undefined, y: number | null | undefined) =>
  x == null && y == null ? null : `${x ?? 50}% ${y ?? 50}%`;

/** The public address of a cover photo stored in the "covers" bucket. */
export const coverUrl = (path: string | null | undefined) =>
  path && process.env.NEXT_PUBLIC_SUPABASE_URL ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/covers/${path}` : null;

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


export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function formatDate(iso: string | null) {
  if (!iso) return DATE_TBA;
  return new Date(iso + "T00:00:00").toLocaleDateString("en-AU", {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
  });
}

export function formatRange(c: Conference) {
  if (!c.startDate) return DATE_TBA;
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

/** Today's date in Sydney (yyyy-mm-dd), whatever time zone the server or browser runs in. */
export const todayInSydney = () => new Date().toLocaleDateString("en-CA", { timeZone: "Australia/Sydney" });

/** A conference has finished once its last day is over. Listings without dates never count as past. */
export const isPast = (c: Conference, today = todayInSydney()) => Boolean(c.startDate && (c.endDate ?? c.startDate) < today);

/** "2027-03" → "March 2027" */
export const monthLabel = (ym: string) => `${MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;

/** One or two letters standing in for a cover photo: "Sydney Collegiate MUN" → "SC". */
export const monogram = (c: Conference) =>
  (c.shortName && c.shortName !== c.name && c.shortName.length <= 4 ? c.shortName : c.name.split(/\s+/).filter((w) => /^[A-Za-z0-9]/.test(w)).map((w) => w[0]).join(""))
    .slice(0, 2).toUpperCase();
