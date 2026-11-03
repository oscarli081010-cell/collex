"use client";

import { useRef } from "react";
import s from "./board.module.css";

// A search field with a clear button that appears once something is typed. Escape clears it too.
export default function SearchBox({ label, placeholder, value, onChange }: { label: string; placeholder: string; value: string; onChange: (v: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <label className={s.search}>
      <span className="sr-only">{label}</span>
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
      <input ref={input} type="search" className="control" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} onKeyDown={(e) => e.key === "Escape" && onChange("")} />
      <button type="button" className={s.clearX} data-shown={Boolean(value)} onClick={() => { onChange(""); input.current?.focus(); }} aria-label="Clear search" tabIndex={value ? 0 : -1}>
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
      </button>
    </label>
  );
}
