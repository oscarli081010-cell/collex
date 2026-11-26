"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { formatRange } from "@/lib/conferences";
import { lockScroll } from "@/lib/scrollLock";
import { useConferences } from "./ConferencesContext";
import s from "./CommandBar.module.css";

type Item = { group: string; label: string; sub?: string; href: string };

const PAGES: Item[] = [
  ["Home", "/"], ["Calendar", "/calendar"], ["Conferences", "/conferences"], ["Guides", "/guides"], ["List a conference", "/list"],
  ["Your account", "/account"], ["Your conferences", "/listings"], ["About", "/about"], ["Privacy policy", "/privacy"], ["Terms of use", "/terms"], ["Cookies policy", "/cookies"],
].map(([label, href]) => ({ group: "Pages", label, href }));

const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const matches = (q: string, ...fields: string[]) => {
  const hay = norm(fields.join(" "));
  return norm(q).split(/\s+/).filter(Boolean).every((w) => hay.includes(w));
};

// The search menu itself. CommandBar loads this the first time search is wanted, so the code (and the page's list of
// results) isn't part of every page's first load. `opens` counts requests to open it; each new one opens the menu.
// A native <dialog> keeps focus inside and closes on Escape; the list follows the combobox pattern so screen readers
// announce each result, and each result is a real link (open in a new tab, copy the address).
export default function CommandBarDialog({ opens }: { opens: number }) {
  const conferences = useConferences();
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();
  const [q, setQ] = useState("");
  // The highlighted result. None until you type or move: opening the menu shouldn't pick anything for you.
  const [active, setActive] = useState(-1);

  // The page behind stays put while the menu is up.
  const open = useCallback(() => { setQ(""); setActive(-1); dialog.current?.showModal(); lockScroll(true); input.current?.focus(); }, []);
  const close = useCallback(() => dialog.current?.close(), []);
  useEffect(() => () => lockScroll(false), []);

  // Each request from the button or the shortcut (while it is not open already) opens the menu.
  useEffect(() => { if (opens > 0 && !dialog.current?.open) open(); }, [opens, open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (dialog.current?.open) close(); else open();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  const results = useMemo(() => {
    const live = conferences.filter((c) => !c.isTemplate);
    const confs: Item[] = live.filter((c) => matches(q, c.name, c.shortName, c.host, c.venue))
      .map((c) => ({ group: "Conferences", label: c.name, sub: c.startDate ? formatRange(c) : c.host, href: `/conferences/${c.slug}` }));
    const hosts: Item[] = [...new Set(live.map((c) => c.host))].filter((h) => q && matches(q, h))
      .map((h) => ({ group: "Host schools", label: h, sub: "Conferences they host", href: `/conferences?q=${encodeURIComponent(h)}` }));
    const pages = PAGES.filter((p) => matches(q, p.label));
    return [...confs.slice(0, 6), ...hosts.slice(0, 4), ...pages];
  }, [q, conferences]);

  // Said aloud (politely) as the list changes; silent until something is typed.
  const count = q.trim() ? (results.length === 0 ? "No results" : `${results.length} ${results.length === 1 ? "result" : "results"}`) : "";

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); if (active >= 0) document.getElementById(`cmd-${active}`)?.click(); }
  };
  useEffect(() => { if (active >= 0) document.getElementById(`cmd-${active}`)?.scrollIntoView({ block: "nearest" }); }, [active]);

  return (
    <dialog ref={dialog} className={s.dialog} aria-label="Search Collex" onClick={(e) => e.target === dialog.current && close()} onClose={() => lockScroll(false)}>
      <div className={s.panel}>
        <div className={s.field}>
          <svg width="17" height="17" viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
          <input
            ref={input}
            className={s.input}
            value={q}
            onChange={(e) => { setQ(e.target.value); setActive(e.target.value.trim() ? 0 : -1); }}
            onKeyDown={onKeyDown}
            placeholder="Search conferences, schools and pages"
            aria-label="Search conferences, schools and pages"
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={results.length && active >= 0 ? `cmd-${active}` : undefined}
            aria-autocomplete="list"
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className={s.kbd}>Esc</kbd>
        </div>
        <div className="sr-only" role="status" aria-live="polite">{count}</div>
        <ul id={listId} role="listbox" className={s.list} aria-label="Results">
          {results.length === 0 && <li className={s.empty} role="presentation">Nothing matches &ldquo;{q}&rdquo;.</li>}
          {results.map((r, i) => (
            <li key={r.group + r.href} role="presentation">
              {(i === 0 || results[i - 1].group !== r.group) && <span className={s.group} aria-hidden="true">{r.group}</span>}
              {/* A real link, so a middle click, Ctrl or Cmd click, or "open in new tab" works. Focus stays in the search box. */}
              <Link
                id={`cmd-${i}`}
                href={r.href}
                role="option"
                aria-selected={i === active}
                tabIndex={-1}
                className={s.option}
                onMouseMove={() => setActive(i)}
                onClick={(e) => { if (!(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)) close(); }}
              >
                <span className={s.label}>{r.label}</span>
                {r.sub && <span className={s.sub}>{r.sub}</span>}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </dialog>
  );
}
