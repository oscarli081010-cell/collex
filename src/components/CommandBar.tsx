"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import s from "./CommandBar.module.css";

// The search menu is its own chunk: it is fetched when the page is idle, or at once when the button is hovered,
// focused or pressed (or ⌘K / Ctrl+K is). Until then the page carries only this button.
const load = () => import("./CommandBarDialog");
const Dialog = dynamic(load, { ssr: false });

// ⌘K / Ctrl+K: jump to any conference, host school or page.
export default function CommandBar() {
  const [mounted, setMounted] = useState(false);
  const [opens, setOpens] = useState(0);
  const [mac, setMac] = useState(true);
  const ready = useRef(false);

  const want = () => { ready.current = true; setMounted(true); setOpens((n) => n + 1); };

  useEffect(() => {
    setMac(/Mac|iPhone|iPad/.test(navigator.platform));
    // Once the menu is mounted it listens for the shortcut itself (and toggles); until then this does.
    const onKey = (e: KeyboardEvent) => {
      if (!ready.current && (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); want(); }
    };
    window.addEventListener("keydown", onKey);
    const idle = window.requestIdleCallback ?? ((f: () => void) => window.setTimeout(f, 3000));
    const id = idle(() => { load(); }, { timeout: 8000 });
    return () => { window.removeEventListener("keydown", onKey); (window.cancelIdleCallback ?? window.clearTimeout)(id as number); };
  }, []);

  return (
    <>
      <button className={s.trigger} onClick={want} onPointerEnter={load} onFocus={load} aria-label="Search Collex" aria-keyshortcuts="Meta+K Control+K" title={`Search (${mac ? "⌘" : "Ctrl"} K)`}>
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
      </button>
      {mounted && <Dialog opens={opens} />}
    </>
  );
}
