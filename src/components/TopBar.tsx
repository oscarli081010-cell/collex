"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { usePill } from "./usePill";
import { useAuth } from "./AuthProvider";

export const NAV = [
  { href: "/", label: "Home" },
  { href: "/calendar", label: "Calendar" },
  { href: "/conferences", label: "Conferences" },
  { href: "/conferences/template", label: "Standard page" },
];

export default function TopBar() {
  const pathname = usePathname();
  const { ready, session, profile } = useAuth();
  const who = profile?.full_name || session?.user.email || "";
  const initials = who.split(/[\s@]/).filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
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
        <span className="topbarAuth" data-ready={ready}>
          {session ? (
            <Link href="/account" className="avatarLink" aria-label="Your account" title={who}>{initials}</Link>
          ) : (
            <Link href="/login" className="loginLink">Log in</Link>
          )}
        </span>
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
        {[...NAV, { href: "/list", label: "List a conference" }, session ? { href: "/account", label: "Your account" } : { href: "/login", label: "Log in" }].map((n) => (
          <Link key={n.href} href={n.href} aria-current={pathname === n.href ? "page" : undefined}>{n.label}</Link>
        ))}
      </nav>
    </header>
  );
}
