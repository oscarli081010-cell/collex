import type { Metadata } from "next";
import RolesBoard, { type BoardItem } from "@/components/RolesBoard";
import { getPublished } from "@/lib/data";
import { isPast } from "@/lib/conferences";

export const metadata: Metadata = { alternates: { canonical: "/roles" },
  title: "Get involved · Collex",
  description: "Chairs, crisis staff, press, photographers and more. See where Sydney Model UN conferences need a hand.",
};
export const revalidate = 60;

const day = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("en-AU", { day: "numeric", month: "short" });

export default async function RolesPage() {
  const upcoming = (await getPublished()).filter((c) => !isPast(c));
  const items: BoardItem[] = upcoming
    .flatMap((c) => (c.roles ?? []).map((role) => ({
      role,
      conference: { slug: c.slug, name: c.name, host: c.host, contact: c.contact },
      when: c.startDate ? day(c.startDate) : "",
      start: c.startDate ?? "9999",
    })))
    .sort((a, b) => a.start.localeCompare(b.start));
  return (
    <main id="top" className="container">
      <RolesBoard items={items} />
    </main>
  );
}
