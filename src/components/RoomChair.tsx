"use client";

import { useEffect, useState } from "react";
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

type Act = (fn: (x: Chamber) => Chamber, track?: boolean) => Promise<boolean> | void;

/** A button that can't be used now, with the reason shown on hover and focus. Give the button `disabled={!!why}` from
    the same reason, so the two can never disagree. The wrapper fills its place, so a full-width button stays full width. */
export function Why({ why, children }: { why: string | false | null | undefined; children: React.ReactElement }) {
  if (!why) return children;
  return <span className="tip" data-tip={why} data-tip-align="start" tabIndex={0} style={{ display: "grid" }}>{children}</span>;
}
const uid = () => crypto.randomUUID();

/** A button for something that can't be taken back: the first click arms it ("Click Again to …"), the second does it. */
export function ArmedButton({ label, again, onConfirm, className = "button secondary", disabled }: { label: string; again: string; onConfirm: () => void; className?: string; disabled?: boolean }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button type="button" className={`${className} ${s.armed}`} disabled={disabled} data-armed={armed || undefined} onBlur={() => setArmed(false)}
      onClick={() => { if (armed) { setArmed(false); onConfirm(); } else setArmed(true); }}>
      <span key={String(armed)} className="t-swap">{armed ? again : label}</span>
    </button>
  );
}

/* The chairs' inbox: what delegates have asked for from their own devices. Accepting one does it on the committee,
   exactly as if the chair had done it by hand; nothing a delegate sends changes the committee by itself. */
