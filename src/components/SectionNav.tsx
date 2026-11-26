"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import s from "./SectionNav.module.css";

export type Jump = { id: string; label: string };
/** A link to another page. `current` marks the page you are on. */
export type PageLink = { href: string; label: string; current?: boolean };

// A page’s side menu. Two kinds of item, never mixed in one list:
// - sections of this page: the one you are reading is marked with the blue line, and follows you as you scroll;
// - links to other pages (`links`): the page you are on is filled in, with the blue line, like the admin sidebar.
// On a wide screen it is a column beside the page that follows you down; on a narrow one the sections are a row of chips
// that stays under the header, and the page links a quieter row above them.
export default function SectionNav({ sections, links, label = "Sections of this page", linksLabel = "More", foot, className }: {
  sections: Jump[];
  links?: PageLink[];
  label?: string;
  /** The heading over the page links, shown on a wide screen when there are sections too. */
  linksLabel?: string;
  /** A line under the lists on a wide screen (a contact address); hidden on a narrow one. */
  foot?: React.ReactNode;
  className?: string;
}) {
  const [active, setActive] = useState(sections[0]?.id ?? "");
  const both = sections.length > 0 && Boolean(links?.length);

  const root = useRef<HTMLDivElement>(null);
  // The sections by name, so a list that is rebuilt with the same sections doesn't start watching again.
  const ids = sections.map((x) => x.id).join(" ");
  useEffect(() => {
    if (!sections.length) return;
    setActive((a) => (sections.some((x) => x.id === a) ? a : sections[0]?.id ?? ""));
    const seen = new Map<string, boolean>();
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) seen.set(e.target.id, e.isIntersecting);
      if (atBottom()) return;
      const first = sections.find((x) => seen.get(x.id));
      if (first) setActive(first.id);
    }, { rootMargin: "-20% 0px -65% 0px" });
    // A short last section can never reach the band above, so at the foot of the page it is the one marked.
    const atBottom = () => window.scrollY > 0 && window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
    const onScroll = () => { if (atBottom()) setActive(sections[sections.length - 1].id); };
    window.addEventListener("scroll", onScroll, { passive: true });
    // A section can arrive after the list does (a form that is still loading) or be put back in afresh, so the page is
    // watched for them: each is followed as soon as it is there, and again if it is replaced.
    const watched = new Map<string, Element>();
    const attach = () => {
      for (const x of sections) {
        const el = document.getElementById(x.id), was = watched.get(x.id);
        if (el === was) continue;
        if (was) { io.unobserve(was); watched.delete(x.id); seen.delete(x.id); }
        if (el) { io.observe(el); watched.set(x.id, el); }
      }
    };
    attach();
    let frame = 0;
    const mo = new MutationObserver(() => { cancelAnimationFrame(frame); frame = requestAnimationFrame(attach); });
    const around = root.current?.parentElement;
    if (around) mo.observe(around, { childList: true, subtree: true });
    return () => { cancelAnimationFrame(frame); mo.disconnect(); io.disconnect(); window.removeEventListener("scroll", onScroll); };
  }, [ids]); // eslint-disable-line react-hooks/exhaustive-deps

  const go = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.scrollMarginTop = "120px";
    el.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  };

  return (
    <div ref={root} className={`${s.side} ${className ?? ""}`}>
      {sections.length > 0 && (
        <nav className={s.nav} aria-label={label}>
          {both && <p className={s.groupName}>On this page</p>}
          <ol className={s.list}>
            {sections.map((x) => (
              <li key={x.id} className={s.item}>
                <button type="button" className={s.link} aria-current={active === x.id ? "true" : undefined} onClick={() => go(x.id)}>{x.label}</button>
              </li>
            ))}
          </ol>
        </nav>
      )}
      {links && links.length > 0 && (
        <nav className={s.pages} aria-label={linksLabel}>
          {both && <p className={s.groupName}>{linksLabel}</p>}
          <ul className={s.pageList}>
            {links.map((x) => (
              <li key={x.href}>
                <Link href={x.href} className={s.page} aria-current={x.current ? "page" : undefined}>{x.label}</Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
      {foot && <div className={s.foot}>{foot}</div>}
    </div>
  );
}
