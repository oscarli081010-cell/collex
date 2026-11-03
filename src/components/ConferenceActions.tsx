"use client";

import { useToast } from "./useToast";
import type { Conference } from "@/lib/conferences";
import s from "@/app/inner.module.css";

const CAL_ICON = <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><rect x="2.5" y="3.5" width="11" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M2.5 6.5h11M5.5 2v3M10.5 2v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>;

// Header actions on a conference page: share the page, save the dates. Round icon buttons, named by tooltip and label.
export default function ConferenceActions({ c }: { c: Conference }) {
  const { say, node } = useToast();

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(location.href.split("#")[0]); say("Link copied"); }
    catch { say("Couldn't copy. Use the address bar instead."); }
  };

  const noDates = !c.startDate;
  return (
    <div className={s.confActions}>
      <span className={s.tip} data-tip="Copy link">
        <button className={`button secondary ${s.iconBtn}`} onClick={copyLink} aria-label="Copy link">
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M6.5 9.5l3-3M7 4.5l1.2-1.2a2.8 2.8 0 014 4L11 8.5M9 11.5l-1.2 1.2a2.8 2.8 0 01-4-4L5 7.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
        </button>
      </span>
      <span className={s.tip} data-tip={noDates ? "Add to calendar once dates are announced" : "Add to calendar"}>
        {noDates || c.isTemplate ? (
          <button className={`button secondary ${s.iconBtn}`} disabled aria-label="Add to calendar">{CAL_ICON}</button>
        ) : (
          <a className={`button secondary ${s.iconBtn}`} href={`/conferences/${c.slug}/calendar.ics`} download aria-label="Add to calendar" onClick={() => say("Calendar file downloaded")}>{CAL_ICON}</a>
        )}
      </span>
      {node}
    </div>
  );
}
