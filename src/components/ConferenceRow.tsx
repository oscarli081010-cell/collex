import Link from "next/link";
import { ViewTransition } from "react";
import { formatRange, monogram, type Conference } from "@/lib/conferences";
import RowAction from "./RowAction";
import Verified from "./Verified";
import { META_ICONS } from "./MetaIcons";
import s from "./board.module.css";

// The listing's photo, or its initials when it has none. It morphs into the conference page's cover on the way in.
export function Thumb({ c, size }: { c: Conference; size?: "sm" }) {
  return (
    <ViewTransition name={`cover-${c.slug}`} share="morph" default="none">
      <span className={`${s.thumb} ${size === "sm" ? s.thumbSm : ""}`} aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element -- organisers' photos come straight from storage */}
        {c.cover ? <img src={c.cover} alt="" loading="lazy" decoding="async" style={c.coverPos ? { objectPosition: c.coverPos } : undefined} /> : <span className="serif">{monogram(c)}</span>}
      </span>
    </ViewTransition>
  );
}

// A listing: the whole card opens the page; the two buttons go straight to applying (not once it has finished).
export default function ConferenceRow({ c, past = false }: { c: Conference; past?: boolean }) {
  const page = `/conferences/${c.slug}`;
  return (
    <div className={s.row}>
      <span className={s.lead}>
        <Thumb c={c} />
      </span>
      <div className={s.rowMain}>
        <span className={s.rowTitle}>
          <ViewTransition name={`title-${c.slug}`} share="morph" default="none">
            <Link href={page} className={`serif ${s.rowLink}`}>{c.name}</Link>
          </ViewTransition>
          {c.isTemplate && <span className="badge accent">Demo</span>}
          {c.verified && <Verified />}
        </span>
        <ul className={s.rowMeta}>
          <li>{META_ICONS.date}{formatRange(c)}</li>
          <li>{META_ICONS.host}{c.host}</li>
          <li>{META_ICONS.venue}{c.venue}</li>
        </ul>
      </div>
      <span className={s.rowActions}>
        {!past && (
          <span className={s.rowBtns}>
            <RowAction url={c.delegationUrl} label="Register" primary page={page} opensAt={c.delegationOpensAt} />
            <RowAction url={c.chairUrl} label="Apply to chair" primary={false} page={page} opensAt={c.chairOpensAt} />
          </span>
        )}
        <Link href={page} className={s.go} aria-label={`Open ${c.name}`}>→</Link>
      </span>
    </div>
  );
}
