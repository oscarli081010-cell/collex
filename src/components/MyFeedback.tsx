"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import s from "./MyFeedback.module.css";

// The marks and notes chairs have released to this delegate, from public.my_feedback() (migration 0042). Only the
// person's own; nobody else sees them. Shows nothing at all when there are none, or when the database doesn't have the
// function yet.
type Row = { conference: string; slug: string; committee: string; state: string; mark: number | null; note: string; released_at: string };

const date = (iso: string) => new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric", timeZone: "Australia/Sydney" });
const markText = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

export default function MyFeedback() {
  const [rows, setRows] = useState<Row[]>([]);
  useEffect(() => {
    if (!supabase) return;
    let live = true;
    supabase.rpc("my_feedback").then(({ data, error }) => {
      if (!live || error || !Array.isArray(data)) return; // missing function or no connection: show nothing
      setRows((data as Row[]).filter((r) => r && typeof r.state === "string"));
    }, () => { /* fail soft */ });
    return () => { live = false; };
  }, []);
  if (!rows.length) return null;
  return (
    <section className={`panel ${s.card}`} aria-labelledby="feedback-h">
      <div>
        <h2 id="feedback-h" className={s.title}>Feedback From Your Chairs</h2>
      </div>
      <p className={`muted ${s.intro}`}>Only you can see this.</p>
      <ul className={s.list}>
        {rows.map((r, i) => (
          <li key={`${r.slug}-${r.committee}-${r.state}-${i}`} className={s.item}>
            <span className={s.top}>
              <span className={s.where}>
                <strong>{r.slug ? <Link className="link" href={`/conferences/${r.slug}`}>{r.conference}</Link> : r.conference}</strong>
                <small>{[r.committee, r.state, r.released_at ? date(r.released_at) : ""].filter(Boolean).join(" · ")}</small>
              </span>
              {typeof r.mark === "number" && <span className={s.mark} aria-label={`Mark: ${markText(r.mark)} out of 10`}>{markText(r.mark)}<small> / 10</small></span>}
            </span>
            {r.note?.trim() && <p className={s.note}>{r.note}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}
