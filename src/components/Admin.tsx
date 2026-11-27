"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { RowsSkeleton } from "./Skeleton";
import Photo from "./Photo";
import SearchBox from "./SearchBox";
import { Placard } from "./Drawings";
import Verified from "./Verified";
import IconButton, { ConfirmIconButton, ICONS } from "./IconButton";
import { Fragment, useCallback, useEffect, useState } from "react";
import { coverPosition, coverUrl, formatDate, webUrl } from "@/lib/conferences";
import { supabase } from "@/lib/supabase";
import { refreshSite } from "@/lib/refresh";
import { useAuth } from "./AuthProvider";
import PageBand from "./PageBand";
import { useToast } from "./useToast";
import auth from "@/app/auth.module.css";
import s from "@/app/admin.module.css";
import act from "./Activity.module.css";
import Select from "./Select";
import { AdminClaims } from "./HubExtras";
import AdminChambers, { type AdminChamber } from "./AdminChambers";
import { AdminVisitors, AdminErrors, type ClientError } from "./AdminPulse";
import AdminHealth from "./AdminHealth";
import AdminNotices from "./AdminNotices";

type Row = {
  id: string; slug: string; status: string; name: string; host: string; start_date: string | null; end_date: string | null;
  venue: string; level: string | null; contact: string; fee: string; overview: string; submitter_role: string;
  delegation_url: string | null; chair_url: string | null; interest_url?: string | null; committees: { name: string; topic: string }[]; cover_path?: string | null; thumb_path?: string | null; thumb_x?: number | null; thumb_y?: number | null; cover_x?: number | null; cover_y?: number | null;
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
const LOG_TONE: Record<string, string> = { approved: "ok", rejected: "bad", unpublished: "warn", reopened: "warn", submitted: "accent", "removed organiser": "bad", "left organisers": "warn", deleted: "bad", "created an account": "ok", "started a chamber": "accent", "shared a chamber": "accent", "hid an announcement": "warn", "deleted an announcement": "bad" };
// What the log says for each action: a person listing a conference reads as "listed".
const LOG_WORDS: Record<string, string> = { submitted: "listed", "started a chamber": "started a committee", "shared a chamber": "shared a committee" };

const COVER_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const REASON: Record<string, string> = { details: "Wrong or out of date", link: "Broken link", inappropriate: "Shouldn\u2019t be here", changed: "Links changed after approval", other: "Something else" };
type Tab = "Review" | "Conferences" | "Reports" | "Committees" | "Announcements" | "Users" | "Visitors" | "Errors" | "Health" | "Audit Log";
// The sidebar, in three groups: what's listed, who's here, and how the site is doing.
const GROUPS: { name: string; tabs: Tab[] }[] = [
  { name: "Listings", tabs: ["Review", "Conferences", "Reports"] },
  { name: "People", tabs: ["Users", "Committees"] },
  { name: "Site", tabs: ["Announcements", "Visitors", "Errors", "Health", "Audit Log"] },
];
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
  const [errors, setErrors] = useState<ClientError[] | null>(null);
  const [errorsFailed, setErrorsFailed] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  // One search per tab, so switching tabs keeps what you typed in each.
  const [find, setFind] = useState<Record<Tab, string>>({ Review: "", Conferences: "", Reports: "", Committees: "", Announcements: "", Users: "", Visitors: "", Errors: "", Health: "", "Audit Log": "" });
  // A new search starts on the first page of the audit log.
  const auditFind = find["Audit Log"];
  useEffect(() => { setLogPage(0); }, [auditFind]);
  const [statusFilter, setStatusFilter] = useState("any");
  const [reportFilter, setReportFilter] = useState("open");
  // Bulk actions: what's ticked on the open tab (ids as text), the reject reason being typed, and the two-step delete.
  const [sel, setSel] = useState<string[]>([]);
  const [rejecting, setRejecting] = useState(false);
  const [rejectNote, setRejectNote] = useState("");
  const [armed, setArmed] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  // A conference delete waiting for a yes: what goes with it is counted first, and taking it down is offered instead.
  const [del, setDel] = useState<{ ids: string[]; name: string; apps: number | null; regs: number | null; counted: boolean; live: number } | null>(null);
  const { say, node } = useToast();
  const router = useRouter();
  // Public pages pick up the change now, and so does this tab's copy of them.
  const published = () => refreshSite().then(() => router.refresh());

  const load = useCallback(async () => {
    if (!supabase) return;
    const [c, u, l, rp, ch, er] = await Promise.all([
      supabase.rpc("admin_conferences").order("created_at", { ascending: false }),
      supabase.from("profiles").select("id, email, full_name, school, role, is_admin, created_at").order("created_at", { ascending: false }),
      supabase.from("audit_log").select("*").order("at", { ascending: false }).limit(200),
      supabase.from("reports").select("id, conference_id, reason, note, reply_to, status, created_at, resolved_at, conferences(name, slug)").order("created_at", { ascending: false }).limit(200),
      supabase.rpc("admin_chambers"),
      supabase.rpc("admin_errors"),
    ]);
    setRows((c.data as Row[]) ?? []);
    setUsers((u.data as User[]) ?? []);
    setLog((l.data as Log[]) ?? []);
    setReports((rp.data as unknown as Report[] | null) ?? []);
    setChambersError(!!ch.error);
    setChambers((ch.data as AdminChamber[] | null) ?? []);
    setErrorsFailed(!!er.error);
    setErrors((er.data as ClientError[] | null) ?? []);
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
        {!session && <Link href="/login" className="button lg">Log In</Link>}
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
  // Counts what deleting would take with it, then asks. Nothing is deleted until the person confirms.
  const askDelete = async (ids: string[]) => {
    const picked = (rows ?? []).filter((r) => ids.includes(r.id));
    const name = picked.length === 1 ? picked[0].name : `${picked.length} conferences`;
    setDel({ ids, name, apps: null, regs: null, counted: false, live: picked.filter((r) => r.status === "published").length });
    const count = async (table: string) => {
      const { count, error } = await supabase!.from(table).select("id", { count: "exact", head: true }).in("conference_id", ids);
      return error ? null : count ?? 0;
    };
    const [apps, regs] = await Promise.all([count("applications"), count("registrations")]);
    setDel((d) => (d && d.ids === ids ? { ...d, apps, regs, counted: true } : d));
  };
  const confirmDelete = async (takeDown: boolean) => {
    if (!del) return;
    setBulkBusy(true);
    const { error } = takeDown
      ? await supabase!.from("conferences").update({ status: "unpublished" }).in("id", del.ids)
      : await supabase!.from("conferences").delete().in("id", del.ids);
    setBulkBusy(false);
    if (error) return say("That didn't save. Try again.");
    say(takeDown ? "Taken down" : "Deleted");
    setDel(null);
    clearSel();
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
  const counts: Record<Tab, number | null> = { Review: pending.length, Conferences: others.length, Reports: openReports.length, Committees: chambers?.length ?? null, Announcements: null, Users: users?.length ?? null, Visitors: null, Errors: errors?.length ?? null, Health: null, "Audit Log": null };
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
  const noMatches = <Empty title="No matches" body="Try a different word, or clear the search."><button className="button secondary" onClick={clearSearch}>Clear Search</button></Empty>;
  const searchFor: Partial<Record<Tab, string>> = { Conferences: "Search by name, host, venue or status", Reports: "Search by listing, reason or message", Committees: "Search by name, owner or where it is", Users: "Search by name, email or school", Errors: "Search by message or page", "Audit Log": "Search by who, action or what" };

  return (
    <div className={s.wrap}>
      <PageBand title="Admin" figures={[
        { label: "To Review", value: rows === null ? "…" : String(pending.length) },
        { label: "Open Reports", value: reports === null ? "…" : String(openReports.length) },
        { label: "Users", value: users === null ? "…" : String(users.length) },
      ]} />
      <div className={s.layout}>
      <nav className={s.side} aria-label="Admin sections">
        {GROUPS.map((g) => (
          <div key={g.name} className={s.group}>
            <p className={s.groupName}>{g.name}</p>
            <ul className={s.groupList}>
              {g.tabs.map((t) => (
                <li key={t}>
                  <button type="button" className={s.sideLink} aria-current={tab === t ? "true" : undefined} onClick={() => { clearSel(); setTab(t); }}>
                    <span>{t}</span>{counts[t] ? <span className={s.count}>{counts[t]}</span> : null}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className={s.pane}>
      {rows === null ? <RowsSkeleton rows={4} height={72} /> : (
        <div key={tab} className="t-reveal">
          {searchFor[tab] && (tab !== "Conferences" || others.length > 0) && (tab !== "Reports" || (reports ?? []).length > 0) && (tab !== "Audit Log" || log!.length > 0) && (tab !== "Committees" || (chambers ?? []).length > 0) && (tab !== "Errors" || ((errors ?? []).length > 0 && !errorsFailed)) && (
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
              {searching && <span key={`${tab}${q}${statusFilter}${reportFilter}`} className={`t-swap muted ${s.searchCount}`} aria-live="polite">
                { `${tab === "Conferences" ? shownConfs.length : tab === "Reports" ? shownReports.length : tab === "Committees" ? (chambers ?? []).filter((x) => `${x.name} ${x.owner_email} ${x.owner_name}`.toLowerCase().includes(q)).length : tab === "Users" ? shownUsers.length : tab === "Errors" ? (errors ?? []).filter((x) => `${x.message} ${x.path}`.toLowerCase().includes(q)).length : shownLog.length} shown`}
              </span>}
            </div>
          )}
          {tab === "Review" && <AdminClaims say={say} />}
          {tab === "Review" && (pending.length === 0 ? (
            <Empty title="No listings to review yet" body="New listings land here for approval." />
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
                          <ConfirmIconButton label={`Delete ${r.name}`} confirm={`Click again to delete ${r.name} for good`} icon={ICONS.trash} onConfirm={() => askDelete([r.id])} />
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
            <Empty title="No reports yet" body="When someone reports a problem with a listing, it lands here." />
          ) : shownReports.length === 0 ? (
            <Empty title={q ? "No matches" : reportFilter === "open" ? "No open reports" : "No reports here"} body={q ? "Try a different word, or clear the search." : reportFilter === "open" ? "Every report has been dealt with." : "No reports match."}>
              {(q || reportFilter !== "open") && <button className="button secondary" onClick={clearSearch}>Show Open Reports</button>}
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

          {tab === "Committees" && <AdminChambers chambers={chambers ?? []} error={chambersError} say={say} reload={load} query={find.Committees} />}

          {tab === "Announcements" && <AdminNotices say={say} />}

          {tab === "Visitors" && <AdminVisitors />}

          {tab === "Health" && <AdminHealth />}

          {tab === "Errors" && <AdminErrors errors={errors ?? []} error={errorsFailed} say={say} reload={load} query={find.Errors} />}

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
              <div className={`panel ${s.logBox}`}>
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
                  {logAt === 0 ? <span className="tip" data-tip="You’re on the first page"><button type="button" className="button secondary" onClick={() => goLog(logAt - 1)} disabled={logAt === 0}>Previous</button></span> : <button type="button" className="button secondary" onClick={() => goLog(logAt - 1)} disabled={logAt === 0}>Previous</button>}
                  <span className="muted" aria-live="polite">Page {logAt + 1} of {logPages}</span>
                  {logAt === logPages - 1 ? <span className="tip" data-tip="You’re on the last page"><button type="button" className="button secondary" onClick={() => goLog(logAt + 1)} disabled={logAt === logPages - 1}>Next</button></span> : <button type="button" className="button secondary" onClick={() => goLog(logAt + 1)} disabled={logAt === logPages - 1}>Next</button>}
                </nav>
              )}
              </div>
            </>
          ))}
        </div>
      )}
      </div>
      </div>
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
                {bulkBusy ? <span className="tip" data-tip="Working on the last change" data-tip-align="start"><button className={`button ${s.bulkDanger}`} disabled data-armed>Reject {sel.length}</button></span>
                  : <button className={`button ${s.bulkDanger}`} data-armed>Reject {sel.length}</button>}
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
              <button className={`button secondary ${s.bulkDanger}`} disabled={bulkBusy} onClick={() => askDelete(sel)}>Delete…</button>
            </>)}
            {tab === "Reports" && (<>
              <button className="button secondary" disabled={bulkBusy} onClick={() => bulk("resolved", () => db().from("reports").update({ status: "resolved", resolved_at: new Date().toISOString() }).in("id", reportIds), false)}>Resolve</button>
              <button className="button secondary" disabled={bulkBusy} onClick={() => bulk("reopened", () => db().from("reports").update({ status: "open", resolved_at: null }).in("id", reportIds), false)}>Reopen</button>
              <button className={`button secondary ${s.bulkDanger}`} data-armed={armed || undefined} disabled={bulkBusy} onClick={() => (armed ? bulk("deleted", () => db().from("reports").delete().in("id", reportIds), false) : setArmed(true))}>
                {armed ? `Click Again to Delete ${sel.length}` : "Delete"}
              </button>
            </>)}
          </div>
        </div>
      )}
      {del && (
        <div className={`panel t-reveal ${s.confirmDel}`} role="alertdialog" aria-label="Delete conference">
          <p><strong>Delete {del.name} for good?</strong></p>
          <p className="muted">
            {!del.counted ? "Counting what goes with it…"
              : <>This also deletes {del.apps === null ? "its applications" : `${del.apps} ${del.apps === 1 ? "application" : "applications"}`} and {del.regs === null ? "its registrations" : `${del.regs} ${del.regs === 1 ? "registration" : "registrations"}`}, and can’t be undone.</>}
            {del.live > 0 && " It’s live now, so it will disappear from the site."} Taking it down hides it and keeps everything.
          </p>
          <div className="actions">
            <button type="button" className="button" disabled={bulkBusy} onClick={() => confirmDelete(true)}>Unpublish Instead</button>
            <button type="button" className={`button secondary ${s.dangerBtn}`} disabled={bulkBusy || !del.counted} onClick={() => confirmDelete(false)}>Delete for Good</button>
            <button type="button" className="button secondary" disabled={bulkBusy} onClick={() => setDel(null)}>Cancel</button>
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
          <button className="button" onClick={() => onApprove(verified)}>Approve and Publish</button>
        </div>
      </div>
      {r.cover_path && <Photo src={coverUrl(r.cover_path)!} alt={`Cover photo sent with ${r.name}`} className={s.reviewCover} width={1600} height={500} sizes="(max-width: 720px) 100vw, 720px" style={{ height: "auto", objectPosition: coverPosition(r.cover_x, r.cover_y) ?? undefined }} />}
      {r.thumb_path && <Photo src={coverUrl(r.thumb_path)!} alt={`Photo in the lists sent with ${r.name}`} className={s.reviewCover} width={240} height={240} sizes="120px" style={{ width: 120, height: "auto", aspectRatio: "1", objectPosition: coverPosition(r.thumb_x, r.thumb_y) ?? undefined }} />}
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
            <button className={`button ${s.dangerSolid}`} tabIndex={rejecting ? 0 : -1}>Reject Listing</button>
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
  const [thumb, setThumb] = useState<File | null>(null);
  // A saved photo marked to go: cleared (with where it was framed) when the edit is saved, unless a new file replaces it.
  const [drop, setDrop] = useState({ cover: false, thumb: false });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV((x) => ({ ...x, [k]: e.target.value }));
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (v.name.trim().length < 2) return setErr("A listing needs a name.");
    setBusy(true); setErr("");
    // The cover and the photo in the lists (a logo, say) go up the same way, each into the admin's own folder.
    const upload = async (file: File): Promise<string | null> => {
      const ext = COVER_TYPES[file.type];
      if (!ext) { setErr("Use a JPG, PNG or WebP photo."); return null; }
      if (file.size > 5 * 1024 * 1024) { setErr("That photo is over 5 MB."); return null; }
      const path = `${session!.user.id}/${crypto.randomUUID()}.${ext}`;
      const { error: upError } = await supabase!.storage.from("covers").upload(path, file, { contentType: file.type, cacheControl: "31536000" });
      if (upError) { setErr("The photo didn't upload. Try again."); return null; }
      return path;
    };
    const photos: Record<string, string | null> = {};
    if (drop.cover && !cover) Object.assign(photos, { cover_path: null, cover_x: null, cover_y: null });
    if (drop.thumb && !thumb) Object.assign(photos, { thumb_path: null, thumb_x: null, thumb_y: null });
    if (cover) { const path = await upload(cover); if (!path) return setBusy(false); photos.cover_path = path; }
    if (thumb) { const path = await upload(thumb); if (!path) return setBusy(false); photos.thumb_path = path; }
    const patch = {
      ...photos,
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
        <p className="muted">{cover ? cover.name : r.cover_path ? (drop.cover ? "The photo will be removed when you save." : "A photo is set. Choose a file to replace it.") : "JPG, PNG or WebP, up to 5 MB."}</p>
        {r.cover_path && !cover && <button type="button" className="link" style={{ alignSelf: "flex-start" }} onClick={() => setDrop((d) => ({ ...d, cover: !d.cover }))}>{drop.cover ? "Keep Photo" : "Remove Photo"}</button>}
      </div>
      <div className="field">
        <label htmlFor={`ec-${r.id}-thumb`}>Photo in the Lists</label>
        <input id={`ec-${r.id}-thumb`} className="control" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setThumb(e.target.files?.[0] ?? null)} />
        <p className="muted">{thumb ? thumb.name : r.thumb_path ? (drop.thumb ? "The photo will be removed when you save." : "A photo is set. Choose a file to replace it.") : "A logo or square photo for the lists. Without one, the lists use the cover."}</p>
        {r.thumb_path && !thumb && <button type="button" className="link" style={{ alignSelf: "flex-start" }} onClick={() => setDrop((d) => ({ ...d, thumb: !d.thumb }))}>{drop.thumb ? "Keep Photo" : "Remove Photo"}</button>}
      </div>
      {err && <p className="muted" role="alert" style={{ color: "var(--danger)" }}>{err}</p>}
      <div className={s.actions} style={{ justifyContent: "flex-start" }}>
        <button type="submit" className="button" disabled={busy}>Save Changes</button>
        <button type="button" className="button secondary" onClick={() => onDone(false)}>Cancel</button>
      </div>
    </form>
  );
}
