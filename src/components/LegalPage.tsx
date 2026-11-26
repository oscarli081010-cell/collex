import { CONTACT } from "./Footer";
import PageBand from "./PageBand";
import SectionNav, { type Jump } from "./SectionNav";
import s from "./LegalPage.module.css";

export const UPDATED = "26 November 2026";

const PAGES = [
  { href: "/privacy", label: "Privacy policy" },
  { href: "/terms", label: "Terms of use" },
  { href: "/cookies", label: "Cookies policy" },
];

// Shared frame for the legal pages: the headline band, then the page's sections and the three pages listed on the
// left, with the text on the right.
export default function LegalPage({ path, title, accent, lead, sections, children }: {
  path: string; title: string; accent?: string; lead: string; sections: Jump[]; children: React.ReactNode;
}) {
  return (
    <main id="top" className="container">
      <PageBand title={title} accent={accent} lead={lead} />
      <div className={`${s.page} ${s.afterBand}`}>
        <SectionNav
          sections={sections}
          links={PAGES.map((p) => ({ ...p, current: p.href === path }))}
          linksLabel="Legal"
          foot={<p className={s.contact}>Questions? <a href={`mailto:${CONTACT}`} className="link">{CONTACT}</a></p>}
        />
        <article className={s.body}>
          <p className={s.updated}>Last updated {UPDATED}</p>
          {children}
        </article>
      </div>
    </main>
  );
}
