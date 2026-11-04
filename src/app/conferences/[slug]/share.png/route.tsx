import { formatRange, NA } from "@/lib/conferences";
import { getBySlug } from "@/lib/data";
import { ogImage } from "@/lib/ogImage";

export const revalidate = 60;

// "NOV" and "Wed 11", or "NOV" and "11 to 13" for a run of days.
function datePill(start: string, end: string | null) {
  const d = (iso: string, o: Intl.DateTimeFormatOptions) => new Date(iso + "T00:00:00").toLocaleDateString("en-AU", { timeZone: "UTC", ...o });
  const month = d(start, { month: "short" }).toUpperCase();
  if (!end || end === start) return { month, rest: d(start, { weekday: "short", day: "numeric" }) };
  const endMonth = d(end, { month: "short" }).toUpperCase();
  return endMonth === month
    ? { month, rest: `${d(start, { day: "numeric" })} to ${d(end, { day: "numeric" })}` }
    : { month: `${month} to ${endMonth}`, rest: `${d(start, { day: "numeric" })} to ${d(end, { day: "numeric" })}` };
}

// Each conference's share card when it has no cover photo: its name, dates and venue, straight from the listing.
export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  const c = await getBySlug((await params).slug);
  if (!c) return ogImage({ title: "Collex", lines: ["Sydney Model UN, in one place."], footer: "collex.au" });
  return ogImage({
    title: c.name,
    pill: c.startDate ? datePill(c.startDate, c.endDate) : undefined,
    lines: [c.startDate ? formatRange(c) : "Dates to be announced", c.venue === NA ? `Hosted by ${c.host}` : `${c.venue} · ${c.host}`],
    footer: `collex.au/conferences/${c.slug}`,
  });
}
