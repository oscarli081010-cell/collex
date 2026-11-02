"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import s from "./SchoolPicker.module.css";

type Option = { name: string; sub: string; group: "Universities" | "High schools" };
type Data = { universities: string[]; schools: { name: string; suburb: string }[] };

// Every Sydney secondary school (ACARA School Profile 2025) plus the universities.
// Fetched once on first focus so the 28 KB list never weighs on page load.
let cache: Promise<Option[]> | null = null;
const load = () =>
  (cache ??= fetch("/data/institutions.json")
    .then((r) => r.json() as Promise<Data>)
    .then((d) => [
      ...d.universities.map((name): Option => ({ name, sub: "University", group: "Universities" })),
      ...d.schools.map((x): Option => ({ name: x.name, sub: x.suburb, group: "High schools" })),
    ])
    .catch(() => { cache = null; return []; }));

const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
const LIMIT = 40;

// Searchable dropdown. The input itself carries name="school", so the value posts with the form
// and anything not in the list can still be typed.
export default function SchoolPicker({ name = "school", defaultValue = "" }: { name?: string; defaultValue?: string }) {
  const [value, setValue] = useState(defaultValue);
  const [all, setAll] = useState<Option[] | null>(null);
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);
  const id = useId();

  useEffect(() => setValue(defaultValue), [defaultValue]);

  const matches = useMemo(() => {
    if (!all) return [];
    const q = norm(value);
    if (!q) return all.slice(0, LIMIT);
    const words = q.split(" ");
    const hit = all.filter((o) => { const h = norm(`${o.name} ${o.sub}`); return words.every((w) => h.includes(w)); });
    // Names that start with what was typed come first.
    hit.sort((a, b) => Number(!norm(a.name).startsWith(q)) - Number(!norm(b.name).startsWith(q)));
    return hit.slice(0, LIMIT);
  }, [all, value]);

  useEffect(() => setActive(0), [value]);
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const show = () => { setClosing(false); setOpen(true); load().then(setAll); };
  const hide = () => {
    if (!open) return;
    setOpen(false);
    setClosing(true);
    setTimeout(() => setClosing(false), 150);
  };
  const pick = (o: Option) => { setValue(o.name); hide(); };

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") { e.preventDefault(); if (!open) show(); else setActive((a) => Math.min(a + 1, matches.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter" && open && matches[active]) { e.preventDefault(); pick(matches[active]); }
    else if (e.key === "Escape" && open) { e.preventDefault(); hide(); }
  }

  let lastGroup = "";
  return (
    <div className={s.wrap}>
      <input
        name={name}
        maxLength={200}
        className={`control ${s.input}`}
        value={value}
        placeholder="Start typing your school"
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={id}
        aria-autocomplete="list"
        aria-activedescendant={open && matches[active] ? `${id}-${active}` : undefined}
        onChange={(e) => { setValue(e.target.value); if (!open) show(); }}
        onFocus={show}
        onClick={show}
        onBlur={hide}
        onKeyDown={onKey}
      />
      <svg className={s.chevron} data-open={open} width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
        <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <ul
        id={id}
        ref={listRef}
        role="listbox"
        className={`t-dropdown ${s.list} ${open ? "is-open" : ""} ${closing ? "is-closing" : ""}`}
        onMouseDown={(e) => e.preventDefault()}
      >
        {all === null ? (
          <li className={s.note}>Loading schools…</li>
        ) : matches.length === 0 ? (
          <li className={s.note}>Not in the list. Keep typing and we&rsquo;ll save it as written.</li>
        ) : (
          matches.map((o, i) => {
            const head = o.group !== lastGroup ? (lastGroup = o.group) : null;
            return [
              head && <li key={`h-${head}`} className={s.group} role="presentation">{head}</li>,
              <li
                key={`${o.name}-${o.sub}`}
                id={`${id}-${i}`}
                data-i={i}
                role="option"
                aria-selected={i === active}
                className={s.option}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(o)}
              >
                <span>{o.name}</span>
                <small>{o.sub}</small>
              </li>,
            ];
          })
        )}
      </ul>
    </div>
  );
}
