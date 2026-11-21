"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

// A guide's side menu. The section you are reading is marked as you scroll, the way the conference page's tabs are.
// Pure links: clicking one scrolls there by the browser's own anchor handling (the smooth scroller also follows #links).
export default function GuideNav({ label, sections, className, chairs }: { label: string; sections: readonly { id: string; title: string }[]; className?: string; chairs?: boolean }) {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const onScroll = () => {
      let current: string | null = null;
      for (const { id } of sections) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top - 140 <= 0) current = id;
      }
      // At the very bottom the last section may never reach the top.
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) current = sections[sections.length - 1]?.id ?? current;
      setActive(current);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [sections]);

  return (
    <nav className={className} aria-label={label} data-guide-nav>
      <ul>
        {sections.map((x) => <li key={x.id}><a href={`#${x.id}`} aria-current={active === x.id ? "location" : undefined}>{x.title}</a></li>)}
        <li><Link href="/guides">All guides</Link></li>
        {chairs && <li><Link href="/chambers">Open Committees</Link></li>}
      </ul>
    </nav>
  );
}
