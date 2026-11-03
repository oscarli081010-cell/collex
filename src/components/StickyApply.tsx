"use client";

import { useEffect, useState } from "react";
import { formatRange, type Conference } from "@/lib/conferences";
import s from "@/app/inner.module.css";

// Phones only: once the Register card has scrolled away, a slim bar keeps the main action in reach.
// It steps aside again near the footer, so it never covers the last of the page.
export default function StickyApply({ c }: { c: Conference }) {
  const [past, setPast] = useState(false);
  const [atFoot, setAtFoot] = useState(false);

  useEffect(() => {
    const band = document.getElementById("apply");
    const foot = document.querySelector("footer");
    if (!band) return;
    // Shown only once the cards are above the screen, not while they're still below it on arrival.
    const io = new IntersectionObserver(([e]) => setPast(!e.isIntersecting && e.boundingClientRect.top < 0));
    const fo = new IntersectionObserver(([e]) => setAtFoot(e.isIntersecting));
    io.observe(band);
    if (foot) fo.observe(foot);
    return () => { io.disconnect(); fo.disconnect(); };
  }, []);

  const shown = past && !atFoot;
  return (
    <div className={s.stickyApply} data-shown={shown} aria-hidden={!shown} inert={!shown}>
      <div className={s.stickyText}>
        <span className={s.stickyName}>{c.name}</span>
        <span className={s.stickyWhen}>{c.startDate ? formatRange(c) : `Hosted by ${c.host}`}</span>
      </div>
      {c.delegationUrl
        ? <a href={c.delegationUrl} className="button" target="_blank" rel="noreferrer">Register →</a>
        : <a href="#apply" className="button">Express interest</a>}
    </div>
  );
}
