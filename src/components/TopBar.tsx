"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { usePill } from "./usePill";

export const NAV = [
  { href: "/", label: "Upcoming" },
  { href: "/calendar", label: "Calendar" },
  { href: "/conferences", label: "Conferences" },
  { href: "/conferences/template", label: "Standard page" },
];

export default function TopBar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const pill = usePill(navRef, '[aria-current="page"]', pathname);

  const close = () => {
    if (!open || closing) return;
    setClosing(true);
    setTimeout(() => { setOpen(false); setClosing(false); }, 150);
  };

  useEffect(() => { setOpen(false); setClosing(false); }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <header className="topbar">
      <div className="container topbarInner">
        <Link href="/" className="wordmark" aria-label="Collex home">Collex</Link>
        <nav ref={navRef} className="navlinks" aria-label="Main">
          <span ref={pill} className="t-pill navPill" aria-hidden="true" />
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} aria-current={pathname === n.href ? "page" : undefined}>
              {n.label}
            </Link>
          ))}
        </nav>
        <Link href="/list" className="button topbarCta">List a conference</Link>
        <button
          className="menu-toggle"
          aria-expanded={open && !closing}
          aria-controls="mobile-nav"
          onClick={() => (open ? close() : setOpen(true))}
        >
          {open && !closing ? "Close" : "Menu"}
        </button>
      </div>
      <nav
        id="mobile-nav"
        className={`mobileNav t-dropdown${open && !closing ? " is-open" : closing ? " is-closing" : ""}`}
        data-origin="top-right"
        aria-label="Main"
        inert={!open || closing}
      >
        {[...NAV, { href: "/list", label: "List a conference" }].map((n) => (
          <Link key={n.href} href={n.href} aria-current={pathname === n.href ? "page" : undefined}>{n.label}</Link>
        ))}
      </nav>
    </header>
  );
}
