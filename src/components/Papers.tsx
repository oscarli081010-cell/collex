"use client";

import { useEffect, useRef, useState } from "react";
import * as ch from "@/lib/chamber";
import type { Chamber } from "@/lib/chamber";
import { OP_PHRASES, PAPER_STATUS, PAPER_TONE, PRE_PHRASES, cleanBody, paperHtml, type Clause, type Paper, type PaperBody, type PaperRow } from "@/lib/room";
import { supabase } from "@/lib/supabase";
import IconButton, { ConfirmIconButton, ICONS } from "./IconButton";
import Select from "./Select";
import s from "./Chambers.module.css";
import r from "./Room.module.css";

const names = (c: Chamber, ids: string[]) => ids.map((id) => ch.nameOf(c, id)).filter(Boolean).sort();

/* The committee's papers: working papers and draft resolutions, written by their sponsors in the resolution format,
   handed to the chairs, approved or sent back, then introduced (which numbers and locks them). */
export default function Papers({ c, cid, papers, chair, seat, say, refresh, onIntroduce }: {
  c: Chamber; cid: string; papers: PaperRow[]; chair: boolean; seat: string | null; say: (t: string) => void; refresh: () => void;
  /** The chair introduced a paper: the console can add it to the committee's resolutions. */
  onIntroduce?: (id: string, title: string) => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || title.trim().length < 2 || busy) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("paper_create", { cid, paper_title: title });
    setBusy(false);
    if (error) { say(error.message); return; }
    setTitle("");
    refresh();
    setOpen(data as string);
  };
  if (open) return <Editor key={open} id={open} c={c} say={say} close={() => { setOpen(null); refresh(); }} onIntroduce={onIntroduce} />;
  return (
    <section className={`panel ${s.share}`} aria-labelledby="pp-h">
      <h2 id="pp-h" className={s.h2}>Papers{papers.length > 0 && <span className={r.count}>{papers.length}</span>}</h2>
      <p className="muted">{chair ? "Working papers and draft resolutions. Sponsors write them and hand them to you; you approve one, send it back with a note, or introduce it." : "Write a working paper or a draft resolution with your co-sponsors, then hand it to the chairs."}</p>
      {papers.length > 0 ? (
        <ul className={r.rows}>
          {papers.map((p) => (
            <li key={p.id}>
              <span className={r.rowMain}>
                <strong>{p.number ? `${p.number} · ` : ""}{p.title}</strong>
                <small>{names(c, p.sponsors).join(", ") || "No sponsors yet"}{p.signatories.length > 0 ? ` · ${p.signatories.length} ${p.signatories.length === 1 ? "signatory" : "signatories"}` : ""}</small>
                {p.status === "returned" && p.chair_note && <small>Chairs&rsquo; note: {p.chair_note}</small>}
              </span>
              <span className={r.rowBtns}>
                <span className={s.chip} data-tone={PAPER_TONE[p.status]}>{PAPER_STATUS[p.status]}</span>
                <button type="button" className="button secondary sm" onClick={() => setOpen(p.id)}>Open</button>
              </span>
            </li>
          ))}
        </ul>
      ) : <p className={s.empty}>No papers yet.</p>}
      <form className={s.addRow2} onSubmit={create}>
        <label htmlFor="pp-new" className="sr-only">Title of the New Paper</label>
        <input id="pp-new" className="control" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} placeholder="Title of a new paper" />
        <button type="submit" className="button secondary" disabled={busy || title.trim().length < 2}>Start</button>
      </form>
    </section>
  );
}

