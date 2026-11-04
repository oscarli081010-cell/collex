"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { usePill } from "./usePill";
import { useAuth } from "./AuthProvider";
import { Wordmark } from "@/lib/brand";
import CommandBar from "./CommandBar";

type NavLink = { href: string; label: string; /** Your listings is a tab of the account page, so it is told apart by the address's #. */ hash?: string };
// Home on its own; browsing together; then the things you do about a conference.
export const NAV_GROUPS: NavLink[][] = [
  [{ href: "/", label: "Home" }],
  [{ href: "/calendar", label: "Calendar" }, { href: "/conferences", label: "Conferences" }],
  [{ href: "/roles", label: "Get involved" }, { href: "/account#conferences", label: "Your listings", hash: "#conferences" }],
];
const ALL = NAV_GROUPS.flat();

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
  // The address's # (it changes without a page change when the account tabs are switched).
  const [hash, setHash] = useState("");
  useEffect(() => {
    const read = () => setHash(location.hash);
    read();
    window.addEventListener("hashchange", read);
    window.addEventListener("collex:hash", read);
    return () => { window.removeEventListener("hashchange", read); window.removeEventListener("collex:hash", read); };
  }, [pathname]);
  const here = (n: NavLink) => {
    const path = n.href.split("#")[0];
    return n.hash ? pathname === path && hash === n.hash : pathname === path && !(path === "/account");
  };
  const current = ALL.find(here)?.href ?? "";
  const pill = usePill(navRef, '[aria-current="page"]', current);
  // Going to the listings tab from the account page itself is not a page change, so the page is told.
  const go = (n: NavLink) => { if (n.hash && pathname === "/account") setTimeout(() => window.dispatchEvent(new Event("collex:hash")), 0); };

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
          {NAV_GROUPS.map((g) => (
            <span key={g[0].href} className="navGroup" role="group">
              {g.map((n) => (
                <Link key={n.href} href={n.href} aria-current={here(n) ? "page" : undefined} onClick={() => go(n)}>{n.label}</Link>
              ))}
            </span>
          ))}
        </nav>
        <div className="topbarEnd">
        <CommandBar />
        <div className="topbarRight" data-ready={ready}>
          {/* Signed in, it sits with Admin as a solid button; signed out, Log in stays the one solid button. */}
          <Link href="/list" className={`button ${session ? "" : "secondary"}`}>List a conference</Link>
          {profile?.is_admin && <Link href="/admin" className="button">Admin</Link>}
          {session ? (
            <Link href="/account" className="avatarLink" aria-label="Your account" title={who}>{/* eslint-disable-next-line @next/next/no-img-element -- the account photo */}{profile?.avatar_url ? <img src={profile.avatar_url} alt="" width={36} height={36} /> : initials}</Link>
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
          ...NAV_GROUPS,
          [{ href: "/list", label: "List a conference" }, ...(profile?.is_admin ? [{ href: "/admin", label: "Admin" }] : []),
            session ? { href: "/account", label: "Your account" } : { href: "/login", label: "Log in" }],
        ].map((g) => (
          <div key={g[0].href} className="mobileGroup" role="group">
            {g.map((n: NavLink) => (
              <Link key={n.href} href={n.href} aria-current={here(n) ? "page" : undefined} onClick={() => { go(n); close(); }}>{n.label}</Link>
            ))}
          </div>
        ))}
      </nav>
    </header>
  );
}
