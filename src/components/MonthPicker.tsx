"use client";

import { useEffect, useId, useRef, useState } from "react";
import { MONTHS } from "@/lib/conferences";
import s from "./MonthPicker.module.css";

export type YM = { y: number; m: number };

export function shiftMonth({ y, m }: YM, n: number): YM {
  const t = new Date(y, m + n, 1);
  return { y: t.getFullYear(), m: t.getMonth() };
}

/** ‹ [ March 2027 ▾ ] ›  — arrows step a month, the middle opens a month grid. */
export default function MonthPicker({
  value,
  onChange,
  size = "md",
}: {
  value: YM;
  onChange: (next: YM, dir: "next" | "prev") => void;
  size?: "sm" | "md";
}) {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [shown, setShown] = useState(false);
  const [year, setYear] = useState(value.y);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();

  const close = (refocus = false) => {
    if (!open || closing) return;
    setClosing(true);
    setTimeout(() => { setOpen(false); setClosing(false); setShown(false); }, 150);
    if (refocus) trigger.current?.focus();
  };

  useEffect(() => { if (!open) setYear(value.y); }, [value.y, open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) close(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(true); };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  });

  // Mount closed, then open on the next frame so the dropdown grows from its trigger.
  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => {
      setShown(true);
      root.current?.querySelector<HTMLButtonElement>('[aria-current="true"], [data-month]')?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(raf);
  }, [open]);

  const step = (n: number) => onChange(shiftMonth(value, n), n > 0 ? "next" : "prev");
  const pick = (m: number) => {
    const next = { y: year, m };
    const dir = next.y * 12 + next.m >= value.y * 12 + value.m ? "next" : "prev";
    if (next.y !== value.y || next.m !== value.m) onChange(next, dir);
    close(true);
  };
  const label = `${MONTHS[value.m]} ${value.y}`;

  return (
    <div ref={root} className={`${s.picker} ${size === "sm" ? s.sm : ""}`}>
      <button className={s.arrow} onClick={() => step(-1)} aria-label={`Previous month, ${MONTHS[shiftMonth(value, -1).m]}`}>
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3.5L5.5 8 10 12.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>

      <button
        ref={trigger}
        className={s.trigger}
        aria-haspopup="dialog"
        aria-expanded={open && !closing}
        aria-controls={id}
        onClick={() => (open ? close() : setOpen(true))}
      >
        <span key={label} className="t-swap">{label}</span>
        <svg className={s.chev} data-open={open && !closing} width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5L6 7.5 9 4.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>

      <button className={s.arrow} onClick={() => step(1)} aria-label={`Next month, ${MONTHS[shiftMonth(value, 1).m]}`}>
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3.5L10.5 8 6 12.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>

      {open && (
        <div
          id={id}
          role="dialog"
          aria-label="Choose a month"
          className={`${s.menu} t-dropdown${closing ? " is-closing" : shown ? " is-open" : ""}`}
          data-origin="top-center"
        >
          <div className={s.yearRow}>
            <button className={s.yearBtn} onClick={() => setYear((y) => y - 1)} aria-label="Previous year">‹</button>
            <span key={year} className={`t-swap ${s.year}`}>{year}</span>
            <button className={s.yearBtn} onClick={() => setYear((y) => y + 1)} aria-label="Next year">›</button>
          </div>
          <div className={s.grid}>
            {MONTHS.map((name, m) => {
              const current = year === value.y && m === value.m;
              return (
                <button
                  key={name}
                  data-month
                  className={s.month}
                  aria-current={current ? "true" : undefined}
                  onClick={() => pick(m)}
                >
                  {name.slice(0, 3)}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
