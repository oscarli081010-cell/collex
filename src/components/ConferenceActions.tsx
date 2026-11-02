"use client";

import { useEffect, useRef, useState } from "react";
import type { Conference } from "@/lib/conferences";
import s from "@/app/inner.module.css";

const icsDate = (iso: string, addDays = 0) => {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + addDays);
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
};

// Header actions on a conference page: save the dates, share the page.
export default function ConferenceActions({ c }: { c: Conference }) {
  const [toast, setToast] = useState<{ text: string; hiding: boolean } | null>(null);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const say = (text: string) => {
    timers.current.forEach(clearTimeout);
    setToast({ text, hiding: false });
    timers.current = [
      window.setTimeout(() => setToast((t) => t && { ...t, hiding: true }), 2200),
      window.setTimeout(() => setToast(null), 2550),
    ];
  };

  const addToCalendar = () => {
    if (!c.startDate) return;
    const ics = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Collex//EN", "BEGIN:VEVENT",
      `UID:${c.slug}@collex.au`,
      `DTSTART;VALUE=DATE:${icsDate(c.startDate)}`,
      `DTEND;VALUE=DATE:${icsDate(c.endDate ?? c.startDate, 1)}`,
      `SUMMARY:${c.name}`, `LOCATION:${c.venue}`, `URL:${location.href}`,
      "END:VEVENT", "END:VCALENDAR",
    ].join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
    a.download = `${c.slug}.ics`;
    a.click();
    URL.revokeObjectURL(a.href);
    say("Calendar file downloaded");
  };

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(location.href.split("#")[0]); say("Link copied"); }
    catch { say("Couldn't copy. Use the address bar instead."); }
  };

  const noDates = !c.startDate;
  return (
    <div className={s.confActions}>
      <button className="button secondary" onClick={copyLink}>
        <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"><path d="M6.5 9.5l3-3M7 4.5l1.2-1.2a2.8 2.8 0 014 4L11 8.5M9 11.5l-1.2 1.2a2.8 2.8 0 01-4-4L5 7.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
        Copy link
      </button>
      <span className={s.tip} data-tip={noDates ? "Available once dates are announced" : undefined}>
        <button className="button" onClick={addToCalendar} disabled={noDates}>
          <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"><rect x="2.5" y="3.5" width="11" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M2.5 6.5h11M5.5 2v3M10.5 2v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
          Add to calendar
        </button>
      </span>
      {toast && <div role="status" className={`t-toast${toast.hiding ? " is-hiding" : ""}`}>{toast.text}</div>}
    </div>
  );
}
