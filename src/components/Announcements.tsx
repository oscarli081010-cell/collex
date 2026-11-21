"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import s from "@/app/inner.module.css";
import an from "./Announcements.module.css";

export type Announcement = { id: string; body: string; created_at: string };

const TZ = "Australia/Sydney";
// At most this many are read; the newest few show, and the rest wait behind "Show older".
const KEEP = 20;
const FIRST = 3;

const sydneyDay = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: TZ });

/** "Today, 12:05 pm" for something posted today in Sydney, otherwise "Sat 28 Nov, 9:10 am". Built from parts, so it reads
 *  the same whatever the browser's own way of writing times is. */
export function postedAt(iso: string, now = new Date()) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-AU", {
    timeZone: TZ, hourCycle: "h23", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  }).formatToParts(d).map((x) => [x.type, x.value]));
  const h = Number(p.hour);
  const time = `${h % 12 || 12}:${p.minute} ${h < 12 ? "am" : "pm"}`;
  return sydneyDay(d) === sydneyDay(now) ? `Today, ${time}` : `${p.weekday} ${p.day} ${p.month}, ${time}`;
}

// Short notes from the organisers, newest first, at the top of a conference's page. Read again every minute while the
// page is in view, and as soon as it comes back into view, so a note posted on the day reaches people already on it.
// Nothing at all is drawn until there is something to show, so a conference without any looks exactly as before.
export default function Announcements({ id }: { id?: string }) {
  const [list, setList] = useState<Announcement[]>([]);
  const [all, setAll] = useState(false);
  // Only the latest read counts: an older one that answers late can't put back a note that was since deleted.
  const turn = useRef(0);

  const load = useCallback(() => {
    if (!supabase || !id) return;
    const at = ++turn.current;
    supabase.from("announcements").select("id, body, created_at").eq("conference_id", id)
      .order("created_at", { ascending: false }).limit(KEEP)
      .then(({ data, error }) => {
        // A failed refresh keeps what is on screen.
        if (at !== turn.current || error) return;
        setList((data as Announcement[] | null) ?? []);
      });
  }, [id]);

  useEffect(() => {
    load();
    const tick = setInterval(() => { if (document.visibilityState === "visible") load(); }, 60_000);
    const back = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", back);
    return () => { clearInterval(tick); document.removeEventListener("visibilitychange", back); };
  }, [load]);

  if (!id || list.length === 0) return null;
  const shown = all ? list : list.slice(0, FIRST);
  return (
    <section className={an.wrap} aria-labelledby="announcements-h">
      <h2 id="announcements-h" className={s.h2}>Announcements</h2>
      <ul className={`panel ${an.list}`}>
        {shown.map((x) => (
          <li key={x.id}>
            <p className={an.body}>{x.body}</p>
            <time className={an.when} dateTime={x.created_at}>{postedAt(x.created_at)}</time>
          </li>
        ))}
      </ul>
      {!all && list.length > FIRST && (
        <button type="button" className={`button secondary block ${an.more}`} onClick={() => setAll(true)}>Show older</button>
      )}
    </section>
  );
}
