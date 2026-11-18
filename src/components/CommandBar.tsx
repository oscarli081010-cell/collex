"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { formatRange } from "@/lib/conferences";
import { lockScroll } from "@/lib/scrollLock";
import { useConferences } from "./ConferencesContext";
import s from "./CommandBar.module.css";

type Item = { group: string; label: string; sub?: string; href: string };

const PAGES: Item[] = [
  ["Home", "/"], ["Calendar", "/calendar"], ["Conferences", "/conferences"], ["Open roles", "/roles"], ["Guides", "/guides"], ["List a conference", "/list"],
  ["Your account", "/account"], ["Your listings", "/listings"], ["About", "/about"], ["Privacy policy", "/privacy"], ["Terms of use", "/terms"], ["Cookies policy", "/cookies"],
].map(([label, href]) => ({ group: "Pages", label, href }));

const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const matches = (q: string, ...fields: string[]) => {
  const hay = norm(fields.join(" "));
  return norm(q).split(/\s+/).filter(Boolean).every((w) => hay.includes(w));
};

// ⌘K / Ctrl+K: jump to any conference, host school or page. A native <dialog> keeps focus inside
// and closes on Escape; the list follows the combobox pattern so screen readers announce each result.
export default function CommandBar() {
  const router = useRouter();
  const conferences = useConferences();
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  // The highlighted result. None until you type or move: opening the menu shouldn't pick anything for you.
  const [active, setActive] = useState(-1);
  const [mac, setMac] = useState(true);

  const lock = lockScroll; // the page behind stays put while the menu is up
  const open = () => { setQ(""); setActive(-1); dialog.current?.showModal(); lock(true); input.current?.focus(); };
  const close = () => dialog.current?.close();
  useEffect(() => () => lock(false), []);

  useEffect(() => {
    setMac(/Mac|iPhone|iPad/.test(navigator.platform));
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (dialog.current?.open) close(); else open();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const results = useMemo(() => {
    const live = conferences.filter((c) => !c.isTemplate);
    const confs: Item[] = live.filter((c) => matches(q, c.name, c.shortName, c.host, c.venue))
      .map((c) => ({ group: "Conferences", label: c.name, sub: c.startDate ? formatRange(c) : c.host, href: `/conferences/${c.slug}` }));
    const hosts: Item[] = [...new Set(live.map((c) => c.host))].filter((h) => q && matches(q, h))
      .map((h) => ({ group: "Host schools", label: h, sub: "Conferences they host", href: `/conferences?q=${encodeURIComponent(h)}` }));
    const pages = PAGES.filter((p) => matches(q, p.label));
    return [...confs.slice(0, 6), ...hosts.slice(0, 4), ...pages];
  }, [q, conferences]);

  const go = (item?: Item) => { if (!item) return; close(); router.push(item.href); };
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); go(results[active]); }
  };
  useEffect(() => { if (active >= 0) document.getElementById(`cmd-${active}`)?.scrollIntoView({ block: "nearest" }); }, [active]);

  return (
    <>
      <button className={s.trigger} onClick={open} aria-label="Search Collex" aria-keyshortcuts="Meta+K Control+K" title={`Search (${mac ? "⌘" : "Ctrl"} K)`}>
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
      </button>
      <dialog ref={dialog} className={s.dialog} aria-label="Search Collex" onClick={(e) => e.target === dialog.current && close()} onClose={() => lock(false)}>
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
              role="combobox"
              aria-expanded="true"
              aria-controls="cmd-list"
              aria-activedescendant={results.length && active >= 0 ? `cmd-${active}` : undefined}
              aria-autocomplete="list"
              autoComplete="off"
              spellCheck={false}
            />
            <kbd className={s.kbd}>Esc</kbd>
          </div>
          <ul id="cmd-list" role="listbox" className={s.list} aria-label="Results">
            {results.length === 0 && <li className={s.empty} role="presentation">Nothing matches &ldquo;{q}&rdquo;.</li>}
            {results.map((r, i) => (
              <li key={r.group + r.href} role="presentation">
                {(i === 0 || results[i - 1].group !== r.group) && <span className={s.group} aria-hidden="true">{r.group}</span>}
                <div
                  id={`cmd-${i}`}
                  role="option"
                  aria-selected={i === active}
                  className={s.option}
                  onMouseMove={() => setActive(i)}
                  onClick={() => go(r)}
                >
                  <span className={s.label}>{r.label}</span>
                  {r.sub && <span className={s.sub}>{r.sub}</span>}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </dialog>
    </>
  );
}
