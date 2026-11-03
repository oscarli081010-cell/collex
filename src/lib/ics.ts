import { NA, type Conference } from "./conferences";

// iCalendar (.ics) for one conference or the whole circuit. All-day events, Sydney time.

const ymd = (iso: string, addDays = 0) => {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + addDays);
  return d.toISOString().slice(0, 10).replaceAll("-", "");
};
// Text values escape backslashes, commas, semicolons and newlines (RFC 5545 §3.3.11).
const text = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
// Lines longer than 75 bytes fold onto the next line, which starts with a space.
function fold(line: string) {
  const out: string[] = [];
  let cur = "";
  for (const ch of line) {
    if (new TextEncoder().encode(cur + ch).length > (out.length ? 74 : 75)) { out.push(cur); cur = ""; }
    cur += ch;
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
    `DTEND;VALUE=DATE:${ymd(c.endDate ?? c.startDate!, 1)}`,
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

export const icsResponse = (body: string, file: string, inline = false) =>
  new Response(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${file}"`,
      "Cache-Control": "public, max-age=0, s-maxage=300",
    },
  });
