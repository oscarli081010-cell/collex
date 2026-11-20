"use client";

import { useEffect, useRef, useState } from "react";
import s from "./SectionNav.module.css";

export type Jump = { id: string; label: string };

// A page's sections, with a way to jump to each one. On a wide screen it is a column beside them that follows you down
// the page; on a narrow one it is a row of chips that stays under the header.
export default function SectionNav({ sections }: { sections: Jump[] }) {
  const [active, setActive] = useState(sections[0]?.id ?? "");

  const nav = useRef<HTMLElement>(null);
  // The sections by name, so a list that is rebuilt with the same sections doesn't start watching again.
  const ids = sections.map((x) => x.id).join(" ");
  useEffect(() => {
    setActive((a) => (sections.some((x) => x.id === a) ? a : sections[0]?.id ?? ""));
    const seen = new Map<string, boolean>();
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) seen.set(e.target.id, e.isIntersecting);
      const first = sections.find((x) => seen.get(x.id));
      if (first) setActive(first.id);
    }, { rootMargin: "-20% 0px -65% 0px" });
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
    const around = nav.current?.parentElement;
    if (around) mo.observe(around, { childList: true, subtree: true });
    return () => { cancelAnimationFrame(frame); mo.disconnect(); io.disconnect(); };
  }, [ids]); // eslint-disable-line react-hooks/exhaustive-deps

  const go = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.scrollMarginTop = "120px";
    el.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  };

  return (
    <nav ref={nav} className={s.nav} aria-label="Sections of this page">
      <ol className={s.list}>
        {sections.map((x) => (
          <li key={x.id} className={s.item}>
            <button type="button" className={s.link} aria-current={active === x.id ? "true" : undefined} onClick={() => go(x.id)}>{x.label}</button>
          </li>
        ))}
      </ol>
    </nav>
  );
}