export function Inbox({ c, cid, act, room, say, refresh }: { c: Chamber; cid: string; act: Act; room: ChairSync; say: (t: string) => void; refresh: () => void }) {
  const [busy, setBusy] = useState("");
  const [replace, setReplace] = useState(false);
  // Seats waiting for a chair, when Chairs Approve Seats is on. Declining one frees the seat.
  const pending = room.seats.filter((x) => x.approved === false);
  const seat = async (user: string, ok: boolean) => {
    if (!supabase) return;
    setBusy(user);
    const { error } = ok ? await supabase.rpc("room_approve_seat", { cid, target: user }) : await supabase.rpc("room_unseat", { cid, target: user });
    setBusy("");
    if (error) say(error.code === "PGRST202" ? "Approving seats needs the latest database update." : error.message);
    else say(ok ? "Seat approved" : "Seat declined");
    refresh();
  };
  const settle = async (a: Ask, status: "done" | "dismissed") => {
    if (!supabase) return;
    setBusy(a.id);
    await supabase.rpc("room_ask_set", { ask: a.id, new_status: status });
    setBusy("");
    refresh();
  };
  // What it makes carries the request's own id, so accepting it twice (two chairs, or a save replayed on a newer copy
  // after another chair's) never adds it twice.
  const accept = async (a: Ask) => {
    if (ch.holds(c, a.id)) { void settle(a, "done"); return; } // already done, by this chair or another
    // Already on the speakers' list (accepted once already, or added by hand): nothing left to do, so the request is cleared.
    if (a.kind === "floor" && c.debate.list.some((x) => x.id === a.delegate_id)) { void settle(a, "done"); return; }
    const { next, why } = acceptAsk(c, a, a.id);
    if (next === c) { say(why ?? "That can't be done now."); return; }
    setBusy(a.id);
    // Replayed on a newer copy of the committee if another chair acted first, so it is worked out again from that copy.
    const changed = await act((x) => { if (ch.holds(x, a.id)) return x; const n = acceptAsk(x, a, a.id).next; return n === x ? x : ch.asked(n, a.id); });
    setBusy("");
    // Marked done only once the change is saved and really changed the committee. If it didn't (another chair got there
    // first, or the debate moved on), the request stays for the chair to look at again.
    if (changed) void settle(a, "done");
    else if (changed === false) refresh();
  };
  const key = voteKey(c);
  const votes = key ? room.votes.filter((v) => v.key === key && ch.has(c, v.delegate_id) && ch.isHere(c, v.delegate_id)) : [];
  const n = (b: string) => votes.filter((v) => v.ballot === b).length;
  const list = votes.filter((v) => v.ballot === "for" || v.ballot === "against" || v.ballot === "abstain");
  // A count of hands already taken on the placard vote is replaced by the devices' votes, so the chair is asked first.
  const hands = !!c.poll && !c.poll.ballots && c.poll.yes + c.poll.no + c.poll.abstain > 0;
  // In the vote on the resolution, a Present and Voting state can't abstain, so its abstention is left out.
  const leftOut = !c.poll && c.step === "vote" ? list.filter((v) => v.ballot === "abstain" && c.roll[v.delegate_id] === "voting").length : 0;
  const useVotes = () => {
    if (!key) return;
    if (hands && !replace) { setReplace(true); return; }
    setReplace(false);
    // Replayed on a newer copy (another chair moved on to the next part, say), these votes are for a vote that has
    // ended: then they change nothing.
    act((x) => (voteKey(x) !== key ? x : x.poll
      ? list.reduce((y, v) => ch.pollCast(y, v.delegate_id, v.ballot as Ballot), x.poll.ballots ? x : ch.pollByRoll(x, true))
      : list.reduce((y, v) => ch.cast(y, v.delegate_id, v.ballot as Ballot), x)));
    const used = list.length - leftOut;
    say(`${used} ${used === 1 ? "vote" : "votes"} from devices used${leftOut ? `. ${leftOut} ${leftOut === 1 ? "abstention" : "abstentions"} from Present & Voting states left out` : ""}`);
  };
  if (!room.asks.length && !key && !pending.length) return null;
  return (
    <section className={`panel ${s.list}`} aria-labelledby="ib-h">
      <div className={s.head}>
        <h2 id="ib-h" className={s.h2}>From Delegates&rsquo; Devices</h2>
        {room.asks.length + pending.length > 0 && <span className="badge accent">{room.asks.length + pending.length}</span>}
      </div>
      {pending.length > 0 && (
        <>
          <h3 className={r.subHead}>Seat Requests</h3>
          <ul className={r.rows}>
            {pending.map((x) => {
              const state = ch.nameOf(c, x.delegate_id) || "A removed state";
              return (
                <li key={x.user_id}>
                  <span className={r.rowMain}><strong><Flag name={state} />{state}</strong><small>{x.name}</small></span>
                  <span className={r.rowBtns}>
                    <Why why={busy === x.user_id && "Saving…"}><button type="button" className="button sm" disabled={busy === x.user_id} onClick={() => void seat(x.user_id, true)}>Approve</button></Why>
                    <Why why={busy === x.user_id && "Saving…"}><button type="button" className="button secondary sm" disabled={busy === x.user_id} onClick={() => void seat(x.user_id, false)}>Decline</button></Why>
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}
      {key && (
        <div className={r.form}>
          <div className={r.rowMain}>
            <strong>Votes from devices: {n("for")} For, {n("against")} Against, {n("abstain")} Abstain</strong>
            <small>{votes.length} of {ch.present(c)} states present have voted on their own device. Using them records each state&rsquo;s answer, and you can still change any of them.{leftOut > 0 && ` ${leftOut} ${leftOut === 1 ? "abstention is" : "abstentions are"} from Present & Voting states, who can't abstain, so ${leftOut === 1 ? "it" : "they"} will be left out.`}</small>
          </div>
          {replace && hands ? (
            <div className={r.rowMain} role="alert">
              <strong>Replace the count of hands with the {list.length} {list.length === 1 ? "vote" : "votes"} from devices?</strong>
              <div className={s.btnRow}>
                <button type="button" className="button" onClick={useVotes}>Replace the Count</button>
                <button type="button" className="button secondary" onClick={() => setReplace(false)}>Keep the Count</button>
              </div>
            </div>
          ) : (
            <Why why={!votes.length && "No votes from devices yet"}><button type="button" className="button block" disabled={!votes.length} onClick={useVotes}>Use These Votes</button></Why>
          )}
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
                  <Why why={busy === a.id && "Saving…"}><button type="button" className="button sm" disabled={busy === a.id} onClick={() => void accept(a)}>{a.kind === "point" ? "Note It" : "Accept"}</button></Why>
                  <Why why={busy === a.id && "Saving…"}><button type="button" className="button secondary sm" disabled={busy === a.id} onClick={() => void settle(a, "dismissed")}>Dismiss</button></Why>
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
export function DevicesCard({ c, cid, act, room, manage, say, refresh }: { c: Chamber; cid: string; act: Act; room: ChairSync | null; manage: boolean; say: (t: string) => void; refresh: () => void }) {
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
        <h2 id="st-dev" className={s.h2}>Delegates&rsquo; Devices <span className={mg.dot} data-on={on} aria-hidden="true" /><span className="sr-only" aria-live="polite">{on ? "On" : "Off"}</span>{on && room && room.seats.length > 0 && <span className={r.count}>{room.seats.filter((x) => x.approved !== false).length} seated</span>}</h2>
        {manage ? (
          <Why why={busy && "Saving…"}><button type="button" className={`button ${on ? "secondary" : ""} ${mg.switchBtn}`} disabled={busy} aria-pressed={on} onClick={() => void set(on ? "off" : "on")}>
            <span key={String(on)} className="t-swap">{on ? "Turn Off" : "Turn On"}</span>
          </button></Why>
        ) : (
          <span className="tip" data-tip="Only the person who shared the committee can change this" tabIndex={0}>
            <button type="button" className={`button ${on ? "secondary" : ""} ${mg.switchBtn}`} disabled aria-pressed={on}>{on ? "Turn Off" : "Turn On"}</button>
          </span>
        )}
      </div>
      {on && (
        <>
          {code && <CodeBoxes code={code} label="Delegates' code" />}
          <div className={s.codeActions}>
            {code && <button type="button" className="button secondary" onClick={() => copy(code, "Code copied")}>Copy Code</button>}
            {code && <button type="button" className="button secondary" onClick={() => copy(`${location.origin}/chambers/room?join=${code}`, "Link copied")}>Copy Link</button>}
            {manage && <Why why={busy && "Saving…"}><button type="button" className="button secondary" disabled={busy} onClick={() => void set("new")}>New Code</button></Why>}
            {code && <button type="button" className="button secondary" aria-pressed={!!c.showJoin} onClick={() => act((x) => ch.setShowJoin(x, !x.showJoin), false)}>{c.showJoin ? "Hide Join Code" : "Show Join Code"}</button>}
          </div>
          {c.showJoin && code && <small className="muted">The display shows the code and a QR code to join.</small>}
          {room && room.seats.length > 0 && (
            <ul className={s.team}>
              {room.seats.map((x) => (
                <li key={x.user_id}>
                  <span className={s.tname}>{x.name}</span>
                  <span className="badge"><Flag name={ch.nameOf(c, x.delegate_id)} size={16} />{ch.nameOf(c, x.delegate_id) || "A removed state"}</span>
                  {x.approved === false && <span className="badge">Waiting</span>}
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
  const strawWhy = busy ? "Saving…" : q.trim().length < 2 ? "Type the question first" : options.length < 2 ? "Add at least two answers" : null;
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
              <Why why={busy && "Saving…"}><button type="button" className="button secondary" disabled={busy} onClick={() => void save({ ...meta, straw: { ...straw, open: !straw.open } })}>{straw.open ? "Close the Poll" : "Reopen the Poll"}</button></Why>
              <Why why={busy && "Saving…"}><ArmedButton label="Remove the Poll" again="Click Again to Remove the Poll" disabled={busy} onConfirm={async () => { if (supabase) await supabase.rpc("room_clear_votes", { cid, vote_key: strawKey(straw) }); await save({ ...meta, straw: null }); }} /></Why>
            </div>
          </>
        ) : (
          <form className={s.panelBody} onSubmit={start}>
            <p className="muted">Ask the room a question. Delegates answer from their devices; it binds no one.</p>
            <div className="field"><label htmlFor="rs-q">Question</label><input id="rs-q" className="control" value={q} maxLength={200} onChange={(e) => setQ(e.target.value)} /></div>
            <div className="field"><label htmlFor="rs-o">Answers</label><textarea id="rs-o" className="control" rows={3} value={opts} onChange={(e) => setOpts(e.target.value)} /><small>One per line, two to eight.</small></div>
            <Why why={strawWhy}><button type="submit" className="button block" disabled={!!strawWhy}>Open the Straw Poll</button></Why>
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
      <section className={`panel ${s.share}`} aria-labelledby="rs-seats">
        <h2 id="rs-seats" className={s.h2}>Chairs Approve Seats</h2>
        <div className="field">
          <label htmlFor="rs-approve" className="sr-only">Chairs Approve Seats</label>
          <Select id="rs-approve" className="control" value={meta.approveSeats ? "on" : "off"} disabled={busy} onChange={(e) => void save({ ...meta, approveSeats: e.target.value === "on" })}>
            <option value="off">Anyone with the code takes a seat at once</option>
            <option value="on">A chair approves each seat first</option>
          </Select>
          <small>When it&rsquo;s on, a new seat waits under Seat Requests and the delegate sees nothing until a chair approves it. Seats already taken stay as they are.</small>
        </div>
      </section>
    </>
  );
}
