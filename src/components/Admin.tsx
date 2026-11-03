"use client";

import Link from "next/link";
import { RowsSkeleton } from "./Skeleton";
import { useCallback, useEffect, useRef, useState } from "react";
import { formatDate, webUrl } from "@/lib/conferences";
import { supabase } from "@/lib/supabase";
import { useAuth } from "./AuthProvider";
import { usePill } from "./usePill";
import { useToast } from "./useToast";
import auth from "@/app/auth.module.css";
import s from "@/app/admin.module.css";

type Row = {
  id: string; slug: string; status: string; name: string; host: string; start_date: string | null; end_date: string | null;
  venue: string; level: string | null; contact: string; fee: string; overview: string; submitter_role: string;
  delegation_url: string | null; chair_url: string | null; committees: { name: string; topic: string }[];
  review_note: string; created_at: string;
};
type User = { id: string; email: string; full_name: string; school: string; role: string; is_admin: boolean; created_at: string };
type Log = { id: number; at: string; actor_email: string; action: string; target_type: string; target_label: string; detail: { note?: string } };

const TABS = ["Review", "Conferences", "Users", "Audit log"] as const;
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
  const { say, node } = useToast();
  const tabsRef = useRef<HTMLDivElement>(null);
  const pill = usePill(tabsRef, '[aria-selected="true"]', `${tab}${profile?.is_admin}`);

  const load = useCallback(async () => {
    if (!supabase) return;
    const [c, u, l] = await Promise.all([
      supabase.from("conferences").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("id, email, full_name, school, role, is_admin, created_at").order("created_at", { ascending: false }),
      supabase.from("audit_log").select("*").order("at", { ascending: false }).limit(200),
    ]);
    setRows((c.data as Row[]) ?? []);
    setUsers((u.data as User[]) ?? []);
    setLog((l.data as Log[]) ?? []);
  }, []);

  useEffect(() => { if (profile?.is_admin) load(); }, [profile?.is_admin, load]);

  if (!ready) return <RowsSkeleton rows={5} height={72} />;
  if (!session || !profile?.is_admin) {
    return (
      <div className={`t-reveal ${auth.form}`}>
        <h1 className={auth.title}>Admins only</h1>
        <p className="muted">{session ? "Your account doesn't have admin access." : "Log in with an admin account to continue."}</p>
        {!session && <Link href="/login" className="button lg">Log in</Link>}
      </div>
    );
  }

  const setStatus = async (r: Row, status: string, note = "") => {
    const { error } = await supabase!.from("conferences").update({ status, review_note: note }).eq("id", r.id);
    if (error) return say("That didn't save. Try again.");
    say(status === "published" ? `${r.name} is live` : status === "rejected" ? "Rejected" : status === "unpublished" ? "Taken down" : "Updated");
    load();
  };
  const remove = async (r: Row) => {
    const { error } = await supabase!.from("conferences").delete().eq("id", r.id);
    if (error) return say("That didn't delete. Try again.");
    say("Deleted");
    load();
  };
  const toggleAdmin = async (u: User) => {
    const { error } = await supabase!.rpc("set_admin", { target: u.id, make_admin: !u.is_admin });
    if (error) return say(error.message);
    say(u.is_admin ? "Admin access removed" : `${u.full_name || u.email} is now an admin`);
    load();
  };

  const pending = rows?.filter((r) => r.status === "pending") ?? [];
  const others = rows?.filter((r) => r.status !== "pending") ?? [];
  const counts: Record<Tab, number | null> = { Review: pending.length, Conferences: others.length, Users: users?.length ?? null, "Audit log": null };

  return (
    <div className={s.wrap}>
      <header className={s.head}>
        <h1 className={auth.title}>Admin</h1>
        <div ref={tabsRef} className={s.tabs} role="tablist">
          <span ref={pill} className={`t-pill ${s.tabPill}`} aria-hidden="true" />
          {TABS.map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>
              {t}{counts[t] ? <span className={s.count}>{counts[t]}</span> : null}
            </button>
          ))}
        </div>
      </header>

      {rows === null ? <RowsSkeleton rows={4} height={72} /> : (
        <div key={tab} className="t-reveal">
          {tab === "Review" && (pending.length === 0 ? (
            <Empty title="Nothing to review" body="New listings land here for approval." />
          ) : (
            <div className={`t-stagger ${s.stack}`}>
              {pending.map((r, i) => <ReviewCard key={r.id} r={r} i={i} onApprove={() => setStatus(r, "published")} onReject={(note) => setStatus(r, "rejected", note)} />)}
            </div>
          ))}

          {tab === "Conferences" && (others.length === 0 ? (
            <Empty title="No conferences yet" body="Approved, rejected and taken-down listings show here." />
          ) : (
            <div className={s.tableWrap}>
              <table className={s.table}>
                <thead><tr><th>Conference</th><th>Status</th><th>Dates</th><th className={s.right}>Actions</th></tr></thead>
                <tbody>
                  {others.map((r) => (
                    <tr key={r.id}>
                      <td><strong>{r.name}</strong><small>{r.host}</small></td>
                      <td><span className={auth.status} data-status={r.status}>{STATUS[r.status]}</span></td>
                      <td>{dates(r)}</td>
                      <td className={s.right}>
                        <div className={s.actions}>
                          {r.status === "published" && <Link href={`/conferences/${r.slug}`} className="button secondary">View</Link>}
                          {r.status === "published"
                            ? <button className="button secondary" onClick={() => setStatus(r, "unpublished")}>Take down</button>
                            : <button className="button secondary" onClick={() => setStatus(r, "published")}>Publish</button>}
                          <Confirm label="Delete" confirm="Delete for good?" onConfirm={() => remove(r)} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}

          {tab === "Users" && (
            <div className={s.tableWrap}>
              <table className={s.table}>
                <thead><tr><th>Name</th><th>School</th><th>Joined</th><th className={s.right}>Access</th></tr></thead>
                <tbody>
                  {users!.map((u) => (
                    <tr key={u.id}>
                      <td><strong>{u.full_name || "No name"}</strong><small>{u.email}</small></td>
                      <td>{u.school || <span className="muted">Not set</span>}</td>
                      <td>{formatDate(u.created_at.slice(0, 10))}</td>
                      <td className={s.right}>
                        <div className={s.actions}>
                          {u.is_admin && <span className="badge accent">Admin</span>}
                          {u.id !== session.user.id && (
                            u.is_admin
                              ? <Confirm label="Remove admin" confirm="Remove admin?" onConfirm={() => toggleAdmin(u)} />
                              : <button className="button secondary" onClick={() => toggleAdmin(u)}>Make admin</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === "Audit log" && (log!.length === 0 ? (
            <Empty title="No activity yet" body="Every submission, approval and access change is recorded here." />
          ) : (
            <ol className={s.log}>
              {log!.map((e) => (
                <li key={e.id}>
                  <time>{when(e.at)}</time>
                  <span><strong>{e.actor_email}</strong> <span className={s.action} data-action={e.action}>{e.action}</span> {e.target_label}</span>
                  {e.detail?.note ? <small className="muted">“{e.detail.note}”</small> : null}
                </li>
              ))}
            </ol>
          ))}
        </div>
      )}
      {node}
    </div>
  );
}

function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className={s.empty}>
      <p>{title}</p>
      <span>{body}</span>
    </div>
  );
}

// A button that asks once more before doing something destructive.
function Confirm({ label, confirm, onConfirm }: { label: string; confirm: string; onConfirm: () => void }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button className={`button secondary ${armed ? s.danger : ""}`} onClick={() => (armed ? onConfirm() : setArmed(true))}>
      <span key={String(armed)} className="t-swap">{armed ? confirm : label}</span>
    </button>
  );
}

function ReviewCard({ r, i, onApprove, onReject }: { r: Row; i: number; onApprove: () => void; onReject: (note: string) => void }) {
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  const facts: [string, string | null][] = [
    ["Dates", dates(r)], ["Venue", r.venue], ["Level", r.level], ["Fee", r.fee], ["Contact", r.contact],
    ["Submitted by", r.submitter_role], ["Received", when(r.created_at)],
  ];
  return (
    <article className={`panel ${s.review}`} style={{ "--i": i } as React.CSSProperties}>
      <div className={s.reviewHead}>
        <div>
          <h2 className={s.reviewTitle}>{r.name}</h2>
          <p className="muted">{r.host}</p>
        </div>
        <div className={s.actions}>
          <button className="button secondary" onClick={() => setRejecting(!rejecting)} aria-expanded={rejecting}>Reject</button>
          <button className="button" onClick={onApprove}>Approve and publish</button>
        </div>
      </div>
      <dl className={s.facts}>
        {facts.filter(([, v]) => v).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
        {webUrl(r.delegation_url) && <div><dt>Registration</dt><dd><a className="link" href={webUrl(r.delegation_url)!} target="_blank" rel="noreferrer">Open link</a></dd></div>}
        {webUrl(r.chair_url) && <div><dt>Chair applications</dt><dd><a className="link" href={webUrl(r.chair_url)!} target="_blank" rel="noreferrer">Open link</a></dd></div>}
      </dl>
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
