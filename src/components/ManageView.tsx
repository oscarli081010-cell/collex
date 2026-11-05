"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { formatRange } from "@/lib/conferences";
import { forgetListing, keptActivity, loadActivity } from "@/lib/listingData";
import { refreshSite } from "@/lib/refresh";
import { whenOpens } from "@/lib/schedule";
import { supabase } from "@/lib/supabase";
import { useAuth } from "./AuthProvider";
import { ICONS } from "./IconButton";
import ListingNav from "./ListingNav";
import PageBand, { BandNote, type BandProps } from "./PageBand";
import { ActivitySkeleton } from "./Skeleton";
import type { Loaded } from "./ActivityView";
import { useToast } from "./useToast";
import auth from "@/app/auth.module.css";
import s from "./Manage.module.css";

export type Reg = {
  id: string; school: string; contact_name: string; contact_email: string; delegates: number;
  notes: string | null; status: "new" | "accepted" | "waitlisted" | "declined"; created_at: string;
};
type Status = Reg["status"];

const STATUSES: { id: Status; label: string }[] = [
  { id: "new", label: "New" }, { id: "accepted", label: "Accepted" }, { id: "waitlisted", label: "Waitlisted" }, { id: "declined", label: "Declined" },
];
const label = (st: Status) => STATUSES.find((x) => x.id === st)!.label;

