import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import PageBand from "@/components/PageBand";
import { breadcrumbJsonLd } from "@/components/Breadcrumbs";
import GuideNav from "@/components/GuideNav";
import { GUIDES, guideBySlug, type Guide } from "@/lib/guides";
import { emph } from "@/lib/emph";
import s from "@/components/LegalPage.module.css";
import gs from "@/components/Guides.module.css";

export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const g = guideBySlug((await params).slug);
  if (!g) return { title: "Guide not found · Collex", robots: { index: false } };
  const name = `${g.title} ${g.accent}`;
  // "Chair a committee on Collex" already says it: no "· Collex" after it.
  return { title: name.endsWith("Collex") ? name : `${name} · Collex`, description: blurb(g), alternates: { canonical: `/guides/${g.slug}` } };
}

// The lead, trimmed to a search result's length at a whole word.
function blurb(g: Guide) {
  const t = g.lead.length >= 70 ? g.lead : `${g.lead} A short Model UN guide for ${g.for.toLowerCase()}, on Collex.`;
  if (t.length <= 155) return t;
  const cut = t.slice(0, 154).replace(/\s+\S*$/, "").replace(/[,;:\s]+$/, "");
  return `${cut}.`;
}

// The guide after this one (round to the first), then up to two more, the same audience first.
function more(g: Guide) {
  const i = GUIDES.findIndex((x) => x.slug === g.slug);
  const next = GUIDES[(i + 1) % GUIDES.length];
  const rest = GUIDES.filter((x) => x.slug !== g.slug && x.slug !== next.slug);
  const related = [...rest.filter((x) => x.for === g.for), ...rest.filter((x) => x.for !== g.for)].slice(0, 2);
  return { next: next.slug === g.slug ? null : next, related };
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const g = guideBySlug((await params).slug);
  if (!g) notFound();
  const { next, related } = more(g);
  const name = `${g.title} ${g.accent}`;
  const trail = [{ name: "Home", href: "/" }, { name: "Guides", href: "/guides" }, { name }];
  // Guides don't carry a date yet; when one is added to the data as `updated` ("2026-11-01") it shows and is passed on to search engines.
  const updated = (g as Guide & { updated?: string }).updated;
  const article = {
    "@context": "https://schema.org", "@type": "Article",
    headline: name, description: g.lead, inLanguage: "en-AU",
    mainEntityOfPage: `https://collex.au/guides/${g.slug}`,
    ...(updated && { dateModified: updated }),
    author: { "@type": "Organization", name: "Collex", url: "https://collex.au" },
    publisher: { "@type": "Organization", name: "Collex", url: "https://collex.au", logo: { "@type": "ImageObject", url: "https://collex.au/pwa-512.png" } },
  };
  return (
    <main id="top" tabIndex={-1} className="container">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify([article, breadcrumbJsonLd(trail)]) }} />
      <PageBand centre title={g.title} accent={g.accent} figures={[{ label: "For", value: g.for }, { label: "Read", value: `${g.minutes} min` }]} />
      <div className={`${s.page} ${s.afterBand}`}>
        <GuideNav label={name} sections={g.sections} chairs={g.for === "Chairs"} />
        <article className={`${s.body} ${gs.guide}`}>
          <p className={gs.intro}>{g.lead}</p>
          {g.sections.map((x) => (
            <section key={x.id} id={x.id}>
              <h2>{x.title}</h2>
              {x.text?.map((p, i) => <p key={i}>{emph(p)}</p>)}
              {x.steps && <ol>{x.steps.map((p, i) => <li key={i}>{emph(p)}</li>)}</ol>}
            </section>
          ))}
          {updated && <p className={gs.intro}>Updated {new Date(`${updated}T00:00:00`).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })}</p>}
          <aside aria-labelledby="more-h" style={{ marginTop: 48 }}>
            <h2 id="more-h">Keep reading</h2>
            <div className={gs.grid}>
              {[...(next ? [{ g: next, label: "Next guide" }] : []), ...related.map((r) => ({ g: r, label: "Related" }))].map(({ g: x, label }) => (
                <Link key={x.slug} href={`/guides/${x.slug}`} className={`panel ${gs.card}`}>
                  <span className={gs.meta}>{label}</span>
                  <span className={`serif ${gs.title}`}>{x.title} <em>{x.accent}</em></span>
                  <span className={gs.lead}>{x.lead}</span>
                  <span className={gs.meta}>{x.minutes} min read</span>
                </Link>
              ))}
            </div>
          </aside>
        </article>
      </div>
    </main>
  );
}
