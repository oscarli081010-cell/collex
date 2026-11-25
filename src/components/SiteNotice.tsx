"use client";

import Link from "next/link";
import { useAuth } from "./AuthProvider";
import s from "./SiteNotice.module.css";

export type Notice = { id: string; body: string; link_label: string | null; link_url: string | null; audience: "everyone" | "signed_in"; active?: boolean; created_at?: string };

const ARROW = <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 6h7M6.5 3l3 3-3 3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>;

/** The one line an admin puts at the top of the home page, as a quiet pill. A notice for signed-in people stays hidden
 *  for everyone else: before the login is checked it follows the page's first-paint hint, so it never flashes. */
export default function SiteNotice({ notice, preview = false }: { notice: Notice; preview?: boolean }) {
  const { ready, session } = useAuth();
  const gate = preview || notice.audience === "everyone" ? "all" : !ready ? "hint" : session ? "in" : "out";
  const url = notice.link_url;
  const inner = (
    <>
      <span className={s.dot} aria-hidden="true" />
      <span className={s.body}>{notice.body}</span>
      {notice.link_label && <span className={s.go}>{notice.link_label}{ARROW}</span>}
    </>
  );
  const props = { className: s.notice, "data-gate": gate };
  if (!url || preview) return <p {...props}>{inner}</p>;
  if (url.startsWith("/")) return <Link href={url} {...props}>{inner}</Link>;
  return <a href={url} target="_blank" rel="noopener noreferrer" {...props}>{inner}</a>;
}
