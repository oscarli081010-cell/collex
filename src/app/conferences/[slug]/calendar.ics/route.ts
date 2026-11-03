import { getBySlug } from "@/lib/data";
import { ics, icsResponse } from "@/lib/ics";

export const revalidate = 60;

// One conference as a calendar file: /conferences/<slug>/calendar.ics
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = await getBySlug(slug);
  if (!c || c.isTemplate || !c.startDate) return new Response("Not found", { status: 404 });
  return icsResponse(ics([c]), `${c.slug}.ics`);
}
