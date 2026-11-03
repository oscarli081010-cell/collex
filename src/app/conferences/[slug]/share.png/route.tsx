import { formatRange, NA } from "@/lib/conferences";
import { getBySlug } from "@/lib/data";
import { ogImage } from "@/lib/ogImage";

export const revalidate = 60;

// Each conference's share card when it has no cover photo: its name, dates and venue, straight from the listing.
export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  const c = await getBySlug((await params).slug);
  if (!c) return ogImage({ title: "Collex", lines: ["Sydney Model UN, in one place."], footer: "collex.au" });
  return ogImage({
    title: c.name,
    lines: [c.startDate ? formatRange(c) : "Dates to be announced", c.venue === NA ? `Hosted by ${c.host}` : `${c.venue} · ${c.host}`],
    footer: `collex.au/conferences/${c.slug}`,
  });
}
