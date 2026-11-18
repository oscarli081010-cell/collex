import type { Metadata } from "next";
import Link from "next/link";
import PageBand from "@/components/PageBand";
import { GUIDES } from "@/lib/guides";
import s from "@/components/Guides.module.css";

export const metadata: Metadata = {
  alternates: { canonical: "/guides" },
  title: "Guides · Collex",
  description: "Short, practical guides to Model UN: chairing with Chambers, Evatt and Trinity procedure, your first conference, writing a resolution and running a school conference.",
};

const GROUPS = ["Chairs", "Delegates", "Organisers"] as const;

export default function GuidesPage() {
  return (
    <main id="top" className="container">
      <PageBand title="Guides" lead="Short and practical, for chairs, delegates and the people who run conferences."
        figures={[{ label: "Guides", value: String(GUIDES.length) }]} />
      <div className={s.wrap}>
        {GROUPS.map((g) => (
          <section key={g} aria-labelledby={`g-${g}`}>
            <h2 id={`g-${g}`} className={s.group}>For {g}</h2>
            <div className={s.grid}>
              {GUIDES.filter((x) => x.for === g).map((x) => (
                <Link key={x.slug} href={`/guides/${x.slug}`} className={`panel ${s.card}`}>
                  <span className={`serif ${s.title}`}>{x.title}</span>
                  <span className={s.lead}>{x.lead}</span>
                  <span className={s.meta}>{x.minutes} min read</span>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
