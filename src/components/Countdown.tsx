"use client";

import { useEffect, useState } from "react";
import type { Conference } from "@/lib/conferences";

const DAY = 86_400_000;
const midnight = (iso: string) => new Date(iso + "T00:00:00").getTime();
const when = (n: number) => (n === 0 ? "today" : n === 1 ? "tomorrow" : `in ${n} days`);

// What happens next for a conference, from its real dates only. Worked out in the browser so it is
// always counted from today, not from when the page was built.
export function nextMoment(c: Conference, now = Date.now()): { text: string; live?: boolean } | null {
  const d = new Date(now);
  const today = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  if (!c.startDate) return null;
  const start = midnight(c.startDate), end = midnight(c.endDate ?? c.startDate);
  if (today >= start && today <= end) return { text: "Happening now", live: true };
  if (today > end) return null;
  const upcoming = c.keyDates
    .filter((k) => k.date && midnight(k.date) >= today && midnight(k.date) < start)
    .sort((a, b) => midnight(a.date!) - midnight(b.date!))[0];
  if (upcoming) {
    const n = Math.round((midnight(upcoming.date!) - today) / DAY);
    if (n <= 30) return { text: `${upcoming.label} ${when(n)}` };
  }
  const n = Math.round((start - today) / DAY);
  return { text: n <= 60 ? `Starts ${when(n)}` : `Starts in ${Math.round(n / 7)} weeks` };
}

export default function Countdown({ c, large = false }: { c: Conference; large?: boolean }) {
  const [m, setM] = useState<ReturnType<typeof nextMoment>>(null);
  useEffect(() => { setM(nextMoment(c)); }, [c]);
  if (!m || c.isTemplate) return null;
  return <span className={`countdown ${large ? "lg" : ""}`} data-live={m.live ?? false}>{m.text}</span>;
}
