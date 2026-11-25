"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import s from "@/app/home.module.css";

// The home page's front door: type a conference or a school, press Enter, and land on Conferences with that search.
// A plain form underneath, so it still works before the page's script has loaded.
export default function HeroSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");
  return (
    <form action="/conferences" method="get" role="search" className={s.search}
      onSubmit={(e) => { e.preventDefault(); const t = q.trim(); router.push(t ? `/conferences?q=${encodeURIComponent(t)}` : "/conferences"); }}>
      <label htmlFor="hero-q" className="sr-only">Search conferences or schools</label>
      <svg className={s.searchIcon} width="18" height="18" viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="4.6" fill="none" stroke="currentColor" strokeWidth="1.4" /><path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
      <input id="hero-q" name="q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search conferences" autoComplete="off" enterKeyHint="search" />
      <button type="submit" className={s.searchGo} aria-label="Search">
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h9.5M8.5 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
    </form>
  );
}