const when = (iso: string) => new Date(iso).toLocaleString("en-AU", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Australia/Sydney" });

// A spreadsheet runs a cell that starts with these as a formula, so such text gets a quote in front.
const cell = (v: string | number) => {
  const t = String(v);
  return `"${(/^[=+\-@\t\r]/.test(t) ? `'${t}` : t).replaceAll('"', '""')}"`;
};
export const toCsv = (rows: Reg[]) =>
  [["School", "Contact", "Email", "Delegates", "Status", "Notes", "Registered"].map(cell).join(",")]
    .concat(rows.map((r) => [r.school, r.contact_name, r.contact_email, r.delegates, label(r.status), r.notes ?? "", when(r.created_at)].map(cell).join(",")))
    .join("\r\n");

// One listing's page for running it: registrations from schools, sorted by the people who run the conference.
export default function ManageView() {
  const [version, setVersion] = useState(0);
  const { ready, session } = useAuth();
  const [id, setId] = useState<string | null | undefined>(undefined);
  const [data, setData] = useState<Loaded | "missing" | null>(null);
  const [regs, setRegs] = useState<Reg[] | null | "error">(null);
  useLayoutEffect(() => {
    const v = new URLSearchParams(location.search).get("id");
    setId(v);
    const kept = v ? keptActivity(v) : undefined;
    if (kept) setData(kept);
  }, []);

  const uid = session?.user.id;
  useEffect(() => {
    if (!id || !uid || !supabase) return;
    let live = true;
    loadActivity(id, uid).then((r) => { if (live && r) setData(r); });
    supabase.from("registrations").select("id, school, contact_name, contact_email, delegates, notes, status, created_at")
      .eq("conference_id", id).order("created_at", { ascending: false })
      .then(({ data: rows, error }) => { if (live) setRegs(error ? "error" : (rows as Reg[])); });
    return () => { live = false; };
  }, [id, uid, version]);

  const page = (band: BandProps, body: React.ReactNode) => (
    <>
      <PageBand {...band} />
      <div className={auth.body}>{body}</div>
    </>
  );

  if (!ready || id === undefined || (id && session && data === null)) return <div className="skelWrap">{page({ title: "Manage" }, <ActivitySkeleton />)}</div>;
  if (!session) {
    return page({
      title: "Manage", lead: "Log in to run your listing.",
      aside: <div className="btnStack one"><Link href="/login" className="button lg">Log in</Link></div>,
    }, null);
  }
  if (!id || data === "missing" || !data) {
    return page({
      title: "Can’t open", accent: "that", lead: "Only the people who run a listing can manage it. Pick one from your account.",
      aside: <div className="btnStack one"><Link href="/listings" className="button lg">Your listings</Link></div>,
    }, null);
  }
  return <ManageBody data={data} regs={regs} onChanged={() => setVersion((v) => v + 1)} />;
}

// The page once the listing is in. Kept apart from the loading so it can be looked at on its own.
export function ManageBody({ data, regs, onChanged, onSet }: {
  data: Loaded; regs: Reg[] | null | "error"; onChanged?: () => void;
  /** Stands in for the database call, so the page can be looked at without signing in. */
  onSet?: (reg: string, status: Status) => Promise<string | null>;
}) {
  const { c, status } = data;
  const { say, node } = useToast();
  const router = useRouter();
  const [rows, setRows] = useState<Reg[]>([]);
  const [filter, setFilter] = useState<Status | "all">("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [switching, setSwitching] = useState(false);
  useEffect(() => { if (Array.isArray(regs)) setRows(regs); }, [regs]);

  const live = status === "published";
  const canEdit = (live || status === "pending") && data.canEdit !== false;
  const count = (st: Status) => rows.filter((r) => r.status === st).length;
  const delegates = rows.filter((r) => r.status === "accepted").reduce((n, r) => n + r.delegates, 0);
  const shown = useMemo(() => (filter === "all" ? rows : rows.filter((r) => r.status === filter)), [rows, filter]);
  const ownForm = Boolean(c.delegationUrl);

  const setStatus = useCallback(async (r: Reg, next: Status) => {
    if (r.status === next) return;
    setBusy(r.id);
    const before = rows;
    setRows((xs) => xs.map((x) => (x.id === r.id ? { ...x, status: next } : x)));
    const error = onSet ? await onSet(r.id, next) : (await supabase!.rpc("set_registration_status", { reg: r.id, new_status: next })).error?.message ?? null;
    setBusy(null);
    if (error) { setRows(before); return say("That didn’t save. Try again."); }
    say(`${r.school}: ${label(next).toLowerCase()}`);
    forgetListing(c.id!);
  }, [rows, say, c.id, onSet]);

  const toggle = async () => {
    if (!supabase || switching) return;
    setSwitching(true);
    const { error } = await supabase.from("conferences").update({ collex_registration: !c.collexRegistration }).eq("id", c.id!);
    setSwitching(false);
    if (error) return say("That didn’t save. Try again.");
    say(c.collexRegistration ? "Registration on Collex is off" : "Registration on Collex is on");
    forgetListing(c.id!);
    if (live) refreshSite().then(() => router.refresh());
    onChanged?.();
  };

  const download = () => {
    const url = URL.createObjectURL(new Blob(["﻿" + toCsv(rows)], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = `${c.slug}-registrations.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <PageBand
        title="Manage"
        aside={<BandNote>{c.name}<br />{c.startDate ? formatRange(c) : "Dates not set"}</BandNote>}
        figures={[{ label: "Schools", value: Array.isArray(regs) ? String(rows.length) : "–" }, { label: "Accepted", value: Array.isArray(regs) ? String(delegates) : "–", note: "delegates" }]}
      >
        <ListingNav id={c.id!} slug={c.slug} current="manage" live={live} canEdit={canEdit} />
      </PageBand>
      <div className={auth.body}>
        <div className={`t-stagger ${s.wrap}`}>
          <Link href="/listings" className={`link ${s.back}`}>&larr; Your listings</Link>

          <section className={`panel ${s.card}`} style={{ "--i": 0 } as React.CSSProperties} aria-labelledby="reg-setup-h">
            <div className={s.cardHead}>
              <h2 id="reg-setup-h" className={s.cardTitle}>Registration on Collex</h2>
              <p className="muted">Schools sign a delegation up on your conference page and you sort them here. Off, the Register button keeps going to your own form.</p>
            </div>
            <label className={s.switchRow}>
              <input type="checkbox" role="switch" checked={Boolean(c.collexRegistration)} onChange={toggle} disabled={switching || !canEdit} />
              <span>{c.collexRegistration ? "Taking registrations on Collex" : "Not taking registrations on Collex"}</span>
            </label>
            {c.collexRegistration && ownForm && <p className={s.note}>Your own registration link is set, so the Register button goes there. Clear it in Edit listing to use Collex registration.</p>}
            {c.collexRegistration && !ownForm && (
              <p className={s.note}>{c.delegationOpensAt ? `Registration opens ${whenOpens(c.delegationOpensAt)} (Sydney time).` : "Registration is open as soon as the listing is live."} Change it in Edit listing.</p>
            )}
            {c.collexRegistration && !live && <p className={s.note}>Nobody can register until the listing is live.</p>}
          </section>

          <section className={`panel ${s.card}`} style={{ "--i": 1 } as React.CSSProperties} aria-labelledby="regs-h">
            <div className={s.cardHead}>
              <h2 id="regs-h" className={s.cardTitle}>Registrations</h2>
            </div>
            {regs === "error" ? <p className={s.note}>Couldn&rsquo;t load the registrations. Try again in a moment.</p>
              : regs === null ? <p className={s.note}>Loading…</p>
              : rows.length === 0 ? (
                <p className={s.note}>{c.collexRegistration ? "No registrations yet. They appear here as schools send them." : "Nothing here yet. Turn on registration above to take them on Collex."}</p>
              ) : (
                <>
                  <div className={s.filters} role="group" aria-label="Show registrations">
                    {([{ id: "all" as const, label: "All", n: rows.length }, ...STATUSES.map((x) => ({ ...x, n: count(x.id) }))]).map((f) => (
                      <button key={f.id} type="button" className={s.filter} aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
                        {f.label}<span className={s.filterCount}>{f.n}</span>
                      </button>
                    ))}
                  </div>
                  {shown.length === 0 ? <p className={s.note}>None are {filter === "all" ? "" : label(filter).toLowerCase()} right now.</p> : (
                    <ul className={s.regList}>
                      {shown.map((r) => (
                        <li key={r.id} className={s.reg} data-status={r.status}>
                          <div className={s.regMain}>
                            <span className={s.regSchool}>{r.school}</span>
                            <span className={s.regMeta}>
                              {r.delegates} {r.delegates === 1 ? "delegate" : "delegates"} · {r.contact_name} · <a className="link" href={`mailto:${r.contact_email}`}>{r.contact_email}</a> · <time dateTime={r.created_at}>{when(r.created_at)}</time>
                            </span>
                            {r.notes && <span className={s.quote}>&ldquo;{r.notes}&rdquo;</span>}
                          </div>
                          <div className={s.regActions} role="group" aria-label={`Status for ${r.school}`}>
                            {STATUSES.filter((x) => x.id !== "new").map((x) => (
                              <button key={x.id} type="button" className={`button secondary ${s.statusBtn}`} data-on={r.status === x.id}
                                aria-pressed={r.status === x.id} disabled={busy === r.id || !canEdit} onClick={() => setStatus(r, r.status === x.id ? "new" : x.id)}
                                aria-label={`${x.label}: ${r.school}`}>{x.label}</button>
                            ))}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="btnStack one">
                    <button type="button" className="button secondary block" onClick={download}>{ICONS.publish}Download as spreadsheet (CSV)</button>
                  </div>
                </>
              )}
          </section>
          {node}
        </div>
      </div>
    </>
  );
}
