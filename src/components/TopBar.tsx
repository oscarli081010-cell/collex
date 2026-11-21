"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { usePill } from "./usePill";
import { useAuth } from "./AuthProvider";
import { Logo } from "@/lib/brand";
import CommandBar from "./CommandBar";

type NavLink = { href: string; label: string };
type NavGroup = { label: string; items: NavLink[] };
// Three menus: the home page and what Collex is, browsing (including the roles conferences need filled), and the tools for running a conference.
export const NAV_GROUPS: NavGroup[] = [
  { label: "Home", items: [
    { href: "/", label: "Home" },
    { href: "/about", label: "About us" },
  ] },
  { label: "Browse", items: [
    { href: "/conferences", label: "Conferences" },
    { href: "/calendar", label: "Calendar" },
    { href: "/roles", label: "Open roles" },
    { href: "/guides", label: "Guides" },
  ] },
  { label: "Organisers", items: [
    { href: "/list", label: "List a conference" },
    { href: "/listings", label: "Your conferences" },
    { href: "/chambers", label: "Committees" },
  ] },
];

const Chevron = () => (
  <svg className="navChevron" width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2.5 4.5L6 8l3.5-3.5" /></svg>
);

// A menu in the bar. It opens on hover (with a pointer that can hover) or on click or Enter, and closes on Escape, a click elsewhere or leaving it.
function NavMenu({ group, here, open, setOpen, onPick }: { group: NavGroup; here: (n: NavLink) => boolean; open: boolean; setOpen: (o: boolean) => void; onPick: () => void }) {
  const box = useRef<HTMLSpanElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // Opened just by the pointer resting on it: the click that follows keeps it open rather than closing it.
  const byHover = useRef(false);
  const id = `nav-${group.label.toLowerCase().replace(/\W+/g, "-")}`;
  const active = group.items.some(here);
  const hovers = () => window.matchMedia("(hover: hover)").matches;
  const clear = () => clearTimeout(timer.current);
  useEffect(() => clear, []);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open, setOpen]);

  return (
    <span
      ref={box}
      className="navMenu"
      onPointerEnter={(e) => { if (e.pointerType === "mouse" && hovers()) { clear(); if (!open) byHover.current = true; setOpen(true); } }}
      onPointerLeave={(e) => { if (e.pointerType === "mouse") { clear(); byHover.current = false; timer.current = setTimeout(() => setOpen(false), 140); } }}
      onBlur={(e) => { if (!box.current?.contains(e.relatedTarget as Node)) setOpen(false); }}
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) { e.stopPropagation(); setOpen(false); trigger.current?.focus(); }
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setOpen(true);
          const links = [...box.current!.querySelectorAll<HTMLElement>(`#${id} a`)];
          const i = links.indexOf(document.activeElement as HTMLElement);
          setTimeout(() => links[(i + 1) % links.length]?.focus(), 0);
        }
        if (e.key === "ArrowUp" && open) {
          e.preventDefault();
          const links = [...box.current!.querySelectorAll<HTMLElement>(`#${id} a`)];
          const i = links.indexOf(document.activeElement as HTMLElement);
          links[(i <= 0 ? links.length : i) - 1]?.focus();
        }
      }}
    >
      <button ref={trigger} type="button" className="navTrigger" data-here={active || undefined} aria-expanded={open} aria-controls={id} onClick={() => { if (byHover.current) byHover.current = false; else setOpen(!open); }}>
        {group.label}<Chevron />
      </button>
      <div id={id} className={`navDrop t-dropdown${open ? " is-open" : ""}`} data-origin="top-left" role="group" aria-label={group.label} inert={!open}>
        {group.items.map((n) => (
          <Link key={n.href} href={n.href} aria-current={here(n) ? "page" : undefined} onClick={onPick}>
            {n.label}
          </Link>
        ))}
      </div>
    </span>
  );
}

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
  const [menu, setMenu] = useState("");
  const navRef = useRef<HTMLElement>(null);
  const here = (n: NavLink) => pathname === n.href;
  const current = NAV_GROUPS.find((g) => g.items.some(here))?.label ?? "";
  const pill = usePill(navRef, "[data-here]", current);

  const close = () => {
    if (!open || closing) return;
    setClosing(true);
    setTimeout(() => { setOpen(false); setClosing(false); }, 150);
  };

  useEffect(() => { setOpen(false); setClosing(false); setMenu(""); }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <header className="topbar">
      <div className="container topbarInner">
        <Link href="/" className="wordmark" aria-label="Collex home"><Logo /></Link>
        <nav ref={navRef} className="navlinks" aria-label="Main">
          <span ref={pill} className="t-pill navPill" aria-hidden="true" />
          {NAV_GROUPS.map((g) => (
            <NavMenu key={g.label} group={g} here={here} open={menu === g.label} setOpen={(o) => setMenu((m) => (o ? g.label : m === g.label ? "" : m))} onPick={() => setMenu("")} />
          ))}
        </nav>
        <div className="topbarEnd">
        <CommandBar />
        <div className="topbarRight" data-ready={ready}>
          {profile?.is_admin && <Link href="/admin" className="button">Admin</Link>}
          {session ? (
            <Link href="/account" className="avatarLink" aria-label="Your account" title={who}>{/* eslint-disable-next-line @next/next/no-img-element -- the account photo */}{profile?.avatar_url ? <img src={profile.avatar_url} alt="" width={36} height={36} /> : initials}</Link>
          ) : (
            <Link href="/login" className="button">Log In</Link>
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
        {NAV_GROUPS.map((g) => (
          <div key={g.label} className="mobileGroup" role="group" aria-label={g.label}>
            <span className="mobileHead" aria-hidden="true">{g.label}</span>
            {g.items.map((n) => (
              <Link key={n.href} href={n.href} aria-current={here(n) ? "page" : undefined} onClick={close}>{n.label}</Link>
            ))}
          </div>
        ))}
        <div className="mobileGroup" role="group" aria-label="Account">
          {profile?.is_admin && <Link href="/admin" onClick={close}>Admin</Link>}
          {session ? <Link href="/account" aria-current={pathname === "/account" ? "page" : undefined} onClick={close}>Your account</Link> : <Link href="/login" onClick={close}>Log in</Link>}
        </div>
      </nav>
    </header>
  );
}
