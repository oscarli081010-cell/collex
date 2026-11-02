"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

export const NAV = [
  { href: "/calendar", label: "Calendar" },
  { href: "/conferences", label: "Conferences" },
  { href: "/conferences/template", label: "Standard page" },
  { href: "/list", label: "List a conference" },
];

export default function TopBar({ overlay = false }: { overlay?: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <header className={`topbar${overlay ? " overlay" : ""}`}>
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
            className="link"
            aria-current={pathname === n.href ? "page" : undefined}
            onClick={() => setOpen(false)}
          >
            {n.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
