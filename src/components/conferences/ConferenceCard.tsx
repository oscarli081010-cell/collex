"use client";

import Link from "next/link";
import { ViewTransition } from "react";
import { formatRange, MONTHS, shown, type ConferenceSummary } from "@/lib/conferences";
import { shortOpens } from "@/lib/schedule";
import Photo from "@/components/Photo";
import { useOpen } from "@/components/useOpen";
import inner from "@/app/inner.module.css";
import g from "./conferences.module.css";

const mon = (iso: string) => MONTHS[Number(iso.slice(5, 7)) - 1].slice(0, 3);
const day = (iso: string) => String(Number(iso.slice(8, 10)));

// The card's date block: the day (or days) large, the month and year under it. "12–14" over "Mar 2027".
function dateBlock(c: ConferenceSummary): { days: string; month: string } {
  const a = c.startDate, b = c.endDate && c.endDate !== c.startDate ? c.endDate : null;
  if (!a) return { days: "TBA", month: "Date" };
  if (!b) return { days: day(a), month: `${mon(a)} ${a.slice(0, 4)}` };
  const sameMonth = a.slice(0, 7) === b.slice(0, 7);
  const sameYear = a.slice(0, 4) === b.slice(0, 4);
  return {
    days: `${day(a)}–${day(b)}`,
    month: sameMonth ? `${mon(a)} ${a.slice(0, 4)}` : sameYear ? `${mon(a)}–${mon(b)} ${a.slice(0, 4)}` : `${mon(a)} ${a.slice(2, 4)}–${mon(b)} ${b.slice(2, 4)}`,
  };
}

// The name as it fits on one line of a card: the long phrases shortened, and the year dropped when the date block shows it.
// "UN Youth New South Wales State Conference 2027" → "UN Youth NSW State Conference".
const shorten = (s: string) => s.replace(/Model United Nations/gi, "MUN").replace(/New South Wales/gi, "NSW").replace(/\s+/g, " ").trim();
function cardName(c: ConferenceSummary): string {
  let n = shorten(c.name);
  const year = c.startDate?.slice(0, 4);
  if (year) n = n.replace(new RegExp(`\\s*(?:${year}|['’]${year.slice(2)})$`), "").trim() || n;
  return n;
}

/** `short` is what a phone card shows, where the strip is narrow. */
type Status = { open: boolean; text: string; short?: string };

// Whether registration or chair applications are open, the way the listing's own buttons work it out. Open is said
// plainly; otherwise a quiet line says when it opens, if the organisers scheduled it.
function useStatus(c: ConferenceSummary, today: string): Status | null {
  const reg = useOpen(c.delegationOpensAt);
  const chair = useOpen(c.chairOpensAt);
  if (c.startDate && c.startDate <= today && (c.endDate ?? c.startDate) >= today) return { open: true, text: "On now" };
  const regLive = Boolean(c.delegationUrl || c.collexRegistration);
  const chairLive = Boolean(c.chairUrl);
  const regOpen = regLive && reg === "open";
  const chairOpen = (chairLive && chair === "open") || Boolean(c.collexApplications && c.id);
  if (regOpen && chairOpen) return { open: true, text: "Registration and chairs open", short: "Reg. and chairs open" };
  if (regOpen) return { open: true, text: "Registration open" };
  if (chairOpen) return { open: true, text: "Chair applications open", short: "Chair apps open" };
  // Before the browser has read the clock a scheduled opening isn't known yet: say nothing rather than the wrong thing.
  if ((regLive && reg === "unknown") || (chairLive && chair === "unknown")) return null;
  if (regLive && c.delegationOpensAt) return { open: false, text: `Registration opens ${shortOpens(c.delegationOpensAt)}` };
  if (chairLive && c.chairOpensAt) return { open: false, text: `Chair applications open ${shortOpens(c.chairOpensAt)}` };
  // No link and no opening date posted: nothing is known about applications, so the strip just leads to the page.
  return { open: false, text: "View conference \u2192" };
}

// A square-ish card: the photo with the date on it, the name and host, and a strip saying whether applications are open.
// The whole card opens the conference's page.
export default function ConferenceCard({ c, today }: { c: ConferenceSummary; today: string }) {
  const page = `/conferences/${c.slug}`;
  const { days, month } = dateBlock(c);
  const status = useStatus(c, today);
  const name = cardName(c);
  const src = c.cover ?? c.thumb;
  const pos = c.cover ? c.coverPos : c.thumbPos;

  // No photo: the same striped wash a conference page's cover shows, without the initials.
  const media = (
    <span className={g.media} aria-hidden="true">
      {src
        ? <Photo src={src} alt="" fill sizes="(max-width: 720px) 50vw, 320px" style={pos ? { objectPosition: pos, objectFit: "cover" } : { objectFit: "cover" }} />
        : <span className={inner.coverMark} />}
    </span>
  );

  return (
    <article className={g.card} data-open={status?.open || undefined}>
      <div className={g.top}>
        {c.thumb && !c.cover ? media : <ViewTransition name={`cover-${c.slug}`} share="morph" default="none">{media}</ViewTransition>}
        <span className={g.date} aria-hidden="true">
          <span className={`serif ${g.days}`}>{days}</span>
          <span className={g.month}>{month}</span>
        </span>
      </div>
      <div className={g.body}>
        <h2 className={g.name}>
          <Link href={page} className={`serif ${g.link}`} title={name !== c.name ? c.name : undefined} aria-label={c.name}>{name}</Link>
        </h2>
        <p className={g.host}>
          <span className="sr-only">{formatRange(c)}, hosted by </span>
          <span className={g.hostName} title={shown(c.host)}>{shorten(shown(c.host))}</span>
          {c.verified && (
            <span className={`tip ${g.verified}`} data-tip="Verified: listed by the conference's own secretariat, checked by Collex" data-tip-align="end">
              <span className={g.tick} role="img" aria-label="Verified: listed by the conference's own secretariat, checked by Collex">
                <svg width="10" height="10" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 6.2l2.3 2.3 4.7-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </span>
            </span>
          )}
          {c.isTemplate && <span className="badge accent">Demo</span>}
        </p>
      </div>
      <p className={g.strip} data-open={status?.open || undefined}>
        {status?.open && <span className={g.dot} aria-hidden="true" />}
        {status?.short ? (
          <span className={g.stripText} title={status.text}>
            <span className={g.long}>{status.text}</span>
            <span className={g.short} aria-hidden="true">{status.short}</span>
          </span>
        ) : <span className={g.stripText}>{status?.text ?? "\u00a0"}</span>}
      </p>
    </article>
  );
}
