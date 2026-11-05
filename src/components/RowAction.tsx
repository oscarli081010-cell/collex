"use client";

import Link from "next/link";
import { shortOpens } from "@/lib/schedule";
import { useOpen } from "./useOpen";
import s from "./board.module.css";

// One of a listing's two shortcut buttons. Scheduled to open later, it says when and sends people to the page instead.
export default function RowAction({ url, label, primary, page, opensAt }: { url?: string | null; label: string; primary: boolean; page: string; opensAt?: string | null }) {
  const state = useOpen(opensAt);
  const cls = `button ${primary ? "" : "secondary"} ${s.rowBtn}`;
  if (url && state === "open") return <a href={url} target="_blank" rel="noreferrer" className={cls}>{label}</a>;
  if (url && state === "unknown") return <span className={cls} aria-hidden="true" style={{ visibility: "hidden" }}>{label}</span>;
  return <Link href={page} className={cls}>{url && opensAt ? `Opens ${shortOpens(opensAt)}` : label}</Link>;
}
