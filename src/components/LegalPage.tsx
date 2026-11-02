import Link from "next/link";
import { CONTACT } from "./Footer";
import s from "./LegalPage.module.css";

export const UPDATED = "2 November 2026";

const PAGES = [
  { href: "/privacy", label: "Privacy policy" },
  { href: "/terms", label: "Terms of use" },
  { href: "/cookies", label: "Cookies policy" },
];

// Shared frame for the legal pages: the three pages listed on the left, the text on the right.
export default function LegalPage({ path, title, lead, children }: { path: string; title: string; lead: string; children: React.ReactNode }) {
  return (
    <main id="top" className={`container ${s.page}`}>
      <nav className={s.side} aria-label="Legal">
        <ul>
          {PAGES.map((p) => (
            <li key={p.href}>
              <Link href={p.href} aria-current={p.href === path ? "page" : undefined}>{p.label}</Link>
            </li>
          ))}
        </ul>
        <p className={s.contact}>Questions? <a href={`mailto:${CONTACT}`} className="link">{CONTACT}</a></p>
      </nav>
      <article className={s.body}>
        <header className={s.head}>
          <h1 className={`serif ${s.title}`}>{title}</h1>
          <p className={s.lead}>{lead}</p>
          <p className={s.updated}>Last updated {UPDATED}</p>
        </header>
        {children}
      </article>
    </main>
  );
}
