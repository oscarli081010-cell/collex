"use client";

import { useEffect, useState } from "react";
import s from "./SectionNav.module.css";

export type Jump = { id: string; label: string };

// The form's sections, with a way to jump to each one. On a wide screen it sits in the margin beside the form and
// follows you down the page; on a narrow one it is a row of chips that stays under the header.
export default function SectionNav({ sections }: { sections: Jump[] }) {
  const [active, setActive] = useState(sections[0]?.id ?? "");

  useEffect(() => {
    const seen = new Map<string, boolean>();
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) seen.set(e.target.id, e.isIntersecting);
      const first = sections.find((x) => seen.get(x.id));
      if (first) setActive(first.id);
    }, { rootMargin: "-20% 0px -65% 0px" });
    for (const x of sections) { const el = document.getElementById(x.id); if (el) io.observe(el); }
    return () => io.disconnect();
  }, [sections]);

  const go = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.scrollMarginTop = "120px";
    el.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  };

  return (
    <nav className={s.nav} aria-label="Sections of this form">
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
