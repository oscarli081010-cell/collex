import { ImageResponse } from "next/og";
import { formatRange, NA, type Conference } from "@/lib/conferences";
import { getBySlug } from "@/lib/data";
import { ogImage, OG_SIZE } from "@/lib/ogImage";

export const alt = "A Model UN conference on Collex";
export const size = OG_SIZE;
export const contentType = "image/png";
export const revalidate = 60;

// "NOV" and "Wed 11", or "NOV" and "11 to 13" for a run of days. The same pill as share.png.
function datePill(start: string, end: string | null) {
  const d = (iso: string, o: Intl.DateTimeFormatOptions) => new Date(iso + "T00:00:00Z").toLocaleDateString("en-AU", { timeZone: "UTC", ...o });
  const month = d(start, { month: "short" }).toUpperCase();
  if (!end || end === start) return { month, rest: d(start, { weekday: "short", day: "numeric" }) };
  const endMonth = d(end, { month: "short" }).toUpperCase();
  return endMonth === month
    ? { month, rest: `${d(start, { day: "numeric" })} to ${d(end, { day: "numeric" })}` }
    : { month: `${month} to ${endMonth}`, rest: `${d(start, { day: "numeric" })} to ${d(end, { day: "numeric" })}` };
}

// The organiser's cover photo as a data address, when it is a JPEG or PNG (the only kinds the image renderer draws) and
// arrives within a few seconds. Anything else falls back to the generated card.
async function coverData(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    const type = res.headers.get("content-type") ?? "";
    if (!res.ok || !/^image\/(jpeg|png)/.test(type)) return null;
    return `data:${type.split(";")[0]};base64,${Buffer.from(await res.arrayBuffer()).toString("base64")}`;
  } catch { return null; }
}

// Each conference's share card. With a cover photo the photo is the card, as before; otherwise its name, dates and host.
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  let c: Conference | null = null;
  try { c = await getBySlug((await params).slug); } catch { c = null; }
  if (!c || c.isTemplate) return ogImage({ title: "Sydney Model UN,", italic: "in one place.", lines: ["Upcoming conferences, dates and links."], footer: "collex.au" });

  const photo = c.cover ? await coverData(c.cover) : null;
  if (photo) {
    return new ImageResponse(
      <div style={{ width: "100%", height: "100%", display: "flex" }}><img src={photo} width={OG_SIZE.width} height={OG_SIZE.height} style={{ objectFit: "cover", objectPosition: c.coverPos ?? "50% 50%" }} alt="" /></div>,
      OG_SIZE,
    );
  }

  return ogImage({
    title: c.name,
    pill: c.startDate ? datePill(c.startDate, c.endDate) : undefined,
    lines: [c.startDate ? formatRange(c) : "Dates to be announced", c.host && c.host !== NA ? `Hosted by ${c.host}` : "Sydney Model UN"],
    footer: "collex.au",
  });
}
