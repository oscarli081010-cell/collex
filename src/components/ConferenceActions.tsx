"use client";

import { useEffect, useRef, useState } from "react";
import IconButton, { ICONS } from "./IconButton";
import { useToast } from "./useToast";
import { formatRange, type Conference } from "@/lib/conferences";
import { googleCalendarUrl } from "@/lib/ics";
import s from "@/app/inner.module.css";

// Header actions on a conference page: share the page, save the dates. Round icon buttons, named by tooltip and label.
export default function ConferenceActions({ c, past = false }: { c: Conference; past?: boolean }) {
  const { say, node } = useToast();

  // The phone's own share sheet where there is one; otherwise the link goes on the clipboard.
  const share = async () => {
    const url = location.href.split("#")[0];
    if (navigator.share) {
      try { return await navigator.share({ title: c.name, text: c.startDate ? `${c.name}, ${formatRange(c)}` : c.name, url }); }
      catch (e) { if ((e as Error).name === "AbortError") return; }
    }
    try { await navigator.clipboard.writeText(url); say("Link copied"); }
    catch { say("Couldn't copy. Use the address bar instead."); }
  };

  const noDates = !c.startDate || c.isTemplate;
  return (
    <div className={s.confActions}>
      <IconButton label={`Share ${c.name}`} tip="Share" icon={ICONS.share} onClick={share} />
      {!past && (noDates
        ? <IconButton label="Add to calendar" tip="Add to calendar once dates are announced" icon={ICONS.calendar} disabled />
        : <CalendarMenu c={c} onFile={() => say("Calendar file downloaded")} />)}
      {node}
    </div>
  );
}

// "Add to calendar" opens a small menu: Google Calendar, or a .ics file for Apple, Outlook and the rest.
function CalendarMenu({ c, onFile }: { c: Conference; onFile: () => void }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); box.current?.querySelector("button")?.focus(); } };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc); };
  }, [open]);

  return (
    <span ref={box} className={s.calMenu}>
      <span className="tip" data-tip={open ? "" : "Add to calendar"}>
        <button type="button" className="button secondary iconbtn" aria-label="Add to calendar" aria-expanded={open} aria-controls="cal-menu" onClick={() => setOpen((o) => !o)}>
          {ICONS.calendar}
        </button>
      </span>
      <div id="cal-menu" className={`t-dropdown ${s.calPop} ${open ? "is-open" : ""}`} data-origin="top-right" inert={!open}>
        <a href={googleCalendarUrl(c)} target="_blank" rel="noreferrer" tabIndex={open ? 0 : -1} onClick={() => setOpen(false)}>Google Calendar</a>
        <a href={`/conferences/${c.slug}/calendar.ics`} download tabIndex={open ? 0 : -1} onClick={() => { setOpen(false); onFile(); }}>Apple or Outlook (.ics)</a>
      </div>
    </span>
  );
}
