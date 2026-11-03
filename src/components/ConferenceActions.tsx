"use client";

import IconButton, { ICONS } from "./IconButton";
import { useToast } from "./useToast";
import { formatRange, type Conference } from "@/lib/conferences";
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
        : <IconButton label="Add to calendar" icon={ICONS.calendar} href={`/conferences/${c.slug}/calendar.ics`} download onClick={() => say("Calendar file downloaded")} />)}
      {node}
    </div>
  );
}
