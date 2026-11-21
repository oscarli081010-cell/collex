import Link from "next/link";
import { ViewTransition } from "react";
import { formatRange, monogram, shown, type ConferenceSummary } from "@/lib/conferences";
import Photo from "./Photo";
import RowAction from "./RowAction";
import Verified from "./Verified";
import { META_ICONS } from "./MetaIcons";
import s from "./board.module.css";

// The listing's photo, or its initials when it has none. It morphs into the conference page's cover on the way in.
// A separate list photo (a logo, say) doesn't morph, since it isn't the photo the page opens on.
export function Thumb({ c, size }: { c: ConferenceSummary; size?: "sm" }) {
  const src = c.thumb ?? c.cover;
  const pos = c.thumb ? c.thumbPos : c.coverPos;
  const box = (
    <span className={`${s.thumb} ${size === "sm" ? s.thumbSm : ""}`} aria-hidden="true">
      {src ? <Photo src={src} alt="" width={160} height={160} sizes="80px" style={pos ? { objectPosition: pos } : undefined} /> : <span className="serif">{monogram(c)}</span>}
    </span>
  );
  return c.thumb ? box : <ViewTransition name={`cover-${c.slug}`} share="morph" default="none">{box}</ViewTransition>;
}

// A listing: the whole card opens the page; the two buttons go straight to applying (not once it has finished).
export default function ConferenceRow({ c, past = false }: { c: ConferenceSummary; past?: boolean }) {
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
          <li>{META_ICONS.host}{shown(c.host)}</li>
          <li>{META_ICONS.venue}{shown(c.venue)}</li>
        </ul>
      </div>
      <span className={s.rowActions}>
        {!past && (
          <span className={s.rowBtns}>
            <RowAction url={c.delegationUrl} onCollex={c.collexRegistration && !c.delegationUrl ? "timed" : null} label="Register" name={`Register for ${c.name}`} what="Registration" not="isn't" primary page={page} opensAt={c.delegationOpensAt} />
            <RowAction url={c.chairUrl} onCollex={c.collexApplications && c.id ? "always" : null} label="Apply to Chair" name={`Apply to Chair for ${c.name}`} what="Chair applications" not="aren't" primary={false} page={page} opensAt={c.chairOpensAt} />
          </span>
        )}
        <Link href={page} className={s.go} aria-label={`Open ${c.name}`}>→</Link>
      </span>
    </div>
  );
}
