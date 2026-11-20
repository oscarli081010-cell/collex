import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import PageBand from "@/components/PageBand";
import { GUIDES, guideBySlug } from "@/lib/guides";
import { emph } from "@/lib/emph";
import s from "@/components/LegalPage.module.css";
import gs from "@/components/Guides.module.css";

export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const g = guideBySlug((await params).slug);
  if (!g) return {};
  return { title: `${g.title} ${g.accent} · Collex`, description: g.lead, alternates: { canonical: `/guides/${g.slug}` } };
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const g = guideBySlug((await params).slug);
  if (!g) notFound();
  return (
    <main id="top" className="container">
      <PageBand centre title={g.title} accent={g.accent} figures={[{ label: "For", value: g.for }, { label: "Read", value: `${g.minutes} min` }]} />
      <div className={`${s.page} ${s.afterBand}`}>
        <nav className={s.side} aria-label={`${g.title} ${g.accent}`}>
          <ul>
            {g.sections.map((x, i) => <li key={x.id}><a href={`#${x.id}`} aria-current={i === 0 ? "page" : undefined}>{x.title}</a></li>)}
            <li><Link href="/guides">All guides</Link></li>
            {g.for === "Chairs" && <li><Link href="/chambers">Open Committees</Link></li>}
          </ul>
        </nav>
        <article className={`${s.body} ${gs.guide}`}>
          <p className={gs.intro}>{g.lead}</p>
          {g.sections.map((x) => (
            <section key={x.id} id={x.id}>
              <h2>{x.title}</h2>
              {x.text?.map((p, i) => <p key={i}>{emph(p)}</p>)}
              {x.steps && <ol>{x.steps.map((p, i) => <li key={i}>{emph(p)}</li>)}</ol>}
            </section>
          ))}
        </article>
      </div>
    </main>
  );
}
