"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useEffect, useState } from "react";
import { CodeBoxes } from "./CodeInput";
import { useAuth } from "./AuthProvider";
import IconButton, { ConfirmIconButton, ICONS } from "./IconButton";
import { supabase } from "@/lib/supabase";
import { Gavel } from "./Drawings";
import board from "./board.module.css";
import s from "@/app/admin.module.css";
import c from "./AdminChambers.module.css";
import { STEP, ago, procName } from "@/lib/chamberLabels";

export type AdminChamber = {
  id: string; name: string; owner_email: string; owner_name: string; members: number; version: number; created_at: string; updated_at: string;
  summary: { rules?: string; step?: string; topic?: string; delegates?: number; log?: { at: number; text: string }[] };
  /** The admin looking: "owner", "admin" (on it as Admin), "chair", or null when not on it. Missing before migration 0023. */
  my_role?: "owner" | "admin" | "chair" | null; join_code?: string | null;
};
type Person = { user_id: string; name: string; email: string; is_owner: boolean; role?: "owner" | "admin" | "chair" };
const ROLE = { owner: "Owner", admin: "Admin", chair: "Chair" } as const;
const ENTER = <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9.5 2.5h3a1 1 0 011 1v9a1 1 0 01-1 1h-3" /><path d="M6 5l3 3-3 3M9 8H2.5" /></svg>;
const MONITOR = <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="1.8" y="2.5" width="12.4" height="8.5" rx="1.6" /><path d="M5.5 13.5h5M8 11v2.5" /></svg>;

const stamp = (n: number) => new Date(n).toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit", second: "2-digit" });
const where = (x: AdminChamber) => {
  const sm = x.summary;
  const proc = procName(sm.rules);
  return { proc, step: STEP[sm.step ?? ""] ?? sm.step ?? "Unknown" };
};

