import type { Metadata } from "next";
import Link from "next/link";
import { isPast, todayInSydney } from "@/lib/conferences";
import { getPublished } from "@/lib/data";
import ConferenceRow from "@/components/ConferenceRow";
import { Placard } from "@/components/Drawings";
import PageBand from "@/components/PageBand";
import s from "@/components/board.module.css";

export const metadata: Metadata = {
  title: "Past conferences · Collex",
  description: "Model United Nations conferences in Sydney that have already run, by year.",
  alternates: { canonical: "/past" },
};
export const revalidate = 60;

// Conferences whose last day has passed, newest first, grouped by year.
export default async function PastPage() {
  const today = todayInSydney();
  const past = (await getPublished()).filter((c) => isPast(c, today))
    .sort((a, b) => (b.startDate ?? "").localeCompare(a.startDate ?? ""));
  const years = new Map<string, typeof past>();
  for (const c of past) years.set(c.startDate!.slice(0, 4), [...(years.get(c.startDate!.slice(0, 4)) ?? []), c]);

  return (
    <main id="top" className="container">
      <PageBand
        title="Past"
        accent="conferences"
        lead="Conferences that have already run. Their pages stay up, so committees and guides are easy to look back on."
        figures={past.length ? [{ label: "Archived", value: String(past.length) }, { label: "Years", value: String(years.size) }] : undefined}
      />
      {past.length === 0 ? (
        <div className={s.empty} style={{ marginTop: 32 }}>
          <Placard />
          <p className={s.emptyTitle}>Nothing has finished yet</p>
          <p className="muted">Once a listed conference&rsquo;s last day passes, it moves here.</p>
          <Link href="/conferences" className="button secondary">See what&rsquo;s coming up</Link>
        </div>
      ) : [...years].map(([year, list]) => (
        <section key={year} className={s.group}>
          <h2 className={s.groupHead}>{year}</h2>
          <div className={s.list}>{list.map((c) => <ConferenceRow key={c.slug} c={c} past />)}</div>
        </section>
      ))}
      <p className={s.pastLink}><Link href="/conferences" className="link">← Upcoming conferences</Link></p>
    </main>
  );
}
