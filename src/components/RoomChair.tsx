"use client";

import { useState } from "react";
import * as ch from "@/lib/chamber";
import type { Ballot, Chamber } from "@/lib/chamber";
import { acceptAsk, askText, shortTime, strawKey, voteKey, type Ask, type ChairSync, type RoomMeta, type Straw } from "@/lib/room";
import { supabase } from "@/lib/supabase";
import { CodeBoxes } from "./CodeInput";
import Flag from "./Flag";
import IconButton, { ICONS } from "./IconButton";
import Select from "./Select";
import s from "./Chambers.module.css";
import mg from "./Manage.module.css";
import r from "./Room.module.css";

type Act = (fn: (x: Chamber) => Chamber, track?: boolean) => void;
const uid = () => crypto.randomUUID();

/* The chairs' inbox: what delegates have asked for from their own devices. Accepting one does it on the committee,
   exactly as if the chair had done it by hand; nothing a delegate sends changes the committee by itself. */
export function Inbox({ c, act, room, say, refresh }: { c: Chamber; act: Act; room: ChairSync; say: (t: string) => void; refresh: () => void }) {
  const [busy, setBusy] = useState("");
  const settle = async (a: Ask, status: "done" | "dismissed") => {
    if (!supabase) return;
    setBusy(a.id);
    await supabase.rpc("room_ask_set", { ask: a.id, new_status: status });
    setBusy("");
    refresh();
  };
  const accept = (a: Ask) => {
    const { next, why } = acceptAsk(c, a, uid());
    if (next === c) { say(why ?? "That can't be done now."); return; }
    // Replayed on a newer copy of the committee if another chair acted first, so it is worked out again from that copy.
    const id = uid();
    act((x) => acceptAsk(x, a, id).next);
    void settle(a, "done");
  };
  const key = voteKey(c);
  const votes = key ? room.votes.filter((v) => v.key === key && ch.has(c, v.delegate_id) && ch.isHere(c, v.delegate_id)) : [];
  const n = (b: string) => votes.filter((v) => v.ballot === b).length;
  const useVotes = () => {
    if (!key) return;
    const list = votes.filter((v) => v.ballot === "for" || v.ballot === "against" || v.ballot === "abstain");
    if (c.poll) act((x) => list.reduce((y, v) => ch.pollCast(y, v.delegate_id, v.ballot as Ballot), x.poll?.ballots ? x : ch.pollByRoll(x, true)));
    else act((x) => list.reduce((y, v) => ch.cast(y, v.delegate_id, v.ballot as Ballot), x));
    say(`${list.length} ${list.length === 1 ? "vote" : "votes"} from devices used`);
  };
  if (!room.asks.length && !key) return null;
  return (
    <section className={`panel ${s.list}`} aria-labelledby="ib-h">
      <div className={s.head}>
        <h2 id="ib-h" className={s.h2}>From Delegates&rsquo; Devices</h2>
        {room.asks.length > 0 && <span className="badge accent">{room.asks.length}</span>}
      </div>
      {key && (
        <div className={r.form}>
          <div className={r.rowMain}>
            <strong>Votes from devices: {n("for")} For, {n("against")} Against, {n("abstain")} Abstain</strong>
            <small>{votes.length} of {ch.present(c)} states present have voted on their own device. Using them records each state&rsquo;s answer, and you can still change any of them.</small>
          </div>
          <button type="button" className="button block" disabled={!votes.length} onClick={useVotes}>Use These Votes</button>
        </div>
      )}
      {room.asks.length > 0 && (
        <ul className={r.rows}>
          {room.asks.map((a) => {
            const t = askText(c, a);
            const name = ch.nameOf(c, a.delegate_id ?? "") || "A removed state";
            return (
              <li key={a.id}>
                <span className={r.rowMain}>
                  <strong><Flag name={name} />{name} · {t.title}</strong>
                  <small>{[t.detail, shortTime(a.created_at)].filter(Boolean).join(" · ")}</small>
                </span>
                <span className={r.rowBtns}>
                  <button type="button" className="button sm" disabled={busy === a.id} onClick={() => accept(a)}>{a.kind === "point" ? "Note It" : "Accept"}</button>
                  <button type="button" className="button secondary sm" disabled={busy === a.id} onClick={() => void settle(a, "dismissed")}>Dismiss</button>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/* Share tab: turn delegates' devices on or off, the delegates' code, and who has taken a seat. */
export function DevicesCard({ c, cid, room, manage, say, refresh }: { c: Chamber; cid: string; room: ChairSync | null; manage: boolean; say: (t: string) => void; refresh: () => void }) {
  const [busy, setBusy] = useState(false);
  const set = async (action: "on" | "off" | "new") => {
    if (!supabase) return;
    setBusy(true);
    const { error } = await supabase.rpc("chamber_devices", { cid, action });
    setBusy(false);
    if (error) { say(error.message); return; }
    say(action === "on" ? "Delegates can now join" : action === "off" ? "Delegates' devices turned off" : "New delegates' code made");
    refresh();
  };
  const copy = (text: string, done: string) => navigator.clipboard?.writeText(text).then(() => say(done), () => say("Couldn't copy"));
  const unseat = async (user: string) => { if (supabase) { await supabase.rpc("room_unseat", { cid, target: user }); refresh(); } };
  const on = !!room?.on;
  const code = room?.code ?? null;
  return (
    <section className={`panel ${s.share}`} aria-labelledby="st-dev">
      <div className={mg.cardTop}>
        <h2 id="st-dev" className={s.h2}>Delegates&rsquo; Devices <span className={mg.dot} data-on={on} aria-hidden="true" /><span className="sr-only" aria-live="polite">{on ? "On" : "Off"}</span>{on && room && room.seats.length > 0 && <span className={r.count}>{room.seats.length} seated</span>}</h2>
        {manage ? (
          <button type="button" className={`button ${on ? "secondary" : ""} ${mg.switchBtn}`} disabled={busy} aria-pressed={on} onClick={() => void set(on ? "off" : "on")}>
            <span key={String(on)} className="t-swap">{on ? "Turn off" : "Turn on"}</span>
          </button>
        ) : (
          <span className="tip" data-tip="Only the person who shared the committee can change this" tabIndex={0}>
            <button type="button" className={`button ${on ? "secondary" : ""} ${mg.switchBtn}`} disabled aria-pressed={on}>{on ? "Turn off" : "Turn on"}</button>
          </span>
        )}
      </div>
      {on && (
        <>
          {code && <CodeBoxes code={code} label="Delegates' code" />}
          <div className={s.codeActions}>
            {code && <button type="button" className="button secondary" onClick={() => copy(code, "Code copied")}>Copy Code</button>}
            {code && <button type="button" className="button secondary" onClick={() => copy(`${location.origin}/chambers/room?join=${code}`, "Link copied")}>Copy Link</button>}
            {manage && <button type="button" className="button secondary" disabled={busy} onClick={() => void set("new")}>New Code</button>}
          </div>
          {room && room.seats.length > 0 && (
            <ul className={s.team}>
              {room.seats.map((x) => (
                <li key={x.user_id}>
                  <span className={s.tname}>{x.name}</span>
                  <span className="badge"><Flag name={ch.nameOf(c, x.delegate_id)} size={16} />{ch.nameOf(c, x.delegate_id) || "A removed state"}</span>
                  <IconButton label={`Take ${x.name}'s seat away`} icon={ICONS.close} onClick={() => void unseat(x.user_id)} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

/* Room tab: who may pass notes, and a straw poll delegates answer from their devices. */
export function RoomSettings({ cid, room, say, refresh }: { cid: string; room: ChairSync; say: (t: string) => void; refresh: () => void }) {
  const meta = room.room;
  const [q, setQ] = useState("");
  const [opts, setOpts] = useState("Yes\nNo");
  const [busy, setBusy] = useState(false);
  const save = async (next: RoomMeta) => {
    if (!supabase) return;
    setBusy(true);
    const { error } = await supabase.rpc("room_set", { cid, new_room: next });
    setBusy(false);
    if (error) say(error.message);
    refresh();
  };
  const straw = meta.straw ?? null;
  const options = opts.split("\n").map((x) => x.trim()).filter(Boolean).slice(0, 8);
  const start = async (e: React.FormEvent) => {
    e.preventDefault();
    if (q.trim().length < 2 || options.length < 2) return;
    const next: Straw = { id: uid(), q: q.trim().slice(0, 200), options: options.map((o) => o.slice(0, 80)), open: true };
    await save({ ...meta, straw: next });
    setQ("");
    say("Straw poll opened");
  };
  const tally = straw ? straw.options.map((_, i) => room.votes.filter((v) => v.key === strawKey(straw) && v.ballot === String(i)).length) : [];
  const total = tally.reduce((a, b) => a + b, 0);
  return (
    <>
      <section className={`panel ${s.share}`} aria-labelledby="rs-straw">
        <h2 id="rs-straw" className={s.h2}>Straw Poll{straw && <span className={r.count}>{straw.open ? `${total} answered` : "Closed"}</span>}</h2>
        {straw ? (
          <>
            <p className={`serif ${r.nowBig}`}>{straw.q}</p>
            <div className={r.tally}>
              {straw.options.map((o, i) => (
                <div key={i} className={r.tallyRow}>
                  <span>{o}</span><strong className="num">{tally[i]}</strong>
                  <span className={r.tallyBar}><i style={{ width: `${total ? (tally[i] / total) * 100 : 0}%` }} /></span>
                </div>
              ))}
            </div>
            <div className={s.btnRow}>
              <button type="button" className="button secondary" disabled={busy} onClick={() => void save({ ...meta, straw: { ...straw, open: !straw.open } })}>{straw.open ? "Close the Poll" : "Reopen the Poll"}</button>
              <button type="button" className="button secondary" disabled={busy} onClick={async () => { if (supabase) await supabase.rpc("room_clear_votes", { cid, vote_key: strawKey(straw) }); await save({ ...meta, straw: null }); }}>Remove the Poll</button>
            </div>
          </>
        ) : (
          <form className={s.panelBody} onSubmit={start}>
            <p className="muted">Ask the room a question. Delegates answer from their devices; it binds no one.</p>
            <div className="field"><label htmlFor="rs-q">Question</label><input id="rs-q" className="control" value={q} maxLength={200} onChange={(e) => setQ(e.target.value)} /></div>
            <div className="field"><label htmlFor="rs-o">Answers</label><textarea id="rs-o" className="control" rows={3} value={opts} onChange={(e) => setOpts(e.target.value)} /><small>One per line, two to eight.</small></div>
            <button type="submit" className="button block" disabled={busy || q.trim().length < 2 || options.length < 2}>Open the Straw Poll</button>
          </form>
        )}
      </section>
      <section className={`panel ${s.share}`} aria-labelledby="rs-notes">
        <h2 id="rs-notes" className={s.h2}>Who Can Pass Notes</h2>
        <div className="field">
          <label htmlFor="rs-rule" className="sr-only">Who Can Pass Notes</label>
          <Select id="rs-rule" className="control" value={meta.notes ?? "on"} disabled={busy} onChange={(e) => void save({ ...meta, notes: e.target.value as RoomMeta["notes"] })}>
            <option value="on">States can write to each other and to the chairs</option>
            <option value="chair">States can only write to the chairs</option>
            <option value="off">Notes are off</option>
          </Select>
          <small>Chairs can read every note, and can always write to a state or to everyone.</small>
        </div>
      </section>
    </>
  );
}
