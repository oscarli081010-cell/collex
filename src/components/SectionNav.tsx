"use client";

import { useEffect, useState } from "react";
import s from "./SectionNav.module.css";

export type Jump = { id: string; label: string };
export type GuideJump = { index: number; name: string; done: boolean };

// The form's sections, with a way to jump to each one. On a wide screen it sits in the margin beside the form and
// follows you down the page; on a narrow one it is a row of chips that stays under the header. "Background guides"
// opens a list of the committees, so a guide far down a long list is one tap away instead of a long scroll.
export default function SectionNav({ sections, spy, guides }: { sections: Jump[]; spy: Jump[]; guides: GuideJump[] }) {
  const [active, setActive] = useState(sections[0]?.id ?? "");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const seen = new Map<string, boolean>();
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) seen.set(e.target.id, e.isIntersecting);
      const first = spy.find((x) => seen.get(x.id));
      if (first) setActive(first.id);
    }, { rootMargin: "-20% 0px -65% 0px" });
    for (const x of spy) { const el = document.getElementById(x.id); if (el) io.observe(el); }
    return () => io.disconnect();
  }, [spy]);

  const reduce = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const go = (id: string, focus?: boolean) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.scrollMarginTop = "120px";
    el.scrollIntoView({ behavior: reduce() ? "auto" : "smooth", block: "start" });
    if (focus) setTimeout(() => el.focus({ preventScroll: true }), reduce() ? 0 : 350);
  };

  return (
    <nav className={s.nav} aria-label="Sections of this form">
      <ol className={s.list}>
        {sections.map((x) => {
          const isGuides = x.id === "sec-guides";
          return (
            <li key={x.id} className={s.item}>
              <button
                type="button" className={s.link} aria-current={active === x.id ? "true" : undefined}
                aria-expanded={isGuides && guides.length > 0 ? open : undefined}
                onClick={() => {
                  if (isGuides && guides.length > 0) { setOpen((o) => !o); return; }
                  go(isGuides ? "sec-committees" : x.id);
                }}
              >
                <span>{x.label}</span>
                {isGuides && guides.length > 0 && <svg className={s.chev} data-open={open} width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2.5 4.5L6 8l3.5-3.5" /></svg>}
              </button>
              {isGuides && guides.length > 0 && (
                <div className={s.sub} data-open={open}>
                  <ul>
                    {guides.map((g) => (
                      <li key={g.index}>
                        <button type="button" className={s.subLink} tabIndex={open ? 0 : -1} onClick={() => go(`committee-${g.index}-guide`, true)}>
                          <span className={s.dot} data-done={g.done} aria-hidden="true" />
                          <span className={s.subName}>{g.name}</span>
                          <span className="sr-only">{g.done ? ", guide added" : ", no guide yet"}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
