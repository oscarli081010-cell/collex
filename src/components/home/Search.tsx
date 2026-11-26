"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import s from "./home.module.css";

// The hero's search, the same plain form as the current home page's, with its own focus: the field lifts a little, an
// accent ring grows in around it with a soft glow underneath, a sheen crosses it once (after Watermelon's Reveal Copy),
// and the icon and go button take the accent colour.
export default function Search() {
  const router = useRouter();
  const [q, setQ] = useState("");
  return (
    <form action="/conferences" method="get" role="search" className={s.search}
      onSubmit={(e) => { e.preventDefault(); const t = q.trim(); router.push(t ? `/conferences?q=${encodeURIComponent(t)}` : "/conferences"); }}>
      <span className={s.searchShine} aria-hidden="true" />
      <label htmlFor="home-q" className="sr-only">Search conferences or schools</label>
      <svg className={s.searchIcon} width="18" height="18" viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="4.6" fill="none" stroke="currentColor" strokeWidth="1.4" /><path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
      <input id="home-q" name="q" type="search" className={s.searchInput} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search conferences" autoComplete="off" enterKeyHint="search" />
      <button type="submit" className={s.searchGo} aria-label="Search">
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h9.5M8.5 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
    </form>
  );
}
