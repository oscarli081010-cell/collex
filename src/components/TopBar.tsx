"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { usePill } from "./usePill";
import { useAuth } from "./AuthProvider";
import { Wordmark } from "@/lib/brand";
import CommandBar from "./CommandBar";

export const NAV = [
  { href: "/", label: "Home" },
  { href: "/calendar", label: "Calendar" },
  { href: "/conferences", label: "Conferences" },
  { href: "/roles", label: "Roles" },
  { href: "/conferences/template", label: "Demo" },
];

export default function TopBar() {
  // When Vercel refreshes the home page in the background it renders it as "/index", which would leave Home unmarked
  // (and React keeps the server's attribute on hydration), so that name counts as "/".
  const raw = usePathname();
  const pathname = raw === "/index" ? "/" : raw;
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
        <Link href="/" className="wordmark" aria-label="Collex home"><Wordmark /></Link>
        <nav ref={navRef} className="navlinks" aria-label="Main">
          <span ref={pill} className="t-pill navPill" aria-hidden="true" />
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} aria-current={pathname === n.href ? "page" : undefined}>
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="topbarEnd">
        <CommandBar />
        <div className="topbarRight" data-ready={ready}>
          {/* Signed in, it sits with Admin as a solid button; signed out, Log in stays the one solid button. */}
          <Link href="/list" className={`button ${session ? "" : "secondary"}`}>List a conference</Link>
          {profile?.is_admin && <Link href="/admin" className="button">Admin</Link>}
          {session ? (
            <Link href="/account" className="avatarLink" aria-label="Your account" title={who}>{initials}</Link>
          ) : (
            <Link href="/login" className="button">Log in</Link>
          )}
        </div>
        </div>
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
        {[
          ...NAV,
          { href: "/list", label: "List a conference" },
          ...(profile?.is_admin ? [{ href: "/admin", label: "Admin" }] : []),
          session ? { href: "/account", label: "Your account" } : { href: "/login", label: "Log in" },
        ].map((n) => (
          <Link key={n.href} href={n.href} aria-current={pathname === n.href ? "page" : undefined}>{n.label}</Link>
        ))}
      </nav>
    </header>
  );
}