function Editor({ id, c, say, close, onIntroduce }: { id: string; c: Chamber; say: (t: string) => void; close: () => void; onIntroduce?: (id: string, title: string) => void }) {
  const [p, setP] = useState<Paper | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState<PaperBody>({ pre: [], op: [] });
  const [sponsors, setSponsors] = useState<string[]>([]);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [view, setView] = useState<"write" | "read">("write");
  const version = useRef(0);

  const adopt = (x: Paper, keepView = false) => {
    setP(x); setTitle(x.title); setBody(cleanBody(x.body)); setSponsors(x.sponsors); setDirty(false); version.current = x.version;
    if (!keepView) setView(x.can_edit ? "write" : "read");
  };
  const load = async (keepView = false) => {
    if (!supabase) return;
    const { data, error } = await supabase.rpc("paper_open", { paper: id });
    if (error || !data) { say(error?.message ?? "That paper is gone"); close(); return; }
    adopt(data as Paper, keepView);
  };
  useEffect(() => { void load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  // While only reading, keep it fresh: someone else may be writing it.
  useEffect(() => {
    if (!p || dirty) return;
    const t = setInterval(() => { if (document.visibilityState === "visible") void load(true); }, 6000);
    return () => clearInterval(t);
  }, [p?.id, dirty]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!p) return <section className={`panel ${s.share}`}><p className="muted">Loading…</p></section>;
  const can = p.can_edit;
  const edit = (next: PaperBody) => { setBody(next); setDirty(true); };
  const setClause = (k: "pre" | "op", i: number, patch: Partial<Clause>) => edit({ ...body, [k]: body[k].map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  const move = (k: "pre" | "op", i: number, by: -1 | 1) => {
    const list = [...body[k]]; const j = i + by;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    edit({ ...body, [k]: list });
  };
  const save = async (): Promise<boolean> => {
    if (!supabase || !can) return true;
    if (!dirty) return true;
    setBusy(true);
    const { data, error } = await supabase.rpc("paper_save", { paper: id, new_title: title, new_body: body, new_sponsors: sponsors, expected: version.current });
    setBusy(false);
    if (error) { say(error.message); return false; }
    const res = data as { ok: boolean; version?: number; paper?: Paper };
    if (!res.ok) { say("Someone else saved first. Their version is shown; make your change again."); await load(true); return false; }
    version.current = res.version ?? version.current + 1;
    setDirty(false);
    say("Saved");
    return true;
  };
  const status = async (next: string, withNote?: string) => {
    if (!supabase) return;
    if (!(await save())) return;
    setBusy(true);
    const { error } = await supabase.rpc("paper_status", { paper: id, new_status: next, note: withNote ?? null });
    setBusy(false);
    if (error) { say(error.message); return; }
    if (next === "introduced") onIntroduce?.(id, title);
    say(next === "submitted" ? "Handed to the chairs" : next === "approved" ? "Approved" : next === "returned" ? "Sent back" : next === "introduced" ? "Introduced" : "Back to a draft");
    setNote("");
    await load();
  };
  const sign = async (on: boolean) => {
    if (!supabase) return;
    const { error } = await supabase.rpc("paper_sign", { paper: id, signed: on });
    if (error) say(error.message); else await load(true);
  };
  const del = async () => {
    if (!supabase) return;
    const { error } = await supabase.rpc("paper_delete", { paper: id });
    if (error) say(error.message); else close();
  };
  const html = () => paperHtml({ committee: c.name, topic: c.topic, title, number: p.number, sponsors: names(c, sponsors), signatories: names(c, p.signatories), body });
  const print = () => {
    const w = window.open("", "_blank");
    if (!w) { say("Allow pop-ups to print"); return; }
    w.document.write(html()); w.document.close(); w.focus();
    setTimeout(() => w.print(), 250);
  };
  const word = () => {
    const blob = new Blob(["﻿", html()], { type: "application/msword" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${(p.number ? `${p.number} ` : "") + title}`.replace(/[^A-Za-z0-9 ._-]+/g, "-").slice(0, 80) + ".doc";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  const sponsor = !!p.seat && sponsors.includes(p.seat);
  const signed = !!p.seat && p.signatories.includes(p.seat);
  const addable = c.delegates.filter((d) => !sponsors.includes(d.id));

  const clauses = (k: "pre" | "op") => (
    <fieldset className={s.procedure}>
      <legend>{k === "pre" ? "Preambulatory Clauses" : "Operative Clauses"}</legend>
      {body[k].length > 0 && (
        <ol className={r.clauses}>
          {body[k].map((cl, i) => (
            <li key={i} className={r.clause}>
              <span className={r.clauseN} aria-hidden="true">{k === "op" ? `${i + 1}.` : "·"}</span>
              <div className="field">
                <label htmlFor={`pp-${k}-p-${i}`} className="sr-only">Opening phrase of clause {i + 1}</label>
                <input id={`pp-${k}-p-${i}`} className="control" list={`pp-${k}-phrases`} value={cl.p} maxLength={60} placeholder={k === "pre" ? "Noting" : "Calls upon"} onChange={(e) => setClause(k, i, { p: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor={`pp-${k}-t-${i}`} className="sr-only">Text of clause {i + 1}</label>
                <textarea id={`pp-${k}-t-${i}`} className="control" rows={2} value={cl.t} maxLength={1200} placeholder="the rest of the clause" onChange={(e) => setClause(k, i, { t: e.target.value })} />
              </div>
              <span className={r.clauseBtns}>
                <IconButton label="Move up" icon={ICONS.up} disabled={i === 0} onClick={() => move(k, i, -1)} />
                <IconButton label="Move down" icon={ICONS.down} disabled={i === body[k].length - 1} onClick={() => move(k, i, 1)} />
                <IconButton label="Remove this clause" icon={ICONS.close} onClick={() => edit({ ...body, [k]: body[k].filter((_, j) => j !== i) })} />
              </span>
              {k === "op" && (
                <div className={r.subs}>
                  {(cl.subs ?? []).map((v, j) => (
                    <div key={j} className={r.subRow}>
                      <span className={r.clauseN} aria-hidden="true">({String.fromCharCode(97 + (j % 26))})</span>
                      <input className="control" value={v} maxLength={600} aria-label={`Sub-clause ${j + 1} of clause ${i + 1}`} onChange={(e) => setClause(k, i, { subs: (cl.subs ?? []).map((x, y) => (y === j ? e.target.value : x)) })} />
                      <IconButton label="Remove this sub-clause" icon={ICONS.close} onClick={() => setClause(k, i, { subs: (cl.subs ?? []).filter((_, y) => y !== j) })} />
                    </div>
                  ))}
                  {(cl.subs ?? []).length < 12 && <button type="button" className="button secondary sm" onClick={() => setClause(k, i, { subs: [...(cl.subs ?? []), ""] })}>Add a Sub-clause</button>}
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
      <datalist id={`pp-${k}-phrases`}>{(k === "pre" ? PRE_PHRASES : OP_PHRASES).map((x) => <option key={x} value={x} />)}</datalist>
      {body[k].length < 60 && <button type="button" className="button secondary" onClick={() => edit({ ...body, [k]: [...body[k], { p: "", t: "", subs: [] }] })}>Add a Clause</button>}
    </fieldset>
  );

  const ops = body.op.filter((x) => x.p || x.t);
  return (
    <section className={`panel ${s.share}`} aria-labelledby="pe-h">
      <div className={r.paperHead}>
        <h2 id="pe-h" className={s.h2}>{p.number ? `${p.number} · ` : ""}{title}<span className={r.count}>{PAPER_STATUS[p.status]}</span></h2>
        <button type="button" className="button secondary sm" onClick={async () => { if (dirty && can && !(await save())) return; close(); }}>Back to Papers</button>
      </div>
      {p.status === "returned" && p.chair_note && <p className={s.result} data-pass="false">The chairs sent this back: {p.chair_note}</p>}
      {p.status === "introduced" && <p className={s.hint}>This paper has been introduced, so it can no longer be changed here. Changes now go through amendments.</p>}
      {can && (
        <div className={s.btnRow} role="group" aria-label="Write or read">
          <button type="button" className={view === "write" ? "button" : "button secondary"} aria-pressed={view === "write"} onClick={() => setView("write")}>Write</button>
          <button type="button" className={view === "read" ? "button" : "button secondary"} aria-pressed={view === "read"} onClick={() => setView("read")}>Read</button>
        </div>
      )}
      {can && view === "write" ? (
        <>
          <div className="field">
            <label htmlFor="pe-title">Title</label>
            <input id="pe-title" className="control" value={title} maxLength={160} onChange={(e) => { setTitle(e.target.value); setDirty(true); }} />
          </div>
          <fieldset className={s.procedure}>
            <legend>Sponsors</legend>
            <div className={r.chips}>
              {sponsors.length === 0 && <span className="muted">None yet</span>}
              {sponsors.map((sid) => (
                <span key={sid} className={r.chipX}>{ch.nameOf(c, sid) || "A removed state"}
                  {(p.chair || sid !== p.seat) && <button type="button" aria-label={`Remove ${ch.nameOf(c, sid)} as a sponsor`} onClick={() => { setSponsors(sponsors.filter((x) => x !== sid)); setDirty(true); }}>{ICONS.close}</button>}
                </span>
              ))}
            </div>
            {addable.length > 0 && (
              <div className="field">
                <label htmlFor="pe-sp" className="sr-only">Add a Sponsor</label>
                <Select id="pe-sp" className="control" value="" onChange={(e) => { if (e.target.value) { setSponsors([...sponsors, e.target.value]); setDirty(true); } }}>
                  <option value="">Add a sponsor…</option>
                  {addable.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </Select>
              </div>
            )}
          </fieldset>
          {clauses("pre")}
          {clauses("op")}
          <button type="button" className="button" disabled={busy || !dirty} onClick={() => void save()}>{busy ? "Saving…" : dirty ? "Save" : "Saved"}</button>
        </>
      ) : (
        <div className={r.preview}>
          <h3>{p.number ? `Draft Resolution ${p.number}` : title}</h3>
          <p className="pMeta"><strong>Committee:</strong> {c.name}</p>
          <p className="pMeta"><strong>Topic:</strong> {c.topic}</p>
          <p className="pMeta"><strong>Sponsors:</strong> {names(c, sponsors).join(", ") || "None yet"}</p>
          <p className="pMeta" style={{ marginBottom: 12 }}><strong>Signatories:</strong> {names(c, p.signatories).join(", ") || "None yet"}</p>
          <p><em>The {c.name},</em></p>
          {body.pre.filter((x) => x.p || x.t).map((x, i) => <p key={i}><em>{x.p}</em> {x.t.replace(/[,;.\s]+$/, "")},</p>)}
          {ops.map((x, i) => {
            const subs = (x.subs ?? []).filter(Boolean);
            const end = i === ops.length - 1 ? "." : ";";
            return (
              <div key={i}>
                <p className="pOp">{i + 1}. <u>{x.p}</u> {x.t.replace(/[,;.:\s]+$/, "")}{subs.length ? ":" : end}</p>
                {subs.map((v, j) => <p key={j} className="pSub">({String.fromCharCode(97 + (j % 26))}) {v.replace(/[,;.\s]+$/, "")}{j === subs.length - 1 ? end : ";"}</p>)}
              </div>
            );
          })}
          {body.pre.length + body.op.length === 0 && <p className="muted">Nothing written yet.</p>}
        </div>
      )}

      <div className={s.kActions}>
        {(sponsor || p.chair) && (p.status === "draft" || p.status === "returned") && <button type="button" className="button secondary" disabled={busy} onClick={() => void status("submitted")}>Hand to the Chairs</button>}
        {(sponsor || p.chair) && (p.status === "submitted" || p.status === "approved") && <button type="button" className="button secondary" disabled={busy} onClick={() => void status("draft")}>Take Back to Edit</button>}
        {!p.chair && p.seat && !sponsor && p.status !== "introduced" && <button type="button" className="button secondary" onClick={() => void sign(!signed)}>{signed ? "Take My Signature Off" : "Sign as a Signatory"}</button>}
        {p.chair && p.status !== "introduced" && p.status !== "approved" && <button type="button" className="button secondary" disabled={busy} onClick={() => void status("approved")}>Approve</button>}
        {p.chair && p.status !== "introduced" && <button type="button" className="button" disabled={busy} onClick={() => void status("introduced")}>Introduce</button>}
        <button type="button" className="button secondary" onClick={print}>Print or Save as PDF</button>
        <button type="button" className="button secondary" onClick={word}>Download as Word</button>
      </div>
      {p.chair && p.status !== "introduced" && (
        <form className={s.addRow2} onSubmit={(e) => { e.preventDefault(); void status("returned", note); }}>
          <label htmlFor="pe-note" className="sr-only">Note to the Sponsors</label>
          <input id="pe-note" className="control" value={note} maxLength={400} onChange={(e) => setNote(e.target.value)} placeholder="What needs changing, for the sponsors" />
          <button type="submit" className="button secondary" disabled={busy || !note.trim()}>Send Back</button>
        </form>
      )}
      {(p.chair || (can && sponsor)) && p.status !== "introduced" && (
        <div><ConfirmIconButton label="Delete this paper" confirm="Click again to confirm" icon={ICONS.trash} onConfirm={() => void del()} /></div>
      )}
    </section>
  );
}
