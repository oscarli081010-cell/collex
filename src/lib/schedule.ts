// Times people type for a listing (when registration opens) are Sydney time, whatever the device's clock says.
const TZ = "Australia/Sydney";

const parts = (d: Date) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-AU", {
    timeZone: TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(d).map((x) => [x.type, x.value]));
  return p as Record<"year" | "month" | "day" | "hour" | "minute" | "second", string>;
};

// How far Sydney's clock is ahead of UTC at that moment (it changes with daylight saving).
const offset = (d: Date) => {
  const p = parts(d);
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - Math.floor(d.getTime() / 1000) * 1000;
};

/** "2026-02-03T09:00" typed as Sydney time → the instant it means, as an ISO string. Empty or invalid gives null. */
export function sydneyToIso(local: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) return null;
  const wall = Date.parse(local + ":00Z");
  if (Number.isNaN(wall)) return null;
  // The offset depends on the instant, which depends on the offset: two passes settle it, daylight saving included.
  let t = wall - offset(new Date(wall));
  t = wall - offset(new Date(t));
  return new Date(t).toISOString();
}

/** An instant → "2026-02-03T09:00" in Sydney time, for a datetime-local field. */
export function isoToSydney(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = parts(d);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

/** "Tue 3 Feb, 9:00 am" (Sydney time), or "Tue 3 Feb 2027, 9:00 am" when it isn't this year. */
export function whenOpens(iso: string): string {
  const d = new Date(iso);
  const year = (x: Date) => new Intl.DateTimeFormat("en-AU", { timeZone: TZ, year: "numeric" }).format(x);
  return d.toLocaleString("en-AU", {
    weekday: "short", day: "numeric", month: "short", ...(year(d) === year(new Date()) ? {} : { year: "numeric" }),
    hour: "numeric", minute: "2-digit", timeZone: TZ,
  });
}

/** The short form for tight buttons: "3 Feb". */
export const shortOpens = (iso: string) => new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short", timeZone: TZ });
