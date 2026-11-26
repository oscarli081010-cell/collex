"use client";

import Link from "next/link";
import { ViewTransition } from "react";
import { formatRange, MONTHS, monogram, shown, type ConferenceSummary } from "@/lib/conferences";
import { shortOpens } from "@/lib/schedule";
import Photo from "@/components/Photo";
import { useOpen } from "@/components/useOpen";
import g from "@/app/preview/conferences/conferences.module.css";

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

// One quiet status, the way the listing's own buttons would read: on now, registration open, or when it opens.
function useStatus(c: ConferenceSummary, today: string): { text: string; tone: "ok" | "plain" } | null {
  const reg = useOpen(c.delegationOpensAt);
  const chair = useOpen(c.chairOpensAt);
  if (c.startDate && c.startDate <= today && (c.endDate ?? c.startDate) >= today) return { text: "On now", tone: "ok" };
  const regLive = Boolean(c.delegationUrl || c.collexRegistration);
  if (regLive && reg === "open") return { text: "Registration open", tone: "ok" };
  if ((c.chairUrl && chair === "open") || (c.collexApplications && c.id)) return { text: "Chair applications open", tone: "ok" };
  if (regLive && c.delegationOpensAt && reg === "closed") return { text: `Opens ${shortOpens(c.delegationOpensAt)}`, tone: "plain" };
  return null;
}

// A square-ish card: the photo with the date on it, the name, the host, and small labels. The whole card opens the page.
export default function ConferenceCard({ c, today }: { c: ConferenceSummary; today: string }) {
  const page = `/conferences/${c.slug}`;
  const { days, month } = dateBlock(c);
  const status = useStatus(c, today);
  const src = c.cover ?? c.thumb;
  const pos = c.cover ? c.coverPos : c.thumbPos;

  const media = (
    <span className={g.media} aria-hidden="true">
      {src
        ? <Photo src={src} alt="" fill sizes="(max-width: 720px) 50vw, 320px" style={pos ? { objectPosition: pos, objectFit: "cover" } : { objectFit: "cover" }} />
        : <span className={`serif ${g.mono}`}>{monogram(c)}</span>}
    </span>
  );

  return (
    <article className={g.card}>
      <div className={g.top}>
        {c.cover ? <ViewTransition name={`cover-${c.slug}`} share="morph" default="none">{media}</ViewTransition> : media}
        <span className={g.date} aria-hidden="true">
          <span className={`serif ${g.days}`}>{days}</span>
          <span className={g.month}>{month}</span>
        </span>
      </div>
      <div className={g.body}>
        <h2 className={g.name}>
          <ViewTransition name={`title-${c.slug}`} share="morph" default="none">
            <Link href={page} className={`serif ${g.link}`}>{c.name}</Link>
          </ViewTransition>
        </h2>
        <p className={g.host}><span className="sr-only">{formatRange(c)}, hosted by </span>{shown(c.host)}</p>
        <div className={g.labels}>
          {c.verified && (
            <span className={`tip ${g.verified}`} data-tip="Verified: listed by the conference's own secretariat, checked by Collex" data-tip-align="start">
              <span className="badge accent" role="img" aria-label="Verified: listed by the conference's own secretariat, checked by Collex">
                <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 6.2l2.3 2.3 4.7-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </span>
            </span>
          )}
          {c.isTemplate && <span className="badge accent">Demo</span>}
          {status && <span className={`badge ${g.status} ${status.tone === "ok" ? g.ok : ""}`} title={status.text}>{status.text}</span>}
          {c.level && <span className={g.level}>{c.level}</span>}
        </div>
      </div>
    </article>
  );
}
