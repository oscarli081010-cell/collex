import Link from "next/link";
import { formatRange, NA, type Conference } from "@/lib/conferences";
import s from "./board.module.css";

export default function ConferenceRow({ c }: { c: Conference }) {
  const d = c.startDate ? new Date(c.startDate + "T00:00:00") : null;
  const committees = c.committees.filter((x) => x.name !== NA).length;
  return (
    <Link href={`/conferences/${c.slug}`} className={s.row}>
      <span className={s.dateBlock} aria-hidden="true">
        <span className={s.dateMonth}>{d ? d.toLocaleDateString("en-AU", { month: "short" }) : "Date"}</span>
        <span className={`serif ${s.dateDay}`}>{d ? d.getDate() : NA}</span>
      </span>
      <span className={s.rowMain}>
        <span className={s.rowTitle}>
          <span className="serif">{c.name}</span>
          {c.isTemplate && <span className="badge accent">Example listing</span>}
        </span>
        <span className={s.rowMeta}>
          {formatRange(c)} · {c.host} · {c.venue}
        </span>
        <span className={s.rowTags}>
          <span className="badge">{c.level ?? `Level ${NA}`}</span>
          <span className="badge">{c.format ?? `Format ${NA}`}</span>
          <span className="badge">{committees ? `${committees} committees` : `Committees ${NA}`}</span>
          <span className="badge">Chair applications {NA}</span>
        </span>
      </span>
      <span className={s.go} aria-hidden="true">→</span>
    </Link>
  );
}
