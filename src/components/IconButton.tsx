"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

// Round, icon-only buttons. Each names itself in a tooltip after a short hover (and on keyboard focus),
// and to screen readers through its label, e.g. "Delete user Sam Lee".
const icon = (d: React.ReactNode) => <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>;

export const ICONS = {
  trash: icon(<path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.2a1 1 0 001 .8h3.8a1 1 0 001-.8l.6-8.2M6.8 7v4M9.2 7v4" />),
  view: icon(<><path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z" /><circle cx="8" cy="8" r="2" /></>),
  hide: icon(<path d="M2 2l12 12M6.6 3.7A6.8 6.8 0 018 3.5c4 0 6.5 4.5 6.5 4.5a11 11 0 01-1.9 2.4M10.1 10.6A2.5 2.5 0 016 7.4M4 5.2A11 11 0 001.5 8S4 12.5 8 12.5c.9 0 1.7-.2 2.5-.5" />),
  publish: icon(<path d="M8 11V3M4.5 6.5L8 3l3.5 3.5M3 13.5h10" />),
  verify: icon(<><path d="M8 1.8l1.6 1.2 2-.1.6 1.9 1.6 1.2-.6 1.9.6 1.9-1.6 1.2-.6 1.9-2-.1L8 14.2l-1.6-1.2-2 .1-.6-1.9-1.6-1.2.6-1.9-.6-1.9 1.6-1.2.6-1.9 2 .1z" /><path d="M5.8 8.1l1.5 1.5 2.9-3" /></>),
  makeAdmin: icon(<><path d="M8 1.8l5 2v4c0 3.2-2.2 5.4-5 6.4-2.8-1-5-3.2-5-6.4v-4z" /><path d="M8 5.8v4M6 7.8h4" /></>),
  removeAdmin: icon(<><path d="M8 1.8l5 2v4c0 3.2-2.2 5.4-5 6.4-2.8-1-5-3.2-5-6.4v-4z" /><path d="M6 7.8h4" /></>),
  share: icon(<><path d="M8 10V2.5M5 5.5l3-3 3 3" /><path d="M5.5 7.5H4.5a1 1 0 00-1 1v4.5a1 1 0 001 1h7a1 1 0 001-1V8.5a1 1 0 00-1-1h-1" /></>),
  calendar: icon(<><rect x="2.5" y="3.5" width="11" height="10" rx="2" /><path d="M2.5 6.5h11M5.5 2v3M10.5 2v3" /></>),
  check: icon(<path d="M3 8.5l3.2 3.2L13 4.8" />),
  chart: icon(<path d="M3.5 13.5V8.5M8 13.5V3M12.5 13.5V6" />),
  manage: icon(<><path d="M6.5 4.5H13M6.5 8H13M6.5 11.5H13" /><path d="M3.2 4.5h.1M3.2 8h.1M3.2 11.5h.1" /></>),
  edit: icon(<path d="M10.5 2.5l3 3-7.5 7.5H3v-3zM9 4l3 3" />),
  up: icon(<path d="M8 12.5v-9M4.5 7L8 3.5 11.5 7" />),
  down: icon(<path d="M8 3.5v9M4.5 9L8 12.5 11.5 9" />),
  close: icon(<path d="M4 4l8 8M12 4l-8 8" />),
  undo: icon(<path d="M6 3.5L3 6.5l3 3M3 6.5h6.2a3.8 3.8 0 010 7.6H6.5" />),
  leave: icon(<><path d="M6.5 2.5h-3a1 1 0 00-1 1v9a1 1 0 001 1h3" /><path d="M10 5l3 3-3 3M13 8H6" /></>),
};

type Props = {
  id?: string; label: string; icon: React.ReactNode; onClick?: () => void; href?: string; pressed?: boolean; danger?: boolean; disabled?: boolean;
  /** The tooltip, when it should say more than the label (or less). */
  tip?: string;
  /** For a file link, such as a calendar download: a plain link with the download attribute. */
  download?: boolean;
};

export default function IconButton({ id, label, icon, onClick, href, pressed, danger, disabled, tip, download }: Props) {
  const cls = `button secondary iconbtn ${danger ? "iconbtn-danger" : ""}`;
  return (
    <span className="tip" data-tip={tip ?? label}>
      {href && download ? <a href={href} download className={cls} aria-label={label} onClick={onClick}>{icon}</a>
        : href ? <Link href={href} className={cls} aria-label={label}>{icon}</Link>
        : <button id={id} type="button" className={cls} onClick={onClick} aria-label={label} aria-pressed={pressed} disabled={disabled}>{icon}</button>}
    </span>
  );
}

// For something that can't be undone: the first click arms it (it turns red and says what a second click will do),
// a second click within three seconds does it.
export function ConfirmIconButton({ label, confirm, icon, onConfirm }: { label: string; confirm: string; icon: React.ReactNode; onConfirm: () => void }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <span className="tip" data-tip={armed ? confirm : label} data-tip-open={armed || undefined}>
      <button type="button" className={`button secondary iconbtn iconbtn-danger ${armed ? "is-armed" : ""}`} onClick={() => (armed ? onConfirm() : setArmed(true))} aria-label={armed ? confirm : label}>
        {icon}
      </button>
    </span>
  );
}
