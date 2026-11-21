"use client";

import Link from "next/link";
import { shortOpens, whenOpens } from "@/lib/schedule";
import { useOpen } from "./useOpen";
import s from "./board.module.css";

type Props = {
  url?: string | null; label: string; primary: boolean; page: string; opensAt?: string | null;
  // Collex's own form on the page: "timed" opens with the opening time, "always" whenever it's switched on.
  onCollex?: "timed" | "always" | null;
  // How the closed tooltip names it: "Registration isn't open yet".
  what: string; not: "isn't" | "aren't";
};

// One of a listing's two shortcut buttons, in the state the conference page shows. Open, it goes to the form (the
// organisers' link, or the page where Collex takes it). Not open, it stays in place, greyed out, and says why.
export default function RowAction({ url, label, primary, page, opensAt, onCollex, what, not }: Props) {
  const state = useOpen(opensAt);
  const cls = `button ${primary ? "" : "secondary"} ${s.rowBtn}`;
  if (url && state === "open") return <a href={url} target="_blank" rel="noreferrer" className={cls}>{label}</a>;
  if (onCollex === "always" || (onCollex === "timed" && state === "open")) return <Link href={page} className={cls}>{label}</Link>;
  // Before the browser has read the clock a timed button's state isn't known; hold its space so nothing jumps.
  if ((url || onCollex === "timed") && state === "unknown") return <span className={cls} aria-hidden="true" style={{ visibility: "hidden" }}>{label}</span>;
  const waiting = Boolean((url || onCollex === "timed") && opensAt) && state === "closed";
  return (
    <span className="tip" data-tip={waiting ? `Opens ${whenOpens(opensAt!)}` : `${what} ${not} open yet`} data-tip-align={primary ? "start" : undefined}>
      <button type="button" className={cls} aria-disabled="true" data-closed>{waiting ? `Opens ${shortOpens(opensAt!)}` : label}</button>
    </span>
  );
}
