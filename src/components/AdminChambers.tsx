"use client";

import { Fragment, useState } from "react";
import IconButton, { ConfirmIconButton, ICONS } from "./IconButton";
import { supabase } from "@/lib/supabase";
import s from "@/app/admin.module.css";
import c from "./AdminChambers.module.css";

export type AdminChamber = {
  id: string; name: string; owner_email: string; owner_name: string; members: number; version: number; created_at: string; updated_at: string;
  summary: { rules?: string; step?: string; topic?: string; delegates?: number; log?: { at: number; text: string }[] };
};

const STEP: Record<string, string> = {
  welcome: "Welcome", roll: "Roll Call", pick: "Choosing the Speakers", proposer: "Proposer", seconder: "Co-sponsor", opposer: "Opposer", caucus: "Caucus", floor: "Debate",
  amend: "Amendment", closing: "Closing", vote: "Vote", closed: "Result", ended: "Ended", statements: "Opening Statements", general: "General Debate",
};
const ago = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m} min ago`;
  if (m < 1440) return `${Math.round(m / 60)} h ago`;
  return new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short" });
};
const stamp = (n: number) => new Date(n).toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit", second: "2-digit" });
const where = (x: AdminChamber) => {
  const sm = x.summary;
  const proc = sm.rules === "trinity" ? "Trinity Grammar MUN" : "Evatt";
  return { proc, step: STEP[sm.step ?? ""] ?? sm.step ?? "Unknown" };
};

/** Every shared committee: where it is, who runs it, and the tools to look inside, fix, download or delete it. */
export default function AdminChambers({ chambers, error, say, reload, query }: { chambers: AdminChamber[]; error: boolean; say: (t: string) => void; reload: () => void; query: string }) {
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
        <p>The Chambers Tools Aren&apos;t Set Up Yet</p>
        <span>Apply database migration 0021 (supabase/migrations/0021_admin_chambers_audit.sql), then reload this page.</span>
      </div>
    );
  }
  const q = query.trim().toLowerCase();
  const shown = chambers.filter((x) => !q || [x.name, x.owner_email, x.owner_name, x.summary.topic, where(x).proc, where(x).step].join(" ").toLowerCase().includes(q));
  if (chambers.length === 0) {
    return (
      <div className={s.empty}>
        <p>No Shared Chambers</p>
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

  return (
    <div className={s.tableWrap}>
      <table className={s.table}>
        <thead><tr><th>Chamber</th><th>Run By</th><th>Where It Is</th><th>Updated</th><th className={s.right}>Actions</th></tr></thead>
        <tbody>
          {shown.map((x) => {
            const w = where(x);
            return (
              <Fragment key={x.id}>
                <tr>
                  <td><strong>{x.name}</strong><small>{x.summary.topic || "No topic"}</small></td>
                  <td><strong>{x.owner_name || "No name"}</strong><small>{x.owner_email}</small></td>
                  <td><strong>{w.step}</strong><small>{w.proc} · {x.summary.delegates ?? 0} states</small></td>
                  <td>{ago(x.updated_at)}</td>
                  <td className={s.right}>
                    <div className={s.actions}>
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
                        <div className={c.view}>
                          <dl className={c.facts}>
                            <div><dt>ID</dt><dd className={c.mono}>{x.id}</dd></div>
                            <div><dt>Version</dt><dd>{x.version}</dd></div>
                            <div><dt>Created</dt><dd>{new Date(x.created_at).toLocaleString("en-AU", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</dd></div>
                            <div><dt>Also On It</dt><dd>{x.members} {x.members === 1 ? "person" : "people"}</dd></div>
                          </dl>
                          <div>
                            <h3 className={c.h3}>Recent Activity</h3>
                            {(x.summary.log ?? []).length === 0 ? <p className="muted">Nothing yet.</p> : (
                              <ol className={c.log}>{(x.summary.log ?? []).map((l, i) => <li key={i}><time>{stamp(l.at)}</time><span>{l.text}</span></li>)}</ol>
                            )}
                          </div>
                          <div className={c.row}>
                            <button type="button" className="button secondary" onClick={() => download(x)}>Download JSON</button>
                            <button type="button" className="button secondary" onClick={() => copy(x.id)}>Copy ID</button>
                          </div>
                          <details className={c.raw}>
                            <summary>Saved State</summary>
                            <pre>{raw[x.id] ?? "Loading…"}</pre>
                          </details>
                        </div>
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
