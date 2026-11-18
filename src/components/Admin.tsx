"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { RowsSkeleton } from "./Skeleton";
import SearchBox from "./SearchBox";
import { Placard } from "./Drawings";
import Verified from "./Verified";
import IconButton, { ConfirmIconButton, ICONS } from "./IconButton";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { coverPosition, coverUrl, formatDate, webUrl } from "@/lib/conferences";
import { supabase } from "@/lib/supabase";
import { refreshSite } from "@/lib/refresh";
import { useAuth } from "./AuthProvider";
import { usePill } from "./usePill";
import PageBand from "./PageBand";
import { useToast } from "./useToast";
import auth from "@/app/auth.module.css";
import s from "@/app/admin.module.css";
import act from "./Activity.module.css";
import Select from "./Select";
import AdminChambers, { type AdminChamber } from "./AdminChambers";

type Row = {
  id: string; slug: string; status: string; name: string; host: string; start_date: string | null; end_date: string | null;
  venue: string; level: string | null; contact: string; fee: string; overview: string; submitter_role: string;
  delegation_url: string | null; chair_url: string | null; interest_url?: string | null; committees: { name: string; topic: string }[]; cover_path?: string | null; cover_x?: number | null; cover_y?: number | null;
  review_note: string; created_at: string; verified: boolean;
};
type User = { id: string; email: string; full_name: string; school: string; role: string; is_admin: boolean; created_at: string };
type Report = {
  id: number; conference_id: string; reason: string; note: string; reply_to: string; status: string; created_at: string; resolved_at: string | null;
  conferences: { name: string; slug: string } | null;
};
type Log = { id: number; at: string; actor_email: string; action: string; target_type: string; target_label: string; detail: { note?: string } };

const LOG_PER_PAGE = 10;
// The dot's colour for what happened, as on a listing's own audit log.
const LOG_TONE: Record<string, string> = { approved: "ok", rejected: "bad", unpublished: "warn", reopened: "warn", submitted: "accent", "removed organiser": "bad", "left organisers": "warn", deleted: "bad", "created an account": "ok", "started a chamber": "accent", "shared a chamber": "accent" };
// What the log says for each action: a person listing a conference reads as "listed".
const LOG_WORDS: Record<string, string> = { submitted: "listed" };

const COVER_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const TABS = ["Review", "Conferences", "Reports", "Chambers", "Users", "Audit Log"] as const;
const REASON: Record<string, string> = { details: "Wrong or out of date", link: "Broken link", inappropriate: "Shouldn\u2019t be here", other: "Something else" };
type Tab = (typeof TABS)[number];
const STATUS: Record<string, string> = { pending: "In review", published: "Live", rejected: "Rejected", unpublished: "Taken down" };

