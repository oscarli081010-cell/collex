import { NA, type Conference } from "./conferences";

// iCalendar (.ics) for one conference or the whole circuit. All-day events, Sydney time.

const ymd = (iso: string, addDays = 0) => {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + addDays);
  return d.toISOString().slice(0, 10).replaceAll("-", "");
};
// The last day of a conference; a missing end date, or one before the start, means a one-day event.
const lastDay = (c: Conference) => (c.endDate && c.endDate > c.startDate! ? c.endDate : c.startDate!);
// Text values escape backslashes, commas, semicolons and newlines (RFC 5545 §3.3.11).
// Any line break (CRLF, a lone CR, LF) becomes \n, and other control characters are dropped, so a name can never start a new property line.
const text = (s: string) =>
  s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r\n?|\n/g, "\\n").replace(/[\u0000-\u0008\u000b-\u001f\u007f\u2028\u2029]/g, "");
// Lines longer than 75 bytes fold onto the next line, which starts with a space.
const enc = new TextEncoder();
function fold(line: string) {
  const out: string[] = [];
  let cur = "";
  let bytes = 0;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    if (bytes + n > (out.length ? 74 : 75)) { out.push(cur); cur = ""; bytes = 0; }
    cur += ch; bytes += n;
  }
  return [...out, cur].join("\r\n ");
}

function event(c: Conference, stamp: string) {
  const url = `https://collex.au/conferences/${c.slug}`;
  const where = [c.venue !== NA ? c.venue : "", c.host].filter(Boolean).join(", ");
  return [
    "BEGIN:VEVENT",
    `UID:${c.slug}@collex.au`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${ymd(c.startDate!)}`,
    `DTEND;VALUE=DATE:${ymd(lastDay(c), 1)}`,
    `SUMMARY:${text(c.name)}`,
    `LOCATION:${text(where)}`,
    `DESCRIPTION:${text(`Hosted by ${c.host}. Details: ${url}`)}`,
    `URL:${url}`,
    "END:VEVENT",
  ];
}

export function ics(list: Conference[], name?: string) {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Collex//collex.au//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    ...(name ? [`X-WR-CALNAME:${text(name)}`, "X-WR-TIMEZONE:Australia/Sydney", "REFRESH-INTERVAL;VALUE=DURATION:PT6H", "X-PUBLISHED-TTL:PT6H"] : []),
    ...list.filter((c) => c.startDate && !c.isTemplate).flatMap((c) => event(c, stamp)),
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}

// A link that opens Google Calendar's "add event" screen with this conference filled in. All-day, so the last day
// is given as the day after (Google's end date is exclusive).
export function googleCalendarUrl(c: Conference) {
  const url = `https://collex.au/conferences/${c.slug}`;
  const p = new URLSearchParams({
    action: "TEMPLATE",
    text: c.name,
    dates: `${ymd(c.startDate!)}/${ymd(lastDay(c), 1)}`,
    ctz: "Australia/Sydney",
    details: `Hosted by ${c.host}. Details: ${url}`,
  });
  if (c.venue !== NA) p.set("location", c.venue);
  return `https://calendar.google.com/calendar/render?${p}`;
}

export const icsResponse = (body: string, file: string, inline = false) =>
  new Response(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${file}"`,
      "Cache-Control": "public, max-age=0, s-maxage=300",
    },
  });
