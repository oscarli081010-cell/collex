"use client";

import Link from "next/link";
import { formatRange, todayInSydney } from "@/lib/conferences";
import { useConferences } from "@/components/ConferencesContext";
import s from "@/app/preview/home/home.module.css";

// The next few conferences, from the same list the calendar uses: a name and its dates per line, nothing more.
export default function NextUp() {
  const today = todayInSydney();
  const next = useConferences().filter((c) => c.startDate && (c.endDate ?? c.startDate) >= today).slice(0, 5);
  if (!next.length) return null;
  return (
    <ol className={s.nextList}>
      {next.map((c) => (
        <li key={c.id} data-rise>
          <Link href={`/conferences/${c.slug}`} className={s.nextRow}>
            <span className={`serif ${s.nextName}`}>{c.name}</span>
            <span className={s.nextWhen}>{formatRange(c)}</span>
            <svg className={s.nextArrow} width="18" height="18" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h9.5M8.5 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </Link>
        </li>
      ))}
    </ol>
  );
}
