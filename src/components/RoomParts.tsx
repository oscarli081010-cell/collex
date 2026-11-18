"use client";

import { useEffect, useRef, useState } from "react";
import * as ch from "@/lib/chamber";
import type { Chamber } from "@/lib/chamber";
import { FILE_TYPES, fileSize, shortTime, type Note, type RoomFile } from "@/lib/room";
import { supabase } from "@/lib/supabase";
import IconButton, { ICONS } from "./IconButton";
import Select from "./Select";
import Flag from "./Flag";
import s from "./Chambers.module.css";
import r from "./Room.module.css";

const who = (c: Chamber, id: string) => (id === "chair" ? "The Chairs" : id === "all" ? "Everyone" : ch.nameOf(c, id) || "A removed state");

/* Notes between states and the chairs. `me` is "chair" on the console, or the delegate's own state. Chairs read every note. */
export function NotesPanel({ c, cid, notes, me, rule, say, onSent }: {
  c: Chamber; cid: string; notes: Note[]; me: string; rule: "on" | "chair" | "off"; say: (t: string) => void; onSent: () => void;
}) {
  const chair = me === "chair";
  const [to, setTo] = useState(chair ? "all" : "chair");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLUListElement>(null);
  useEffect(() => { const el = end.current; if (el) el.scrollTop = el.scrollHeight; }, [notes.length]);
  const others = c.delegates.filter((d) => d.id !== me);
  const off = !chair && rule === "off";
  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !text.trim() || busy) return;
    setBusy(true);
    const { error } = await supabase.rpc("room_note", { cid, to_whom: to, body: text });
    setBusy(false);
    if (error) { say(error.message); return; }
    setText("");
    onSent();
  };
  return (
    <section className={`panel ${s.share}`} aria-labelledby="rm-notes">
      <h2 id="rm-notes" className={s.h2}>Notes</h2>
      <p className="muted">{chair ? "Every note in the committee shows here. Send one to a state, or an announcement to everyone." : "Pass a note to the chairs or to another state. The chairs can read every note."}</p>
      {notes.length > 0 ? (
        <ul ref={end} className={r.thread}>
          {notes.map((n) => (
            <li key={n.id} data-mine={n.from_id === me} data-all={n.to_id === "all"}>
              <small>{n.to_id === "all" ? "Announcement from the chairs" : `${who(c, n.from_id)} to ${who(c, n.to_id)}`} · {shortTime(n.created_at)}</small>
              {n.body}
            </li>
          ))}
        </ul>
      ) : <p className={s.empty}>No notes yet.</p>}
      {off ? <p className={s.hint}>The chairs have turned notes off.</p> : (
        <form className={r.compose} onSubmit={send}>
          <div className="field">
            <label htmlFor="rm-note-to" className="sr-only">Send To</label>
            <Select id="rm-note-to" className="control" value={to} onChange={(e) => setTo(e.target.value)}>
              {chair ? <option value="all">Everyone (announcement)</option> : <option value="chair">The Chairs</option>}
              {(chair || rule === "on") && others.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </Select>
          </div>
          <div className="field">
            <label htmlFor="rm-note-text" className="sr-only">Note</label>
            <input id="rm-note-text" className="control" value={text} onChange={(e) => setText(e.target.value)} maxLength={500} placeholder={to === "all" ? "Announcement to the committee" : "Write a note"} autoComplete="off" />
          </div>
          <button type="submit" className="button secondary" disabled={busy || !text.trim()}>Send</button>
        </form>
      )}
    </section>
  );
}

/* Files shared with the committee: working papers, guides, anything a state or the chairs want everyone to see. */
export function FilesPanel({ c, cid, files, userId, chair, say, onChange }: {
  c: Chamber; cid: string; files: RoomFile[]; userId?: string; chair: boolean; say: (t: string) => void; onChange: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const upload = async (f: File | undefined) => {
    if (!f || !supabase || !userId) return;
    if (f.size > 10 * 1048576) { say("A file can be up to 10 MB"); return; }
    setBusy(true);
    const safe = f.name.replace(/[^A-Za-z0-9._-]+/g, "-").slice(-80) || "file";
    const path = `${cid}/${userId}/${crypto.randomUUID()}-${safe}`;
    const up = await supabase.storage.from("chamber-files").upload(path, f, { contentType: f.type || undefined });
    if (up.error) { setBusy(false); say(/mime|type/i.test(up.error.message) ? "That kind of file can't be shared here. Use a PDF, Word file, image or text file." : up.error.message); return; }
    const { error } = await supabase.rpc("room_file_add", { cid, file_name: f.name, file_path: path, file_size: f.size });
    if (error) { await supabase.storage.from("chamber-files").remove([path]); say(error.message); }
    else say("File shared");
    setBusy(false);
    if (input.current) input.current.value = "";
    onChange();
  };
  const open = async (f: RoomFile) => {
    if (!supabase) return;
    const { data, error } = await supabase.storage.from("chamber-files").createSignedUrl(f.path, 120);
    if (error || !data) { say("Couldn't open that file"); return; }
    window.open(data.signedUrl, "_blank", "noopener");
  };
  const remove = async (f: RoomFile) => {
    if (!supabase) return;
    const { data, error } = await supabase.rpc("room_file_remove", { file: f.id });
    if (error) { say(error.message); return; }
    if (data) await supabase.storage.from("chamber-files").remove([data as string]);
    onChange();
  };
  return (
    <section className={`panel ${s.share}`} aria-labelledby="rm-files">
      <h2 id="rm-files" className={s.h2}>Files{files.length > 0 && <span className={r.count}>{files.length}</span>}</h2>
      <p className="muted">Share a PDF, Word file, image or text file with the whole committee, up to 10 MB each.</p>
      {files.length > 0 ? (
        <ul className={r.rows}>
          {files.map((f) => (
            <li key={f.id}>
              <span className={r.rowMain}>
                <strong>{f.name}</strong>
                <small>{f.from_id !== "chair" && <Flag name={who(c, f.from_id)} size={16} />}{who(c, f.from_id)} · {fileSize(f.size)} · {shortTime(f.created_at)}</small>
              </span>
              <span className={r.rowBtns}>
                <button type="button" className="button secondary sm" onClick={() => void open(f)}>Open</button>
                {(chair || f.mine) && <IconButton label={`Remove ${f.name}`} icon={ICONS.trash} onClick={() => void remove(f)} />}
              </span>
            </li>
          ))}
        </ul>
      ) : <p className={s.empty}>No files yet.</p>}
      <div>
        <input ref={input} id="rm-file" type="file" className="sr-only" accept={FILE_TYPES} onChange={(e) => void upload(e.target.files?.[0])} disabled={busy} />
        <label htmlFor="rm-file" className="button secondary" aria-disabled={busy}>{busy ? "Sharing…" : "Share a File"}</label>
      </div>
    </section>
  );
}
