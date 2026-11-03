import { formatRange } from "@/lib/conferences";
import { getBySlug } from "@/lib/data";
import { ogImage, OG_SIZE } from "@/lib/ogImage";

export const alt = "Conference on Collex";
export const size = OG_SIZE;
export const contentType = "image/png";
export const revalidate = 60;

// Each conference's share card: its name, dates and host, straight from the listing.
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const c = await getBySlug((await params).slug);
  if (!c) return ogImage({ title: "Collex", lines: ["Sydney Model UN, in one place."], footer: "collex.au" });
  return ogImage({
    title: c.name,
    lines: [c.startDate ? formatRange(c) : "Dates to be announced", `Hosted by ${c.host}`],
    footer: `collex.au/conferences/${c.slug}`,
  });
}
