import Link from "next/link";
import { ViewTransition } from "react";
import { formatRange, monogram, NA, type Conference } from "@/lib/conferences";
import Countdown from "./Countdown";
import Verified from "./Verified";
import { META_ICONS } from "./MetaIcons";
import s from "./board.module.css";

// The listing's photo, or its initials when it has none. It morphs into the conference page's cover on the way in.
export function Thumb({ c, size }: { c: Conference; size?: "sm" }) {
  return (
    <ViewTransition name={`cover-${c.slug}`} share="morph" default="none">
      <span className={`${s.thumb} ${size === "sm" ? s.thumbSm : ""}`} aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element -- organisers' photos come straight from storage */}
        {c.cover ? <img src={c.cover} alt="" loading="lazy" decoding="async" /> : <span className="serif">{monogram(c)}</span>}
      </span>
    </ViewTransition>
  );
}

// A listing: the whole card opens the page; the two buttons go straight to applying (not once it has finished).
export default function ConferenceRow({ c, past = false }: { c: Conference; past?: boolean }) {
  const d = c.startDate ? new Date(c.startDate + "T00:00:00") : null;
  const page = `/conferences/${c.slug}`;
  const action = (url: string | null | undefined, label: string, primary: boolean) =>
    url ? (
      <a href={url} target="_blank" rel="noreferrer" className={`button ${primary ? "" : "secondary"} ${s.rowBtn}`}>{label}</a>
    ) : (
      <Link href={page} className={`button ${primary ? "" : "secondary"} ${s.rowBtn}`}>{label}</Link>
    );

  return (
    <div className={s.row}>
      <span className={s.lead}>
        <Thumb c={c} />
        <span className={s.dateBlock} aria-hidden="true">
          <span className={s.dateMonth}>{d ? d.toLocaleDateString("en-AU", { month: "short" }) : "Date"}</span>
          <span className={`serif ${s.dateDay}`}>{d ? d.getDate() : NA}</span>
        </span>
      </span>
      <div className={s.rowMain}>
        <span className={s.rowTitle}>
          <ViewTransition name={`title-${c.slug}`} share="morph" default="none">
            <Link href={page} className={`serif ${s.rowLink}`}>{c.name}</Link>
          </ViewTransition>
          {c.isTemplate && <span className="badge accent">Demo</span>}
          {c.verified && <Verified />}
          <Countdown c={c} />
        </span>
        <ul className={s.rowMeta}>
          <li>{META_ICONS.date}{formatRange(c)}</li>
          <li>{META_ICONS.host}{c.host}</li>
          <li>{META_ICONS.venue}{c.venue}</li>
        </ul>
      </div>
      <span className={s.rowActions}>
        {!past && action(c.delegationUrl, "Register", true)}
        {!past && action(c.chairUrl, "Apply to chair", false)}
        <Link href={page} className={s.go} aria-label={`Open ${c.name}`}>→</Link>
      </span>
    </div>
  );
}