const when = (iso: string) => new Date(iso).toLocaleString("en-AU", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
const dates = (r: Row) => (r.start_date ? (r.end_date && r.end_date !== r.start_date ? `${formatDate(r.start_date)} to ${formatDate(r.end_date)}` : formatDate(r.start_date)) : "Dates not set");

export default function Admin() {
  const { ready, session, profile } = useAuth();
  const [tab, setTab] = useState<Tab>("Review");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [users, setUsers] = useState<User[] | null>(null);
  const [log, setLog] = useState<Log[] | null>(null);
  const [logPage, setLogPage] = useState(0);
  const [reports, setReports] = useState<Report[] | null>(null);
  const [chambers, setChambers] = useState<AdminChamber[] | null>(null);
  const [chambersError, setChambersError] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  // One search per tab, so switching tabs keeps what you typed in each.
  const [find, setFind] = useState<Record<Tab, string>>({ Review: "", Conferences: "", Reports: "", Chambers: "", Users: "", "Audit Log": "" });
  // A new search starts on the first page of the audit log.
  useEffect(() => { setLogPage(0); }, [find["Audit Log"]]);
  const [statusFilter, setStatusFilter] = useState("any");
  const [reportFilter, setReportFilter] = useState("open");
  // Bulk actions: what's ticked on the open tab (ids as text), the reject reason being typed, and the two-step delete.
  const [sel, setSel] = useState<string[]>([]);
  const [rejecting, setRejecting] = useState(false);
  const [rejectNote, setRejectNote] = useState("");
  const [armed, setArmed] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const { say, node } = useToast();
  const tabsRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  // Public pages pick up the change now, and so does this tab's copy of them.
  const published = () => refreshSite().then(() => router.refresh());
  const pill = usePill(tabsRef, '[aria-selected="true"]', `${tab}${profile?.is_admin}`);

  const load = useCallback(async () => {
    if (!supabase) return;
    const [c, u, l, rp, ch] = await Promise.all([
      supabase.from("conferences").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("id, email, full_name, school, role, is_admin, created_at").order("created_at", { ascending: false }),
      supabase.from("audit_log").select("*").order("at", { ascending: false }).limit(200),
      supabase.from("reports").select("id, conference_id, reason, note, reply_to, status, created_at, resolved_at, conferences(name, slug)").order("created_at", { ascending: false }).limit(200),
      supabase.rpc("admin_chambers"),
    ]);
    setRows((c.data as Row[]) ?? []);
    setUsers((u.data as User[]) ?? []);
    setLog((l.data as Log[]) ?? []);
    setReports((rp.data as unknown as Report[] | null) ?? []);
    setChambersError(!!ch.error);
    setChambers((ch.data as AdminChamber[] | null) ?? []);
  }, []);

  useEffect(() => { if (profile?.is_admin) load(); }, [profile?.is_admin, load]);
  // The first click on a bulk Delete arms it; it disarms itself after three seconds.
  useEffect(() => { if (!armed) return; const t = setTimeout(() => setArmed(false), 3000); return () => clearTimeout(t); }, [armed]);

  const bulkOn = sel.length > 0 && (tab === "Review" || tab === "Conferences" || tab === "Reports");
  // Escape clears the selection, unless it's closing something else first (the reject reason box goes back).
  useEffect(() => {
    if (!bulkOn) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      if (rejecting) { setRejecting(false); return; }
      setSel([]); setRejectNote(""); setArmed(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [bulkOn, rejecting]);
  if (!ready) return <div style={{ marginTop: "clamp(48px, 6vw, 80px)" }}><RowsSkeleton rows={5} height={72} /></div>;
  if (!session || !profile?.is_admin) {
    return (
      <div className={`t-reveal ${auth.form}`} style={{ marginTop: "clamp(48px, 6vw, 80px)" }}>
        <h1 className={auth.title}>Admins only</h1>
        <p className="muted">{session ? "Your account doesn't have admin access." : "Log in with an admin account to continue."}</p>
        {!session && <Link href="/login" className="button lg">Log in</Link>}
      </div>
    );
  }

  const setStatus = async (r: Row, status: string, note = "", verified = r.verified) => {
    const { error } = await supabase!.from("conferences").update({ status, review_note: note, verified }).eq("id", r.id);
    if (error) return say("That didn't save. Try again.");
    say(status === "published" ? `${r.name} is live` : status === "rejected" ? "Rejected" : status === "unpublished" ? "Taken down" : "Updated");
    load();
    published();
  };
  const setVerified = async (r: Row) => {
    const { error } = await supabase!.from("conferences").update({ verified: !r.verified }).eq("id", r.id);
    if (error) return say("That didn't save. Try again.");
    say(r.verified ? "Badge removed" : `${r.name} is verified`);
    load();
    published();
  };
  const remove = async (r: Row) => {
    const { error } = await supabase!.from("conferences").delete().eq("id", r.id);
    if (error) return say("That didn't delete. Try again.");
    say("Deleted");
    load();
    published();
  };
  const removeUser = async (u: User) => {
    const { error } = await supabase!.rpc("delete_user", { target: u.id });
    if (error) return say(error.message);
    say(`${u.full_name || u.email}'s account is deleted`);
    load();
  };
  const toggleAdmin = async (u: User) => {
    const { error } = await supabase!.rpc("set_admin", { target: u.id, make_admin: !u.is_admin });
    if (error) return say(error.message);
    say(u.is_admin ? "Admin access removed" : `${u.full_name || u.email} is now an admin`);
    load();
  };

  const setReport = async (r: Report, status: "open" | "resolved") => {
    const { error } = await supabase!.from("reports").update({ status, resolved_at: status === "resolved" ? new Date().toISOString() : null }).eq("id", r.id);
    if (error) return say("That didn't save. Try again.");
    say(status === "resolved" ? "Marked as resolved" : "Reopened");
    load();
  };
  const removeReport = async (r: Report) => {
    const { error } = await supabase!.from("reports").delete().eq("id", r.id);
    if (error) return say("That didn't delete. Try again.");
    say("Deleted");
    load();
  };

  // Bulk actions: one change to everything ticked, then the lists and the public pages refresh.
  const toggle = (id: string) => setSel((x) => (x.includes(id) ? x.filter((y) => y !== id) : [...x, id]));
  const clearSel = () => { setSel([]); setRejecting(false); setRejectNote(""); setArmed(false); };
  const bulk = async (done: string, run: () => PromiseLike<{ error: { message: string } | null }>, site = true) => {
    setBulkBusy(true);
    const { error } = await run();
    setBulkBusy(false);
    if (error) return say("That didn't save. Try again.");
    say(`${sel.length} ${done}`);
    clearSel();
    load();
    if (site) published();
  };
  const db = () => supabase!;
  const confStatus = (status: string, note = "") => db().from("conferences").update({ status, review_note: note }).in("id", sel);
  const reportIds = sel.map(Number);

  const pending = rows?.filter((r) => r.status === "pending") ?? [];
  const others = rows?.filter((r) => r.status !== "pending") ?? [];
  // Tab counts are always the totals; the search only narrows what the open tab shows.
  const openReports = (reports ?? []).filter((r) => r.status === "open");
  const counts: Record<Tab, number | null> = { Review: pending.length, Conferences: others.length, Reports: openReports.length, Chambers: chambers?.length ?? null, Users: users?.length ?? null, "Audit Log": null };
  const q = find[tab].trim().toLowerCase();
  const has = (...parts: (string | null | undefined)[]) => !q || parts.join(" ").toLowerCase().includes(q);
  const shownConfs = others.filter((r) => has(r.name, r.host, r.venue, STATUS[r.status]) && (statusFilter === "any" || r.status === statusFilter));
  const shownReports = (reports ?? []).filter((r) => (reportFilter === "all" || r.status === reportFilter) && has(r.conferences?.name, REASON[r.reason], r.note, r.reply_to));
  const shownUsers = (users ?? []).filter((u) => has(u.full_name, u.email, u.school));
  const shownLog = (log ?? []).filter((e) => has(e.actor_email, e.action, e.target_label));
  const logPages = Math.max(1, Math.ceil(shownLog.length / LOG_PER_PAGE));
  const logAt = Math.min(logPage, logPages - 1);
  const goLog = (n: number) => { setLogPage(n); document.getElementById("audit-list")?.scrollIntoView({ block: "start", behavior: "smooth" }); };
  const searching = Boolean(q) || (tab === "Conferences" && statusFilter !== "any") || (tab === "Reports" && reportFilter !== "open");
  const clearSearch = () => { setFind((f) => ({ ...f, [tab]: "" })); if (tab === "Conferences") setStatusFilter("any"); if (tab === "Reports") setReportFilter("open"); };
  const noMatches = <Empty title="No matches" body="Try a different word, or clear the search."><button className="button secondary" onClick={clearSearch}>Clear search</button></Empty>;
  const searchFor: Partial<Record<Tab, string>> = { Conferences: "Search by name, host, venue or status", Reports: "Search by listing, reason or message", Chambers: "Search by name, owner or where it is", Users: "Search by name, email or school", "Audit Log": "Search by who, action or what" };

  return (
    <div className={s.wrap}>
      <PageBand title="Admin" figures={[
        { label: "To Review", value: rows === null ? "…" : String(pending.length) },
        { label: "Open Reports", value: reports === null ? "…" : String(openReports.length) },
        { label: "Users", value: users === null ? "…" : String(users.length) },
      ]} />
      <nav className={s.tabsRow} aria-label="Admin sections">
        <div ref={tabsRef} className={s.tabs} role="tablist" style={{ "--n": TABS.length } as React.CSSProperties}>
          <span ref={pill} className={`t-pill ${s.tabPill}`} aria-hidden="true" />
          {TABS.map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => { clearSel(); setTab(t); }}>
              {t}{counts[t] ? <span className={s.count}>{counts[t]}</span> : null}
            </button>
          ))}
        </div>
      </nav>

      {rows === null ? <RowsSkeleton rows={4} height={72} /> : (
        <div key={tab} className="t-reveal">
          {searchFor[tab] && (tab !== "Conferences" || others.length > 0) && (tab !== "Reports" || (reports ?? []).length > 0) && (tab !== "Audit Log" || log!.length > 0) && (tab !== "Chambers" || (chambers ?? []).length > 0) && (
            <div className={s.searchBar} role="search">
              <SearchBox label={`Search ${tab.toLowerCase()}`} placeholder={searchFor[tab]!} value={find[tab]} onChange={(v) => setFind((f) => ({ ...f, [tab]: v }))} />
              {tab === "Conferences" && (
                <Select className="control" aria-label="Status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="any">Any status</option>
                  {["published", "rejected", "unpublished"].map((k) => <option key={k} value={k}>{STATUS[k]}</option>)}
                </Select>
              )}
              {tab === "Reports" && (
                <Select className="control" aria-label="Show" value={reportFilter} onChange={(e) => { setReportFilter(e.target.value); clearSel(); }}>
                  <option value="open">Open</option>
                  <option value="resolved">Resolved</option>
                  <option value="all">All</option>
                </Select>
              )}
              <span key={`${tab}${q}${statusFilter}${reportFilter}`} className={`t-swap muted ${s.searchCount}`} aria-live="polite">
                {searching ? `${tab === "Conferences" ? shownConfs.length : tab === "Reports" ? shownReports.length : tab === "Chambers" ? (chambers ?? []).filter((x) => `${x.name} ${x.owner_email} ${x.owner_name}`.toLowerCase().includes(q)).length : tab === "Users" ? shownUsers.length : shownLog.length} shown` : ""}
              </span>
            </div>
          )}
          {tab === "Review" && (pending.length === 0 ? (
            <Empty title="Nothing to review" body="New listings land here for approval." />
          ) : (
            <div className={`t-stagger ${s.stack}`}>
              {pending.map((r, i) => <ReviewCard key={r.id} r={r} i={i} picked={sel.includes(r.id)} onPick={() => toggle(r.id)} onApprove={(verified) => setStatus(r, "published", "", verified)} onReject={(note) => setStatus(r, "rejected", note)} />)}
            </div>
          ))}

          {tab === "Conferences" && (others.length === 0 ? (
            <Empty title="No conferences yet" body="Approved, rejected and taken-down listings show here." />
          ) : shownConfs.length === 0 ? noMatches : (
            <div className={s.tableWrap}>
              <table className={s.table}>
                <thead><tr>
                  <th className={s.pickCell}>
                    <label className={s.pick}><input type="checkbox" aria-label="Select all shown" checked={shownConfs.length > 0 && shownConfs.every((r) => sel.includes(r.id))} onChange={(e) => setSel(e.target.checked ? shownConfs.map((r) => r.id) : [])} /></label>
                  </th>
                  <th>Conference</th><th>Status</th><th>Dates</th><th className={s.right}>Actions</th>
                </tr></thead>
                <tbody>
                  {shownConfs.map((r) => (
                    <Fragment key={r.id}>
                    <tr data-picked={sel.includes(r.id) || undefined}>
                      <td className={s.pickCell}><label className={s.pick}><input type="checkbox" aria-label={`Select ${r.name}`} checked={sel.includes(r.id)} onChange={() => toggle(r.id)} /></label></td>
                      <td><strong>{r.name}{r.verified && <> <Verified /></>}</strong><small>{r.host}</small></td>
                      <td><span className={auth.status} data-status={r.status}>{STATUS[r.status]}</span></td>
                      <td>{dates(r)}</td>
                      <td className={s.right}>
                        <div className={s.actions}>
                          {r.status === "published" && <IconButton label={`View ${r.name}`} icon={ICONS.view} href={`/conferences/${r.slug}`} />}
                          <IconButton label={`Edit ${r.name}`} tip="Edit" icon={ICONS.edit} pressed={editing === r.id} onClick={() => setEditing(editing === r.id ? null : r.id)} />
                          <IconButton label={r.verified ? `Remove ${r.name}'s Verified badge` : `Verify ${r.name}`} icon={ICONS.verify} pressed={r.verified} onClick={() => setVerified(r)} />
                          {r.status === "published"
                            ? <IconButton label={`Take down ${r.name}`} icon={ICONS.hide} onClick={() => setStatus(r, "unpublished")} />
                            : <IconButton label={`Publish ${r.name}`} icon={ICONS.publish} onClick={() => setStatus(r, "published")} />}
                          <ConfirmIconButton label={`Delete ${r.name}`} confirm={`Click again to delete ${r.name} for good`} icon={ICONS.trash} onConfirm={() => remove(r)} />
                        </div>
                      </td>
                    </tr>
                    {editing === r.id && <tr><td colSpan={5} className={s.editCell}><EditConference r={r} onDone={(saved) => { setEditing(null); if (saved) { say("Saved"); load(); published(); } }} /></td></tr>}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          ))}

          {tab === "Reports" && ((reports ?? []).length === 0 ? (
            <Empty title="No reports" body="When someone reports a problem with a listing, it lands here." />
          ) : shownReports.length === 0 ? (
            <Empty title={q ? "No matches" : reportFilter === "open" ? "Nothing open" : "Nothing here"} body={q ? "Try a different word, or clear the search." : reportFilter === "open" ? "Every report has been dealt with." : "No reports match."}>
              {(q || reportFilter !== "open") && <button className="button secondary" onClick={clearSearch}>Show open reports</button>}
            </Empty>
          ) : (
            <div className={`t-stagger ${s.stack}`}>
              {shownReports.map((r, i) => (
                <article key={r.id} className={`panel ${s.report}`} data-resolved={r.status === "resolved" || undefined} style={{ "--i": Math.min(i, 8) } as React.CSSProperties}>
                  <label className={s.pick}><input type="checkbox" aria-label={`Select report about ${r.conferences?.name ?? "a listing"}`} checked={sel.includes(String(r.id))} onChange={() => toggle(String(r.id))} /></label>
                  <div className={s.reportBody}>
                    <div className={s.reportTop}>
                      <strong>{r.conferences?.name ?? "A deleted listing"}</strong>
                      <span className={s.reason} data-reason={r.reason}>{REASON[r.reason] ?? r.reason}</span>
                      {r.status === "resolved" && <span className={auth.status} data-status="published">Resolved</span>}
                    </div>
                    {r.note ? <p className={s.reportNote}>{r.note}</p> : <p className="muted">No message.</p>}
                    <p className={`muted ${s.reportMeta}`}>
                      {when(r.created_at)}
                      {r.reply_to && <> · <a className="link" href={`mailto:${r.reply_to}?subject=${encodeURIComponent(`About ${r.conferences?.name ?? "your report"} on Collex`)}`}>{r.reply_to}</a></>}
                    </p>
                  </div>
                  <div className={s.actions}>
                    {r.conferences && <IconButton label={`View ${r.conferences.name}`} tip="View listing" icon={ICONS.view} href={`/conferences/${r.conferences.slug}`} />}
                    {r.status === "open"
                      ? <IconButton label="Mark as resolved" tip="Resolve" icon={ICONS.check} onClick={() => setReport(r, "resolved")} />
                      : <IconButton label="Reopen this report" tip="Reopen" icon={ICONS.up} onClick={() => setReport(r, "open")} />}
                    <ConfirmIconButton label="Delete this report" confirm="Click again to delete this report" icon={ICONS.trash} onConfirm={() => removeReport(r)} />
                  </div>
                </article>
              ))}
            </div>
          ))}

          {tab === "Chambers" && <AdminChambers chambers={chambers ?? []} error={chambersError} say={say} reload={load} query={find.Chambers} />}

          {tab === "Users" && (shownUsers.length === 0 ? noMatches : (
            <div className={s.tableWrap}>
              <table className={s.table}>
                <thead><tr><th>Name</th><th>School</th><th>Joined</th><th className={s.right}>Actions</th></tr></thead>
                <tbody>
                  {shownUsers.map((u) => (
                    <tr key={u.id}>
                      <td><strong>{u.full_name || "No name"}</strong><small>{u.email}</small></td>
                      <td>{u.school || <span className="muted">Not set</span>}</td>
                      <td>{formatDate(u.created_at.slice(0, 10))}</td>
                      <td className={s.right}>
                        <div className={s.actions}>
                          {u.is_admin && <span className="badge accent">Admin</span>}
                          {u.id !== session.user.id && (u.is_admin ? (
                            <ConfirmIconButton label={`Remove admin access from ${u.full_name || u.email}`} confirm="Click again to remove admin access" icon={ICONS.removeAdmin} onConfirm={() => toggleAdmin(u)} />
                          ) : (<>
                            <IconButton label={`Make ${u.full_name || u.email} an admin`} icon={ICONS.makeAdmin} onClick={() => toggleAdmin(u)} />
                            <ConfirmIconButton label={`Delete user ${u.full_name || u.email}`} confirm={`Click again to delete ${u.full_name || u.email}'s account`} icon={ICONS.trash} onConfirm={() => removeUser(u)} />
                          </>))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}

          {tab === "Audit Log" && (log!.length === 0 ? (
            <Empty title="No activity yet" body="Every new account, listing, committee, approval and access change is recorded here." />
          ) : shownLog.length === 0 ? noMatches : (
            <>
              <ol id="audit-list" className={act.history} style={{ scrollMarginTop: 140 }}>
                {shownLog.slice(logAt * LOG_PER_PAGE, (logAt + 1) * LOG_PER_PAGE).map((e) => (
                  <li key={e.id}>
                    <span className={act.dot} data-tone={LOG_TONE[e.action] ?? (e.action === "edited" ? undefined : "accent")} aria-hidden="true" />
                    <div>
                      <p className={act.what}><strong>{e.actor_email}</strong> {LOG_WORDS[e.action] ?? e.action}{e.target_label ? ` ${e.target_label}` : ""}.</p>
                      <time className={act.when} dateTime={e.at}>{when(e.at)}</time>
                      {e.detail?.note ? <span className={act.quote}>&ldquo;{e.detail.note}&rdquo;</span> : null}
                    </div>
                  </li>
                ))}
              </ol>
              {logPages > 1 && (
                <nav className={act.pager} aria-label="Audit log pages">
                  <button type="button" className="button secondary" onClick={() => goLog(logAt - 1)} disabled={logAt === 0}>Previous</button>
                  <span className="muted" aria-live="polite">Page {logAt + 1} of {logPages}</span>
                  <button type="button" className="button secondary" onClick={() => goLog(logAt + 1)} disabled={logAt === logPages - 1}>Next</button>
                </nav>
              )}
            </>
          ))}
        </div>
      )}
      {bulkOn && (
        <div className={s.bulk} role="region" aria-label="Bulk actions">
          <div className={s.bulkLead}>
            <IconButton label="Clear the selection" tip="Clear (Esc)" icon={ICONS.close} onClick={clearSel} />
            <span className={s.bulkCount} aria-live="polite"><b>{sel.length}</b> selected</span>
          </div>
          <span className={s.bulkRule} aria-hidden="true" />
          <div className={s.bulkActions}>
            {tab === "Review" && (rejecting ? (
              <form className={s.bulkForm} onSubmit={(e) => { e.preventDefault(); bulk("rejected", () => confStatus("rejected", rejectNote.trim())); }}>
                <input className="control" placeholder="Reason, shown to each person" value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} aria-label="Reason for rejecting" autoFocus />
                <button className={`button ${s.bulkDanger}`} disabled={bulkBusy} data-armed>Reject {sel.length}</button>
                <button type="button" className="button secondary" onClick={() => setRejecting(false)}>Back</button>
              </form>
            ) : (<>
              <button className="button" disabled={bulkBusy} onClick={() => bulk("approved and live", () => confStatus("published"))}>Approve {sel.length}</button>
              <button className={`button secondary ${s.bulkDanger}`} disabled={bulkBusy} onClick={() => setRejecting(true)}>Reject…</button>
            </>))}
            {tab === "Conferences" && (<>
              <button className="button secondary" disabled={bulkBusy} onClick={() => bulk("published", () => confStatus("published"))}>Publish</button>
              <button className="button secondary" disabled={bulkBusy} onClick={() => bulk("taken down", () => confStatus("unpublished"))}>Take Down</button>
              <button className="button secondary" disabled={bulkBusy} onClick={() => bulk("verified", () => db().from("conferences").update({ verified: true }).in("id", sel))}>Verify</button>
              <button className="button secondary" disabled={bulkBusy} onClick={() => bulk("unverified", () => db().from("conferences").update({ verified: false }).in("id", sel))}>Unverify</button>
              <button className={`button secondary ${s.bulkDanger}`} data-armed={armed || undefined} disabled={bulkBusy} onClick={() => (armed ? bulk("deleted", () => db().from("conferences").delete().in("id", sel)) : setArmed(true))}>
                {armed ? `Click again to delete ${sel.length}` : "Delete"}
              </button>
            </>)}
            {tab === "Reports" && (<>
              <button className="button secondary" disabled={bulkBusy} onClick={() => bulk("resolved", () => db().from("reports").update({ status: "resolved", resolved_at: new Date().toISOString() }).in("id", reportIds), false)}>Resolve</button>
              <button className="button secondary" disabled={bulkBusy} onClick={() => bulk("reopened", () => db().from("reports").update({ status: "open", resolved_at: null }).in("id", reportIds), false)}>Reopen</button>
              <button className={`button secondary ${s.bulkDanger}`} data-armed={armed || undefined} disabled={bulkBusy} onClick={() => (armed ? bulk("deleted", () => db().from("reports").delete().in("id", reportIds), false) : setArmed(true))}>
                {armed ? `Click again to delete ${sel.length}` : "Delete"}
              </button>
            </>)}
          </div>
        </div>
      )}
      {node}
    </div>
  );
}

function Empty({ title, body, children }: { title: string; body: string; children?: React.ReactNode }) {
  return (
    <div className={s.empty}>
      <Placard />
      <p>{title}</p>
      <span>{body}</span>
      {children}
    </div>
  );
}

function ReviewCard({ r, i, picked, onPick, onApprove, onReject }: { r: Row; i: number; picked: boolean; onPick: () => void; onApprove: (verified: boolean) => void; onReject: (note: string) => void }) {
  const [rejecting, setRejecting] = useState(false);
  const [verified, setVerified] = useState(false);
  const [note, setNote] = useState("");
  const facts: [string, string | null][] = [
    ["Dates", dates(r)], ["Venue", r.venue], ["Level", r.level], ["Fee", r.fee], ["Contact", r.contact],
    ["Submitted by", r.submitter_role], ["Received", when(r.created_at)],
  ];
  return (
    <article className={`panel ${s.review}`} data-picked={picked || undefined} style={{ "--i": i } as React.CSSProperties}>
      <div className={s.reviewHead}>
        <div className={s.reviewWho}>
          <label className={s.pick}><input type="checkbox" aria-label={`Select ${r.name}`} checked={picked} onChange={onPick} /></label>
          <div>
            <h2 className={s.reviewTitle}>{r.name}</h2>
            <p className="muted">{r.host}</p>
          </div>
        </div>
        <div className={s.actions}>
          <button className="button secondary" onClick={() => setRejecting(!rejecting)} aria-expanded={rejecting}>Reject</button>
          <button className="button" onClick={() => onApprove(verified)}>Approve and publish</button>
        </div>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element -- the organiser's photo, shown so it can be checked before approving */}
      {r.cover_path && <img src={coverUrl(r.cover_path)!} alt={`Cover photo sent with ${r.name}`} className={s.reviewCover} style={{ objectPosition: coverPosition(r.cover_x, r.cover_y) ?? undefined }} />}
      <dl className={s.facts}>
        {facts.filter(([, v]) => v).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
        {webUrl(r.delegation_url) && <div><dt>Registration</dt><dd><a className="link" href={webUrl(r.delegation_url)!} target="_blank" rel="noreferrer">Open link</a></dd></div>}
        {webUrl(r.chair_url) && <div><dt>Chair applications</dt><dd><a className="link" href={webUrl(r.chair_url)!} target="_blank" rel="noreferrer">Open link</a></dd></div>}
        {webUrl(r.interest_url) && <div><dt>Interest form</dt><dd><a className="link" href={webUrl(r.interest_url)!} target="_blank" rel="noreferrer">Open link</a></dd></div>}
      </dl>
      <label className="check" style={{ marginTop: 16 }}>
        <input type="checkbox" checked={verified} onChange={(e) => setVerified(e.target.checked)} />
        <span>Sent by the conference&rsquo;s own secretariat. Show the Verified badge.</span>
      </label>
      {r.overview && <p className={s.overview}>{r.overview}</p>}
      {r.committees?.length > 0 && <p className="muted">Committees: {r.committees.map((c) => c.name).join(", ")}</p>}
      <div className={s.rejectWrap} data-open={rejecting}>
        <div>
          <form className={s.reject} onSubmit={(e) => { e.preventDefault(); onReject(note.trim()); }}>
            <input className="control" placeholder="Reason (shown to the person who listed it)" value={note} onChange={(e) => setNote(e.target.value)} tabIndex={rejecting ? 0 : -1} />
            <button className={`button ${s.dangerSolid}`} tabIndex={rejecting ? 0 : -1}>Reject listing</button>
          </form>
        </div>
      </div>
    </article>
  );
}


/** An admin's edit of a listing: the main details, saved straight to the conference and recorded in the audit log. */
function EditConference({ r, onDone }: { r: Row; onDone: (saved: boolean) => void }) {
  const [v, setV] = useState({
    name: r.name, host: r.host, venue: r.venue, start_date: r.start_date ?? "", end_date: r.end_date ?? "", level: r.level ?? "", contact: r.contact, fee: r.fee,
    overview: r.overview, delegation_url: r.delegation_url ?? "", chair_url: r.chair_url ?? "", interest_url: r.interest_url ?? "",
  });
  const { session } = useAuth();
  const [cover, setCover] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV((x) => ({ ...x, [k]: e.target.value }));
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (v.name.trim().length < 2) return setErr("A listing needs a name.");
    setBusy(true); setErr("");
    let cover_path: { cover_path: string } | null = null;
    if (cover) {
      const ext = COVER_TYPES[cover.type];
      if (!ext) { setBusy(false); return setErr("Use a JPG, PNG or WebP photo."); }
      if (cover.size > 5 * 1024 * 1024) { setBusy(false); return setErr("That photo is over 5 MB."); }
      const path = `${session!.user.id}/${crypto.randomUUID()}.${ext}`;
      const { error: upError } = await supabase!.storage.from("covers").upload(path, cover, { contentType: cover.type, cacheControl: "31536000" });
      if (upError) { setBusy(false); return setErr("The photo didn't upload. Try again."); }
      cover_path = { cover_path: path };
    }
    const patch = {
      ...cover_path,
      name: v.name.trim(), host: v.host.trim(), venue: v.venue.trim(), start_date: v.start_date || null, end_date: v.end_date || v.start_date || null, level: v.level.trim() || null,
      contact: v.contact.trim(), fee: v.fee.trim(), overview: v.overview, delegation_url: v.delegation_url.trim() || null, chair_url: v.chair_url.trim() || null, interest_url: v.interest_url.trim() || null,
    };
    const { error } = await supabase!.from("conferences").update(patch).eq("id", r.id);
    setBusy(false);
    if (error) return setErr(error.message);
    onDone(true);
  };
  const f = (id: string, label: string, k: keyof typeof v, type = "text") => (
    <div className="field"><label htmlFor={`ec-${r.id}-${id}`}>{label}</label><input id={`ec-${r.id}-${id}`} className="control" type={type} value={v[k]} onChange={set(k)} /></div>
  );
  return (
    <form className={s.editForm} onSubmit={save}>
      <div className={s.editGrid}>
        {f("name", "Name", "name")}
        {f("host", "Host School", "host")}
        {f("venue", "Venue", "venue")}
        {f("level", "Level", "level")}
        {f("start", "Starts", "start_date", "date")}
        {f("end", "Ends", "end_date", "date")}
        {f("fee", "Delegate Fee", "fee")}
        {f("contact", "Contact", "contact")}
        {f("deleg", "Delegation Link", "delegation_url", "url")}
        {f("chair", "Chair Link", "chair_url", "url")}
        {f("interest", "Interest Link", "interest_url", "url")}
      </div>
      <div className="field"><label htmlFor={`ec-${r.id}-ov`}>Overview</label><textarea id={`ec-${r.id}-ov`} className="control" rows={4} value={v.overview} onChange={set("overview")} /></div>
      <div className="field">
        <label htmlFor={`ec-${r.id}-cover`}>Cover Photo</label>
        <input id={`ec-${r.id}-cover`} className="control" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setCover(e.target.files?.[0] ?? null)} />
        <p className="muted">{cover ? cover.name : r.cover_path ? "A photo is set. Choose a file to replace it." : "JPG, PNG or WebP, up to 5 MB."}</p>
      </div>
      {err && <p className="muted" role="alert" style={{ color: "var(--danger)" }}>{err}</p>}
      <div className={s.actions} style={{ justifyContent: "flex-start" }}>
        <button type="submit" className="button" disabled={busy}>Save Changes</button>
        <button type="button" className="button secondary" onClick={() => onDone(false)}>Cancel</button>
      </div>
    </form>
  );
}
