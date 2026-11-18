import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import PageBand from "@/components/PageBand";
import { GUIDES, guideBySlug } from "@/lib/guides";
import s from "@/components/LegalPage.module.css";

export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const g = guideBySlug((await params).slug);
  if (!g) return {};
  return { title: `${g.title} · Collex`, description: g.lead, alternates: { canonical: `/guides/${g.slug}` } };
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const g = guideBySlug((await params).slug);
  if (!g) notFound();
  return (
    <main id="top" className="container">
      <PageBand title={g.title} lead={g.lead} />
      <div className={`${s.page} ${s.afterBand}`}>
        <nav className={s.side} aria-label={g.title}>
          <ul>
            {g.sections.map((x, i) => <li key={x.id}><a href={`#${x.id}`} aria-current={i === 0 ? "page" : undefined}>{x.title}</a></li>)}
            <li><Link href="/guides">All guides</Link></li>
            {g.for === "Chairs" && <li><Link href="/chambers">Open Chambers</Link></li>}
          </ul>
          <p className={s.contact}>For {g.for.toLowerCase()} · {g.minutes} min read</p>
        </nav>
        <article className={s.body}>
          {g.sections.map((x) => (
            <section key={x.id} id={x.id}>
              <h2>{x.title}</h2>
              {x.text?.map((p, i) => <p key={i}>{p}</p>)}
              {x.steps && <ol>{x.steps.map((p, i) => <li key={i}>{p}</li>)}</ol>}
            </section>
          ))}
        </article>
      </div>
    </main>
  );
}
