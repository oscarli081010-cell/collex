"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

export const NAV = [
  { href: "/", label: "Upcoming" },
  { href: "/calendar", label: "Calendar" },
  { href: "/conferences", label: "Conferences" },
  { href: "/conferences/template", label: "Standard page" },
];

export default function TopBar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <header className="topbar">
      <div className="container topbarInner">
        <Link href="/" className="wordmark" aria-label="Collex home">Collex</Link>
        <button
          className="menu-toggle"
          aria-expanded={open}
          aria-controls="site-nav"
          onClick={() => setOpen((o) => !o)}
        >
          {open ? "Close" : "Menu"}
        </button>
        <nav id="site-nav" className={`navlinks${open ? " open" : ""}`} aria-label="Main">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              aria-current={pathname === n.href ? "page" : undefined}
              onClick={() => setOpen(false)}
            >
              {n.label}
            </Link>
          ))}
          {open && <Link href="/list" onClick={() => setOpen(false)}>List a conference</Link>}
        </nav>
        <Link href="/list" className="button topbarCta">List a conference</Link>
      </div>
    </header>
  );
}
