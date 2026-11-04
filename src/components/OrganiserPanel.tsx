"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { todayInSydney, type Conference } from "@/lib/conferences";
import { supabase } from "@/lib/supabase";
import { useAuth } from "./AuthProvider";
import InterestChart, { type Week } from "./InterestChart";
import s from "@/app/inner.module.css";

type Count = { conference_id: string; interested: number };
type WeekRow = { conference_id: string; week: string; interested: number };

// Shown only to the people who run this listing (and admins): interest over time and a way to edit.
// The database only returns numbers for listings the caller edits, so nobody else ever sees this.
export default function OrganiserPanel({ c }: { c: Conference }) {
  const { session } = useAuth();
  const [data, setData] = useState<{ total: number; weeks: Week[] } | null>(null);

  useEffect(() => {
    if (!session || !supabase || !c.id) return setData(null);
    Promise.all([supabase.rpc("interest_counts"), supabase.rpc("interest_weekly")]).then(([counts, weekly]) => {
      const row = (counts.data as Count[] | null)?.find((r) => r.conference_id === c.id);
      if (!row) return setData(null);
      const weeks = ((weekly.data as WeekRow[] | null) ?? []).filter((w) => w.conference_id === c.id).map((w) => ({ week: w.week, interested: Number(w.interested) }));
      setData({ total: Number(row.interested), weeks });
    });
  }, [c.id, session]);

  if (!data || c.interestUrl) return null; // with their own form, Collex has no count to show
  return (
    <section className={`t-reveal panel ${s.organiser}`} aria-labelledby="organiser-h">
      <div className={s.organiserText}>
        <h2 id="organiser-h" className={s.organiserTitle}>Interest over time</h2>
        <p className="muted">Only the people who run this listing see this. It never shows who.</p>
        <Link href={`/list?edit=${c.id}`} className="button secondary">Edit listing</Link>
      </div>
      <InterestChart weeks={data.weeks} total={data.total} today={todayInSydney()} />
    </section>
  );
}