/** Every shared committee: where it is, who runs it, and the tools to look inside, fix, download or delete it. */
export default function AdminChambers({ chambers, error, say, reload, query }: { chambers: AdminChamber[]; error: boolean; say: (t: string) => void; reload: () => void; query: string }) {
  const router = useRouter();
  const [open, setOpen] = useState<string | null>(null);
  const [edit, setEdit] = useState<string | null>(null);
  const [raw, setRaw] = useState<Record<string, string>>({});
  const [name, setName] = useState("");
  const [topic, setTopic] = useState("");
  const [showRaw, setShowRaw] = useState(false);
  const [rawText, setRawText] = useState("");

  if (error) {
    return (
      <div className={s.empty}>
        <p>The Committee Tools Aren&apos;t Set Up Yet</p>
        <span>Apply database migration 0021 (supabase/migrations/0021_admin_chambers_audit.sql), then reload this page.</span>
      </div>
    );
  }
  const q = query.trim().toLowerCase();
  const shown = chambers.filter((x) => !q || [x.name, x.owner_email, x.owner_name, x.summary.topic, where(x).proc, where(x).step].join(" ").toLowerCase().includes(q));
  if (chambers.length === 0) {
    return (
      <div className={s.empty}>
        <p>No Shared Committees</p>
        <span>Committees show here once a chair shares them. A committee only saved in someone&apos;s browser can&apos;t be seen.</span>
      </div>
    );
  }
  if (shown.length === 0) return <div className={s.empty}><p>No Matches</p><span>Try a different word.</span></div>;

  const state = async (id: string) => {
    if (raw[id]) return raw[id];
    const { data, error: e } = await supabase!.rpc("admin_chamber_state", { cid: id });
    if (e) { say(e.message); return ""; }
    const text = JSON.stringify(data, null, 2);
    setRaw((r) => ({ ...r, [id]: text }));
    return text;
  };
  const toggle = async (x: AdminChamber) => {
    if (open === x.id) { setOpen(null); setEdit(null); return; }
    setOpen(x.id); setEdit(null); setShowRaw(false);
    void state(x.id);
  };
  const startEdit = async (x: AdminChamber) => {
    setOpen(x.id); setEdit(x.id); setName(x.name); setTopic(x.summary.topic ?? ""); setShowRaw(false);
    setRawText(await state(x.id));
  };
  const save = async (x: AdminChamber) => {
    let parsed: unknown = null;
    if (showRaw) {
      try { parsed = JSON.parse(rawText); } catch { return say("That isn't valid JSON"); }
    }
    // The person running it may have moved on since this was opened. Read it again, and refuse rather than overwrite them.
    const fresh = await supabase!.rpc("admin_chambers");
    if (fresh.error) return say("Couldn’t check for changes. Try again.");
    const now = ((fresh.data as AdminChamber[] | null) ?? []).find((c) => c.id === x.id);
    if (!now) { reload(); return say("This committee was deleted while you were editing it."); }
    if (now.version !== x.version || now.updated_at !== x.updated_at) {
      setRaw((r) => { const n = { ...r }; delete n[x.id]; return n; });
      setEdit(null);
      reload();
      return say("Someone changed this committee while you were editing. Your changes weren’t saved. Open it again to see theirs.");
    }
    const { error: e } = await supabase!.rpc("admin_edit_chamber", { cid: x.id, new_name: name, new_topic: showRaw ? null : topic, new_state: parsed });
    if (e) return say(e.message);
    say("Saved");
    setEdit(null);
    setRaw((r) => { const n = { ...r }; delete n[x.id]; return n; });
    reload();
  };
  const remove = async (x: AdminChamber) => {
    const { error: e } = await supabase!.rpc("delete_chamber", { cid: x.id });
    if (e) return say(e.message);
    say("Deleted");
    reload();
  };
  const download = async (x: AdminChamber) => {
    const text = await state(x.id);
    if (!text) return;
    const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url; a.download = `${x.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "chamber"}.json`; a.click();
    URL.revokeObjectURL(url);
  };
  const copy = (id: string) => { void navigator.clipboard?.writeText(id); say("ID copied"); };
  // Puts this admin on the committee as Admin (no seat taken), then opens its console.
  const enter = async (x: AdminChamber) => {
    if (x.my_role !== "owner" && x.my_role !== "admin") {
      const { error: e } = await supabase!.rpc("admin_join_chamber", { cid: x.id });
      if (e) return say(e.message);
    }
    router.push(`/chambers?c=${x.id}`);
  };

  return (
    <div className={s.tableWrap}>
      <table className={s.table}>
        <thead><tr><th>Committee</th><th>Run By</th><th>Where It Is</th><th>Updated</th><th className={s.right}>Actions</th></tr></thead>
        <tbody>
          {shown.map((x) => {
            const w = where(x);
            return (
              <Fragment key={x.id}>
                <tr>
                  <td>
                    <strong className={c.nameLine}>{x.name}{x.my_role && <span className={`badge${x.my_role === "admin" ? " accent" : ""}`}>{x.my_role === "admin" ? "You're Admin" : `You're ${ROLE[x.my_role]}`}</span>}</strong>
                    <small>{x.summary.topic || "No topic"}</small>
                  </td>
                  <td><strong>{x.owner_name || "No name"}</strong><small>{x.owner_email}</small></td>
                  <td><strong>{w.step}</strong><small>{w.proc} · {x.summary.delegates ?? 0} states</small></td>
                  <td>{ago(x.updated_at)}</td>
                  <td className={s.right}>
                    <div className={s.actions}>
                      <IconButton label={x.my_role === "admin" || x.my_role === "owner" ? `Open the console for ${x.name}` : `Join ${x.name} as Admin and open its console`} tip={x.my_role === "admin" || x.my_role === "owner" ? "Open console" : "Enter as Admin"} icon={ENTER} onClick={() => void enter(x)} />
                      <IconButton label={open === x.id ? `Hide ${x.name}` : `Look inside ${x.name}`} tip="Look inside" icon={ICONS.view} pressed={open === x.id} onClick={() => toggle(x)} />
                      <IconButton label={`Edit ${x.name}`} tip="Edit" icon={ICONS.edit} onClick={() => startEdit(x)} />
                      <ConfirmIconButton label={`Delete ${x.name}`} confirm={`Click again to delete ${x.name} for good`} icon={ICONS.trash} onConfirm={() => remove(x)} />
                    </div>
                  </td>
                </tr>
                {open === x.id && (
                  <tr>
                    <td colSpan={5} className={c.detail}>
                      {edit === x.id ? (
                        <form className={c.editForm} onSubmit={(e) => { e.preventDefault(); void save(x); }}>
                          {!showRaw ? (
                            <div className={c.two}>
                              <div className="field"><label htmlFor={`an-${x.id}`}>Name</label><input id={`an-${x.id}`} className="control" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} /></div>
                              <div className="field"><label htmlFor={`at-${x.id}`}>Topic</label><input id={`at-${x.id}`} className="control" value={topic} maxLength={160} onChange={(e) => setTopic(e.target.value)} /></div>
                            </div>
                          ) : (
                            <div className="field">
                              <label htmlFor={`ar-${x.id}`}>Saved State (JSON)</label>
                              <textarea id={`ar-${x.id}`} className={`control ${c.json}`} rows={14} value={rawText} onChange={(e) => setRawText(e.target.value)} spellCheck={false} />
                              <small className="muted">This replaces what is saved and every device follows it. Only use it to put a stuck committee right.</small>
                            </div>
                          )}
                          <div className={c.row}>
                            <button type="submit" className="button">Save</button>
                            <button type="button" className="button secondary" onClick={() => setShowRaw((v) => !v)}>{showRaw ? "Back to the Simple Form" : "Edit the Raw State"}</button>
                            <button type="button" className="button secondary" onClick={() => setEdit(null)}>Cancel</button>
                          </div>
                        </form>
                      ) : (
                        <Inside x={x} say={say} reload={reload} enter={() => void enter(x)} download={() => download(x)} copyId={() => copy(x.id)} raw={raw[x.id]} />
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** One committee, opened up: what it is, who is on it, its join code, what happened lately, and the tools. */
function Inside({ x, say, reload, enter, download, copyId, raw }: {
  x: AdminChamber; say: (t: string) => void; reload: () => void; enter: () => void; download: () => void; copyId: () => void; raw?: string;
}) {
  const me = useAuth().session?.user.id;
  const [team, setTeam] = useState<Person[] | null>(null);
  const [code, setCode] = useState<string | null>(x.join_code ?? null);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const loadTeam = async () => {
    const { data, error } = await supabase!.rpc("chamber_team", { cid: x.id });
    if (error) { say(error.message); setTeam([]); return; }
    setTeam((data as Person[] | null) ?? []);
  };
  useEffect(() => { void loadTeam(); }, [x.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const mine = x.my_role === "admin" || x.my_role === "owner";
  const w = where(x);

  const run = async (fn: () => PromiseLike<{ error: { message: string } | null }>, done: string, after?: () => void) => {
    setBusy(true);
    const { error } = await fn();
    setBusy(false);
    if (error) return say(error.message);
    say(done);
    after?.();
  };
  const codeDo = (action: "new" | "off") => run(
    () => supabase!.rpc("chamber_code", { cid: x.id, action }).then((r) => { if (!r.error) setCode((r.data as string | null) ?? null); return r; }),
    action === "off" ? "Join code turned off" : "New join code made", reload);
  const remove = (p: Person) => run(() => supabase!.rpc("remove_chamber_member", { cid: x.id, target: p.user_id }),
    p.user_id === me ? "You left the committee" : `${p.name || p.email} removed`, () => { void loadTeam(); reload(); });
  const add = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    void run(() => supabase!.rpc("add_chamber_member", { cid: x.id, invitee_email: email }), `If ${email.trim().toLowerCase()} has a Collex account, they've been added.`, () => {
      setEmail(""); supabase!.functions.invoke("chamber-invite").catch(() => {}); void loadTeam(); reload();
    });
  };
  const copy = (text: string, done: string) => navigator.clipboard?.writeText(text).then(() => say(done), () => say("Couldn't copy"));

  return (
    <div className={c.inside}>
      <section className={`${c.card} ${c.wideCard}`} aria-label="As Admin">
        <div className={c.adminHead}>
          <div>
            <h3 className={c.cardTitle}>{mine ? (x.my_role === "owner" ? "You run this committee" : "You're on this committee as Admin") : "Not on this committee"}</h3>
            <p className="muted">{mine
              ? "You can run the console and the display, add and remove people, and change the join code, like its owner. You don't take one of its 10 places."
              : "Join as Admin to run its console and display from your own account. Its owner sees you as Admin in their Share tab, and you don't take one of its 10 places."}</p>
          </div>
          <div className={c.adminBtns}>
            <button type="button" className="button" onClick={enter}>{ENTER}{mine ? "Open Console" : "Enter as Admin"}</button>
            {mine
              ? <Link href={`/chambers/display?c=${x.id}`} target="_blank" rel="noopener" className="button secondary">{MONITOR}Open Display</Link>
              : <span className="tip" data-tip="Enter as Admin first"><button type="button" className="button secondary" disabled>{MONITOR}Open Display</button></span>}
          </div>
        </div>
      </section>

      <section className={c.card} aria-label="Facts">
        <h3 className={c.cardTitle}>Committee</h3>
        <dl className={c.facts}>
          <div><dt>Procedure</dt><dd>{w.proc}</dd></div>
          <div><dt>Where It Is</dt><dd>{w.step}</dd></div>
          <div><dt>States</dt><dd>{x.summary.delegates ?? 0}</dd></div>
          <div><dt>Version</dt><dd>{x.version}</dd></div>
          <div><dt>Created</dt><dd>{new Date(x.created_at).toLocaleString("en-AU", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</dd></div>
          <div><dt>Updated</dt><dd>{ago(x.updated_at)}</dd></div>
          <div className={c.factWide}><dt>{x.summary.rules === "trinity" ? "Topic" : "Resolution"}</dt><dd>{x.summary.topic || "None"}</dd></div>
          <div className={c.factWide}><dt>ID</dt><dd className={c.mono}>{x.id}</dd></div>
        </dl>
      </section>

      <section className={c.card} aria-label="People">
        <h3 className={c.cardTitle}>People{team && <span className={c.count}>{team.length}</span>}</h3>
        {team === null ? <p className="muted">Loading…</p> : (
          <ul className={c.team}>
            {team.map((p) => {
              const r = p.role ?? (p.is_owner ? "owner" : "chair");
              return (
                <li key={p.user_id}>
                  <span className={c.who}><strong>{p.name || p.email}{p.user_id === me && " (you)"}</strong>{p.name && <small>{p.email}</small>}</span>
                  <span className={`badge${r === "admin" ? " accent" : ""}`}>{ROLE[r]}</span>
                  {r === "owner" ? <span className={c.gap} aria-hidden="true" />
                    : <ConfirmIconButton label={p.user_id === me ? "Leave this committee" : `Remove ${p.name || p.email}`} confirm="Click again to confirm" icon={p.user_id === me ? ICONS.leave : ICONS.close} onConfirm={() => void remove(p)} />}
                </li>
              );
            })}
          </ul>
        )}
        <form className={c.addRow} onSubmit={add}>
          <label htmlFor={`ae-${x.id}`} className="sr-only">Add a chair by the email on their Collex account</label>
          <input id={`ae-${x.id}`} type="email" className="control" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Add by email on their Collex account" maxLength={254} />
          {email.trim() ? <button type="submit" className="button secondary" disabled={busy}>Add</button>
            : <span className="tip" data-tip="Type their email first"><button type="button" className="button secondary" disabled>Add</button></span>}
        </form>
      </section>

      <section className={c.card} aria-label="Join Code">
        <h3 className={c.cardTitle}>Join Code</h3>
        {code ? <CodeBoxes code={code} label="Join code" /> : <div className={board.empty}><Gavel /><p className={board.emptyTitle}>No join code yet</p><p className="muted">Chairs can only be added by email.</p></div>}
        <div className={c.btnGrid}>
          {code && <button type="button" className="button secondary" onClick={() => copy(`${location.origin}/chambers?join=${code}`, "Link copied")}>Copy Link</button>}
          <button type="button" className="button secondary" disabled={busy} onClick={() => void codeDo("new")}>{code ? "New Code" : "Make a Join Code"}</button>
          {code && <button type="button" className="button secondary" disabled={busy} onClick={() => void codeDo("off")}>Turn Off</button>}
        </div>
      </section>

      <section className={c.card} aria-label="Recent Activity">
        <h3 className={c.cardTitle}>Recent Activity</h3>
        {(x.summary.log ?? []).length === 0 ? <div className={board.empty}><Gavel /><p className={board.emptyTitle}>No activity yet</p><p className="muted">What happens in this committee shows here.</p></div> : (
          <ol className={c.log}>{(x.summary.log ?? []).map((l, i) => <li key={i}><time>{stamp(l.at)}</time><span>{l.text}</span></li>)}</ol>
        )}
      </section>

      <section className={`${c.card} ${c.wideCard}`} aria-label="Saved State">
        <div className={c.adminHead}>
          <h3 className={c.cardTitle}>Saved State</h3>
          <div className={c.row}>
            <button type="button" className="button secondary" onClick={download}>Download JSON</button>
            <button type="button" className="button secondary" onClick={copyId}>Copy ID</button>
          </div>
        </div>
        <details className={c.raw}>
          <summary>Show what is saved</summary>
          <pre>{raw ?? "Loading…"}</pre>
        </details>
      </section>
    </div>
  );
}
