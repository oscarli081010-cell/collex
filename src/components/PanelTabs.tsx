"use client";

import { useRef } from "react";
import { usePill } from "./usePill";
import s from "@/app/auth.module.css";

export type PanelTab<T extends string> = { id: T; label: string; icon: React.ReactNode; /** A count shown on the tab, for something waiting. */ badge?: number; badgeNote?: string };

// The sliding two-or-more tab control used on the account page and when editing a listing. The panels it switches
// are the page's own: each needs id `${idPrefix}-panel-${id}` and aria-labelledby `${idPrefix}-tab-${id}`.
export default function PanelTabs<T extends string>({ tabs, tab, setTab, label, idPrefix }: { tabs: PanelTab<T>[]; tab: T; setTab: (t: T) => void; label: string; idPrefix: string }) {
  const box = useRef<HTMLDivElement>(null);
  const pill = usePill(box, '[aria-selected="true"]', tab);
  // Left and right move between the tabs, wrapping round.
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const at = tabs.findIndex((t) => t.id === tab);
    const next = tabs[(at + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length].id;
    setTab(next);
    box.current?.querySelector<HTMLElement>(`#${idPrefix}-tab-${next}`)?.focus();
  };
  return (
    <div ref={box} className={`${s.seg} ${tabs.length === 2 ? s.segTwo : ""} ${tabs.length > 3 ? s.segMany : ""}`} style={tabs.length > 3 ? { gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` } : undefined} role="tablist" aria-label={label} onKeyDown={onKey}>
      <span ref={pill} className={`t-pill ${s.segPill}`} aria-hidden="true" />
      {tabs.map((a) => (
        <button key={a.id} id={`${idPrefix}-tab-${a.id}`} type="button" role="tab" aria-selected={tab === a.id} aria-controls={`${idPrefix}-panel-${a.id}`}
          tabIndex={tab === a.id ? 0 : -1} onClick={() => setTab(a.id)} className={s.segIcon}>
          {a.icon}{a.label}
          {a.badge ? (<>
            <span className={s.segBadge} aria-hidden="true">{a.badge}</span>
            <span className="sr-only">, {a.badgeNote ?? `${a.badge} waiting`}</span>
          </>) : null}
        </button>
      ))}
    </div>
  );
}
