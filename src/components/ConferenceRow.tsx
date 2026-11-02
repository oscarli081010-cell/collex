import Link from "next/link";
import { formatRange, NA, type Conference } from "@/lib/conferences";
import s from "./board.module.css";

// A listing: the whole card opens the page; the two buttons go straight to applying.
export default function ConferenceRow({ c }: { c: Conference }) {
  const d = c.startDate ? new Date(c.startDate + "T00:00:00") : null;
  const page = `/conferences/${c.slug}`;
  const action = (url: string | null | undefined, label: string, primary: boolean) =>
    url ? (
      <a href={url} target="_blank" rel="noreferrer" className={`button ${primary ? "" : "secondary"} ${s.rowBtn}`}>{label}</a>
    ) : (
      <Link href={`${page}#apply`} className={`button ${primary ? "" : "secondary"} ${s.rowBtn}`}>{label}</Link>
    );

  return (
    <div className={s.row}>
      <span className={s.dateBlock} aria-hidden="true">
        <span className={s.dateMonth}>{d ? d.toLocaleDateString("en-AU", { month: "short" }) : "Date"}</span>
        <span className={`serif ${s.dateDay}`}>{d ? d.getDate() : NA}</span>
      </span>
      <span className={s.rowMain}>
        <span className={s.rowTitle}>
          <Link href={page} className={`serif ${s.rowLink}`}>{c.name}</Link>
          {c.isTemplate && <span className="badge accent">Demo</span>}
        </span>
        <span className={s.rowMeta}>{formatRange(c)} · {c.host} · {c.venue}</span>
      </span>
      <span className={s.rowActions}>
        {action(c.delegationUrl, "Register", true)}
        {action(c.chairUrl, "Apply to chair", false)}
        <Link href={page} className={s.go} aria-label={`Open ${c.name}`}>→</Link>
      </span>
    </div>
  );
}
