"use client";

import { useEffect, useRef, useState } from "react";
import * as ch from "@/lib/chamber";
import type { Chamber, Side } from "@/lib/chamber";
import s from "../Chambers.module.css";
import Select from "../Select";
import Flag from "../Flag";
import { ArmedButton, Why } from "../RoomChair";
import { SIDE, type Act, Duration, Undo, SideSwitch, Stats } from "./shared";

/** The chair's words for the room during an unmoderated caucus. Sent a moment after the typing stops (and at once when
 *  the box is left or closed), so the display follows without every key being a change of its own. While the chair is
 *  typing, the box keeps their own text: a copy of the committee arriving from elsewhere never overwrites it mid-word. */
function CaucusNote({ value, act }: { value: string; act: Act }) {
  const [text, setText] = useState(value);
  const typing = useRef(false);
  const unsent = useRef<string | null>(null);
  const actRef = useRef(act);
  useEffect(() => { actRef.current = act; });
  // Someone else's change (another chair, Back) shows here, but only while this chair isn't typing.
  useEffect(() => { if (!typing.current && unsent.current === null) setText(value); }, [value]);
  const flush = () => {
    const t = unsent.current;
    if (t === null) return;
    unsent.current = null;
    void actRef.current((x) => ch.setCaucusNote(x, t), false);
  };
  useEffect(() => {
    if (unsent.current === null) return;
    const id = setTimeout(flush, 400);
    return () => clearTimeout(id);
  }, [text]);
  useEffect(() => () => flush(), []); // closing the caucus mid-word still sends what was written
  return (
    <div className="field">
      <label htmlFor="fl-note">Note for the Display (Optional)</label>
      <textarea id="fl-note" className="control" rows={2} value={text} maxLength={ch.CAUCUS_NOTE_MAX} placeholder="What to work on, or when to be back"
        onFocus={() => { typing.current = true; }}
        onChange={(e) => { unsent.current = e.target.value; setText(e.target.value); }}
        onBlur={() => { typing.current = false; flush(); }} />
    </div>
  );
}
import { HOW, SubAmend } from "./amendments";
import { PollBox } from "./voting";

/* The floor: who has it, the time, and the one thing the chair does next. */
export function Floor({ c, act, left, now, state, toggle }: { c: Chamber; act: Act; left: number; now: number; state: string; toggle: () => void }) {
  const sp = c.speech;
  const name = (id: string | null) => ch.nameOf(c, id);
  const [asker, setAsker] = useState("");
  const [callSecs, setCallSecs] = useState<number | null>(null);
  const [callBad, setCallBad] = useState(false);
  const [nextRes, setNextRes] = useState("");
  const [anyWho, setAnyWho] = useState("");
  const [anySide, setAnySide] = useState<Side>("for");
  const [anyOpen, setAnyOpen] = useState(false);
  // The time the chair allots is for one speech: the next one starts from the default again.
  useEffect(() => { setCallSecs(null); setCallBad(false); }, [c.speakSecs, c.debate.run.length, !!c.speech]);
  const secs = callBad ? c.speakSecs : callSecs ?? c.speakSecs;
  const next = ch.nextCandidate(c);
  const aid = c.amend?.id ?? "";
  const amendment = c.amend ? c.amendments.find((a) => a.id === c.amend!.id) : undefined;
  const debateOpen = c.step === "amend" && c.amend?.stage === "debate";
  const waiting = ch.waitingAmendments(c);
  const pct = c.timer ? Math.min(100, (left / c.timer.total) * 100) : 0;
  const askers = sp ? c.delegates.filter((d) => d.id !== sp.who && c.roll[d.id] !== "absent" && !ch.observing(c, d.id)) : []; // a state that is away, or only observing, has no point to ask
  const askerId = asker && askers.some((d) => d.id === asker) ? asker : "";
  const spokeFromList = c.debate.run.length > 1;
  const timeField = <Duration id="fl-secs" label="Time for This Speech" value={callSecs ?? c.speakSecs} min={5} max={3600} onChange={(v, ok) => { setCallBad(!ok); if (ok) setCallSecs(v); }} />;
  // Trinity Grammar MUN
  const t = c.tr;
  const k = t?.cauc ?? null;
  const kLeft = k?.clock ? ch.remaining(k.clock, now) : 0;
  const kRun = ch.running(k?.clock ?? null);
  const kUp = !!k?.clock && kLeft === 0;
  const modLike = !!k && (k.kind === "mod" || k.kind === "amend");
  const [yTo, setYTo] = useState("");
  const [extSecs, setExtSecs] = useState<number | null>(null);
  const [stWho, setStWho] = useState("");
  const stNext = ch.nextStatement(c);
  const perField = k && modLike ? <Duration id="fl-per" label="Time per Speaker" value={k.per} min={5} max={Math.max(5, k.total - 1)} onChange={(v, ok) => { if (ok && v !== null) act((x) => ch.setPer(x, v)); }} /> : null;
  const poll = c.poll;
  // Extending a caucus once its time has run out: at most twice, by no more than the caucus first was.
  const extend = k && k.ext < 2 && k.kind !== "final" && (k.clock ? kUp : state === "up") && !sp ? (
    <div className={s.anyBox}>
      <Duration id="fl-ext" label={`Extend the caucus (${k.ext} of 2 used)`} value={Math.min(k.total, 120)} min={10} max={k.total} onChange={(v, ok) => setExtSecs(ok ? v : null)} />
      <Why why={extSecs === null && "Enter a valid time"}><button type="button" className="button secondary sm" disabled={extSecs === null} onClick={() => act((x) => ch.extendCaucus(x, extSecs ?? 0, ch.now()))}>Extend</button></Why>
    </div>
  ) : null;

  const timerBtn = (cls = "button") => state === "up"
    ? <button type="button" className={cls} onClick={() => act(ch.resetTimer, false)}>Reset Time</button>
    : <Why why={state === "none" && "Nothing to time yet"}><button type="button" className={cls} onClick={toggle} disabled={state === "none"}>{state === "running" ? "Pause" : "Start"} Timer</button></Why>;
  const sm = "button secondary sm";
  // After a speech the chair asks how the speaker yields. Once they yield to Points of Information, those are taken one at a time.
  const points = !!sp && ch.takingPoints(sp);
  const between = sp?.phase === "after"; // no clock is shown: the speech's own has stopped, and a point's has not started

  // What the floor is showing: a name or title, and a line under it.
  let title: React.ReactNode = "";
  let sub: React.ReactNode = "";
  const ex = c.explain?.who ?? null;
  const subA = c.amend?.sub ? c.amendments.find((a) => a.id === c.amend!.sub!.id) : undefined;
  if (sp) {
    if (sp.phase === "ask") { title = name(sp.asker); sub = `Point of Information for ${name(sp.who)}`; }
    else { title = name(sp.who); sub = sp.phase === "speech" ? "" : sp.phase === "answer" ? `Replying to ${name(sp.asker)}` : ""; }
  }
  else if (ex) { title = name(ex.id); sub = `Explains their vote (${ex.side === "for" ? "Yes" : "No"} with Rights)`; }
  else if (poll?.kind === "motion") { title = "Motion"; sub = poll.title; }
  else if (t && c.step === "statements") { title = stNext ? name(stNext) : "Opening Statements"; sub = stNext ? "" : "Every state has given its statement"; }
  else if (t && c.step === "general" && !c.style) { title = "The Chair Is Choosing a Resolution"; sub = ch.drafts(c).length > 0 ? "" : "No resolutions yet. Add them in Settings."; }
  else if (t && c.step === "general") { title = next ? name(next.id) : "General Speakers\u2019 List"; }
  else if (c.step === "proposer") { title = name(c.roles.proposer); }
  else if (c.step === "seconder") { title = name(c.roles.seconder); }
  else if (c.step === "opposer") { title = name(c.roles.opposer); }
  else if (c.step === "caucus") { title = k?.kind === "mod" ? "Moderated Caucus" : k?.kind === "final" ? "Final Unmoderated Caucus" : t ? "Unmoderated Caucus" : "Caucus"; sub = k?.kind === "mod" ? k.topic : ""; }
  else if (c.step === "floor" && t) { title = `${ch.resNoun(c).replace("resolution", "Resolution")} Debate`; sub = ch.currentDoc(c)?.title ?? ""; }
  else if (c.step === "floor") { // Evatt: the speakers' list on the resolution comes first; amendments only when no one is listed
    if (next) { title = name(next.id); }
    else if (waiting.length) { title = "Amendments"; sub = `${waiting.length} waiting`; }
    else { title = "Speakers\u2019 List Is Empty"; }
  }
  else if (c.step === "closing") { title = t ? "Closing" : "Closing speeches"; }
  else if (c.step === "vote") { title = "Roll Call Vote"; sub = ch.partText(c) ?? ""; }
  else if (c.step === "ended") { title = "Committee Ended"; }
  else if (c.step === "closed") { title = `${t ? ch.resNoun(c).replace("resolution", "Resolution") : "Resolution"} ${c.outcome?.passed ? "Passes" : "Does Not Pass"}`; sub = c.outcome ? `${c.outcome.yes} for, ${c.outcome.no} against, ${c.outcome.abstain} abstaining` : ""; }
  else if (c.step === "amend" && c.amend?.stage === "read") { title = `Amendment from ${name(amendment?.by ?? null)}`; sub = [amendment?.how && HOW[amendment.how], amendment?.clause].filter(Boolean).join(" \u00B7 "); }
  else if (c.step === "amend" && c.amend?.stage === "ask") { title = "Debate This Amendment?"; }
  else if (c.step === "amend" && c.amend?.stage === "vote") { title = "Adopt This Amendment?"; }
  else if (subA && c.amend?.sub?.stage === "vote") { title = "Adopt This Amendment to the Amendment?"; }
  else if (subA && !c.debate.run.length) { title = name(subA.by); }
  else if (debateOpen) {
    if (!c.debate.run.length) { title = name(amendment?.by ?? null); }
    else if (next) { title = name(next.id); }
    else { title = "Amendment Speakers\u2019 List Is Empty"; }
  }

  const sideless = !!t && sp && !sp.stance && !ch.sided(c) && (sp.role === "speaker" || sp.role === "statement"); // a general speaker or a statement takes no side
  const chipSide: Side | null = sp ? (sideless ? null : sp.side) : debateOpen && !sp && c.debate.run.length && next ? next.side : null;

  // Down to the speakers' list, with its picker ready, for a chair who isn't sure where states are added.
  const toList = () => {
    const pick = document.getElementById("ch-add");
    const box = pick?.closest("section");
    if (!pick || !box) return;
    const bar = document.querySelector(".topbar")?.getBoundingClientRect().height ?? 0; // land below the sticky top bar, not under it
    box.style.scrollMarginTop = `${Math.round(bar) + 16}px`;
    box.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    pick.focus({ preventScroll: true });
  };

  const actions = (() => {
    if (sp) {
      if (sp.phase === "speech") return (
        <>
          {timerBtn("button")}
          <button type="button" className="button secondary" onClick={() => act((x) => ch.endSpeech(x, ch.now(), sp.who))}>End Speech</button>
        </>
      );
      if (sp.phase === "after" && !points) return (
        <>
          <button type="button" className="button" onClick={() => act((x) => ch.yieldToPoints(x, sp.who))}>Yield to Points of Information</button>
          <button type="button" className="button secondary" onClick={() => act((x) => ch.yieldToChair(x, sp.who, sp.pois))}>Yield to the Chair</button>
          {t && (sp.role === "speaker" || sp.role === "amender") && (
            <div className={s.anyBox}>
              <label htmlFor="fl-yto" className="sr-only">Yield to Another Country</label>
              <div className={s.pickRow}>
                <Select id="fl-yto" className="control" value={yTo} onChange={(e) => setYTo(e.target.value)}>
                  <option value="">Yield to another country{sp.left ? ` (adds ${ch.clock(sp.left * 1000)})` : ""}</option>
                  {c.delegates.filter((d) => d.id !== sp.who && c.roll[d.id] !== "absent" && !ch.observing(c, d.id)).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </Select>
                <Why why={!yTo && "Choose a country first"}><button type="button" className="button secondary sm" disabled={!yTo} onClick={() => { act((x) => ch.yieldToCountry(x, sp.who, sp.pois, yTo)); setYTo(""); }}>Yield</button></Why>
              </div>
            </div>
          )}
          {c.timer && <button type="button" className={sm} onClick={() => act((x) => ch.backPhase(x, sp.who, sp.pois))}>Back to the Speech</button>}
        </>
      );
      if (sp.phase === "after") return (
        <>
          <div className="field">
            <label htmlFor="fl-ask">Point of Information From Who?</label>
            <Select id="fl-ask" className="control" value={askerId} onChange={(e) => setAsker(e.target.value)}>
              <option value="">Choose a state</option>
              {askers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </Select>
          </div>
          <Why why={!askerId && "Choose who is asking first"}><button type="button" className="button" disabled={!askerId} onClick={() => { act((x) => ch.askPoi(x, askerId, sp.who, sp.pois)); setAsker(""); }}>Take the POI</button></Why>
          <button type="button" className="button secondary" onClick={() => act((x) => ch.yieldToChair(x, sp.who, sp.pois))}>Yield to the Chair</button>
          {sp.pois === 0 && <button type="button" className={sm} onClick={() => act((x) => ch.backPhase(x, sp.who, sp.pois))}>Back</button>}
        </>
      );
      if (sp.phase === "ask") return (
        <>
          {timerBtn("button")}
          <button type="button" className="button secondary" onClick={() => act((x) => ch.answerPoi(x, sp.who, sp.asker ?? "", sp.pois, ch.now()))}>{name(sp.who)} Replies</button>
          <button type="button" className={sm} onClick={() => act((x) => ch.backPhase(x, sp.who, sp.pois))}>Cancel</button>
        </>
      );
      return (
        <>
          {timerBtn("button")}
          <button type="button" className="button secondary" onClick={() => act((x) => ch.donePoi(x, sp.who, sp.asker ?? "", sp.pois, ch.now()))}>Reply Finished</button>
          <button type="button" className={sm} onClick={() => act((x) => ch.backPhase(x, sp.who, sp.pois))}>Back to the Question</button>
        </>
      );
    }
    if (c.explain) {
      const e = c.explain;
      if (e.who) return (
        <>
          {timerBtn("button")}
          <button type="button" className="button secondary" onClick={() => act((x) => ch.endExplain(x, e.who!.id))}>Done</button>
        </>
      );
      return (
        <>
          <p className={s.hint}>Voted with rights: each can explain their vote for up to {ch.EXPLAIN_SECS} seconds.</p>
          {e.queue.map((q, i) => (
            <div key={q.id} className={s.btnRow}>
              <button type="button" className={i === 0 ? "button" : "button secondary"} onClick={() => act((x) => ch.callExplain(x, q.id))}>Call {name(q.id)} ({q.side === "for" ? "Yes" : "No"} with Rights)</button>
              <button type="button" className={sm} onClick={() => act((x) => ch.skipExplain(x, q.id))}>Skip</button>
            </div>
          ))}
        </>
      );
    }
    if (poll?.kind === "motion") return <PollBox c={c} act={act} />;
    if (c.amend?.sub?.stage === "vote") return <PollBox c={c} act={act} />;
    switch (c.step) {
      case "statements": return (
        <>
          {stNext && <button type="button" className="button" onClick={() => act((x) => ch.callStatement(x, stNext))}>Call {name(stNext)}</button>}
          {stNext && (
            <div className={s.anyBox}>
              <div className={s.pickRow}>
                <label htmlFor="fl-st" className="sr-only">Call Another State</label>
                <Select id="fl-st" className="control" value={stWho} onChange={(e) => setStWho(e.target.value)}>
                  <option value="">Call another state first</option>
                  {c.delegates.filter((d) => !t!.opened.includes(d.id) && c.roll[d.id] !== "absent" && !ch.observing(c, d.id)).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </Select>
                <Why why={!stWho && "Choose a state first"}><button type="button" className="button secondary sm" disabled={!stWho} onClick={() => { act((x) => ch.callStatement(x, stWho)); setStWho(""); }}>Call</button></Why>
              </div>
            </div>
          )}
          <button type="button" className={stNext ? "button secondary" : "button"} onClick={() => act(ch.endStatements)}>Finish the Statements</button>
        </>
      );
      case "general": {
        const readyAll = t ? ch.drafts(c).filter((d) => d.status === "approved" && !d.result) : [];
        return (
          <>
            {!!t && readyAll.map((d, i) => <button key={d.id} type="button" className={i === 0 && !(c.style && next) ? "button" : "button secondary"} onClick={() => act((x) => ch.introduceDraft(x, d.id))}>Introduce {c.style ? d.title : `${d.seen ? "Seen" : "Unseen"} Resolution${readyAll.filter((x) => x.seen === d.seen).length > 1 ? ` (${d.title})` : ""}`}</button>)}
            {c.style && next && <button type="button" className="button" onClick={() => act((x) => ch.callSpeaker(x, next.id, next.side))}>Call {name(next.id)}</button>}
            <div className={s.btnRow}>
              {stNext && <button type="button" className={readyAll.length ? "button secondary sm" : "button"} onClick={() => act(ch.startStatements)}>Opening Statements</button>}
            </div>
          </>
        );
      }
      case "proposer": return (<><button type="button" className="button" onClick={() => act(ch.callProposer)}>Call {name(c.roles.proposer)} to Propose</button></>);
      case "seconder": return (<><button type="button" className="button" onClick={() => act(ch.callSeconder)}>Call {name(c.roles.seconder)} {t ? `as ${ch.roleName(c, "seconder")}` : "to Second"}</button></>);
      case "opposer": return (<><button type="button" className="button" onClick={() => act(ch.callOpposer)}>Call {name(c.roles.opposer)} to Oppose</button></>);
      case "caucus":
        if (t && k?.kind === "mod") {
          const firstUp = ch.nextCandidate(c);
          return (
            <>
              {perField}
              {firstUp && <button type="button" className="button" onClick={() => act((x) => ch.callSpeaker(x, firstUp.id, firstUp.side))}>Call {name(firstUp.id)}</button>}
              <button type="button" className="button secondary" onClick={toList}>Add States to Speakers&apos; List</button>
              {extend}
              <div className={s.btnRow}>
                <button type="button" className={ch.canCloseMod(c) ? "button secondary sm" : "button secondary sm"} onClick={() => act(ch.endCaucus)}>End Caucus</button>
              </div>
            </>
          );
        }
        return (
          <>
            {t && k?.kind !== "unmod" ? null : c.timer && !ch.running(c.timer) && c.timer.left === c.timer.total && <Duration id="fl-cau" label="Caucus Length" value={c.timer ? Math.round(c.timer.total / 1000) : ch.CAUCUS_SECS} min={5} max={ch.TR.maxCaucus}
              onChange={(v, ok) => { if (ok && v !== null) act((x) => ch.setCaucusSecs(x, v)); }} />}
            {timerBtn("button")}
            {extend}
            <button type="button" className="button secondary" onClick={() => act(ch.endCaucus)}>End Caucus</button>
            {t && k && (k.kind === "unmod" || k.kind === "final") && <CaucusNote value={typeof k.note === "string" ? k.note : ""} act={act} />}
          </>
        );
      case "floor": return t ? (
        <>
          {waiting[0] && <button type="button" className="button" onClick={() => act((x) => ch.entertain(x, waiting[0].id))}>Entertain the Next Amendment</button>}
          {next && timeField}
          {next && <button type="button" className={waiting[0] ? "button secondary" : "button"} onClick={() => act((x) => ch.callSpeaker(x, next.id, next.side, secs))}>Call {name(next.id)}</button>}
          <button type="button" className="button secondary" onClick={() => act((x) => ch.callCaucus(x, 300))}>Call a Caucus</button>
          <button type="button" className="button" onClick={() => act(ch.closeDebate)}>Close the Debate</button>
        </>
      ) : (
        <>
          {next && timeField}
          {next && <button type="button" className="button" onClick={() => act((x) => ch.callSpeaker(x, next.id, next.side, secs))}>Call {name(next.id)}</button>}
          {waiting[0] && <button type="button" className={next ? "button secondary" : "button"} onClick={() => act((x) => ch.entertain(x, waiting[0].id))}>Entertain the Next Amendment</button>}
          <button type="button" className="button secondary" onClick={() => act((x) => ch.callCaucus(x, 120))}>Call a Caucus</button>
          <button type="button" className="button secondary" onClick={() => act(ch.closeDebate)}>Close the Debate</button>
        </>
      );
      case "closing": {
        const roles = ch.closingRoles(c);
        const all = roles.every((r) => c.closers.includes(r.id));
        const nextRole = roles.find((r) => !c.closers.includes(r.id));
        // Standard and Custom: a majority of the member states must be here to vote on a resolution. The chair can still go on.
        const vq = c.style ? ch.quorum(c, "vote") : null;
        return (
          <>
            {roles.map((r) => {
              const done = c.closers.includes(r.id);
              return (
                <Why key={r.role} why={done && "Already spoken"}><button type="button" className={r === nextRole ? "button" : "button secondary"} disabled={done} onClick={() => act((x) => ch.callCloser(x, r.id))}>
                  {done ? `${ch.roleName(c, r.role)} ${name(r.id)} Has Spoken` : `Call the ${ch.roleName(c, r.role)}: ${name(r.id)}`}
                </button></Why>
              );
            })}
            {t && !t.finalDone && !c.closers.length && <button type="button" className="button secondary" onClick={() => act((x) => ch.callCaucus(x, ch.TR.final))}>Final Unmoderated Caucus - 4 min</button>}
            {vq && !vq.met && !ch.voteBlock(c) ? (
              <>
                <p className={s.hint} role="status" data-tone="warn">{ch.quorumText(vq, "vote")}.</p>
                <ArmedButton className={all ? "button" : "button secondary sm"} label="Continue Without Quorum" again="Press Again to Go to the Vote" onConfirm={() => act(ch.startVote)} />
              </>
            ) : <Why why={ch.voteBlock(c)}><button type="button" className={all ? "button" : "button secondary sm"} disabled={!!ch.voteBlock(c)} onClick={() => act(ch.startVote)}>Go to the Vote</button></Why>}
          </>
        );
      }
      case "vote": return (
        <>
          <Why why={ch.voteBlock(c) || (ch.count(c).left > 0 && `${ch.count(c).left} ${ch.count(c).left === 1 ? "state" : "states"} still to vote`)}><button type="button" className="button" disabled={!!ch.voteBlock(c) || ch.count(c).left > 0} onClick={() => act(ch.finishVote)}>Record the Result</button></Why>
        </>
      );
      case "closed": return t ? (
        <>
          <button type="button" className="button" onClick={() => act(ch.backToGeneral)}>Back to the Resolutions</button>
          <button type="button" className="button secondary" onClick={() => act(ch.reopenVote)}>Reopen the Vote</button>
          <ArmedButton label="End the Committee" again="Click Again to End the Committee" onConfirm={() => act(ch.endCommittee)} />
        </>
      ) : (
        <>
          <form className={s.nextRes} onSubmit={(e) => { e.preventDefault(); act((x) => ch.newResolution(x, nextRes)); setNextRes(""); }}>
            <div className="field">
              <label htmlFor="fl-next">Next Resolution</label>
              <input id="fl-next" className="control" value={nextRes} onChange={(e) => setNextRes(e.target.value)} maxLength={160} placeholder="The next resolution to debate" />
            </div>
            <Why why={!nextRes.trim() && "Type the next resolution first"}><button type="submit" className="button" disabled={!nextRes.trim()}>Start the Next Resolution</button></Why>
          </form>
          <button type="button" className="button secondary" onClick={() => act(ch.reopenVote)}>Reopen the Vote</button>
          <ArmedButton label="End the Committee" again="Click Again to End the Committee" onConfirm={() => act(ch.endCommittee)} />
        </>
      );
      case "ended": return (
        <button type="button" className="button secondary" onClick={() => act(ch.reopenCommittee)}>Reopen the Committee</button>
      );
      case "amend":
        if (c.amend?.stage === "read") return (
          <>
            <button type="button" className="button" onClick={() => act((x) => ch.amendAsk(x, aid))}>Vote on Whether to Debate It</button>
            <div className={s.btnRow}>
              <button type="button" className={sm} onClick={() => act((x) => ch.amendDebate(x, aid))}>Debate Immediately</button>
              <button type="button" className={sm} onClick={() => act((x) => ch.amendVote(x, aid))}>Vote Immediately</button>
            </div>
            <div className={s.btnRow}>
              <button type="button" className={sm} onClick={() => act((x) => ch.callCaucus(x, 120))}>Call a Caucus</button>
              <button type="button" className={sm} onClick={() => act((x) => ch.backOutAmendment(x, aid))}>Set Aside</button>
            </div>
          </>
        );
        if (c.amend?.stage === "ask" || c.amend?.stage === "vote") return <PollBox c={c} act={act} />;
        break;
    }
    if (debateOpen && t) {
      const first = !c.debate.run.length;
      const follow = !first && next;
      const amBy = (subA ?? amendment)?.by ?? null;
      const amAway = !!amBy && !ch.isHere(c, amBy);
      return (
        <>
          {perField}
          {first
            ? <Why why={amAway && `${name(amBy)} is marked absent`}><button type="button" className="button" disabled={amAway} onClick={() => act((x) => ch.callAmender(x))}>Call {name(amBy)} to Speak</button></Why>
            : follow
              ? <button type="button" className="button" onClick={() => act((x) => ch.callSpeaker(x, follow.id, follow.side))}>Call {name(follow.id)}</button>
              : null}
          <button type="button" className="button secondary" onClick={toList}>Add States to Speakers&apos; List</button>
          {extend}
          {subA ? (
            <>
              <button type="button" className={first || follow ? "button secondary" : "button"} onClick={() => act(ch.subVote)}>Vote on the Amendment to the Amendment</button>
              <button type="button" className={sm} onClick={() => act(ch.withdrawSub)}>Withdraw the Amendment to the Amendment</button>
            </>
          ) : <button type="button" className={first || follow ? "button secondary" : "button"} onClick={() => act((x) => ch.amendVote(x, aid))}>Vote on the Amendment</button>}
          {c.style && !subA && amendment && <SubAmend key={`${amendment.id}|${amendment.text}`} c={c} act={act} parent={amendment} />}
        </>
      );
    }
    if (debateOpen) {
      const first = !c.debate.run.length;
      const amBy = amendment?.by ?? null;
      const amAway = !!amBy && !ch.isHere(c, amBy);
      const primary = first
        ? <Why why={amAway && `${name(amBy)} is marked absent`}><button type="button" className="button" disabled={amAway} onClick={() => act((x) => ch.callAmender(x, secs))}>Call {name(amBy)} to Speak</button></Why>
        : next
          ? <button type="button" className="button" onClick={() => act((x) => ch.callSpeaker(x, next.id, next.side, secs))}>Call {name(next.id)}</button>
          : spokeFromList
            ? <button type="button" className="button" onClick={() => act((x) => ch.amendVote(x, aid))}>Vote on the Amendment</button>
            : null;
      const votePrimary = !first && !next && spokeFromList;
      return (
        <>
          {(first || next) && timeField}
          {primary}
          <div className={s.btnRow}>
            {!votePrimary && <button type="button" className={sm} onClick={() => act((x) => ch.amendVote(x, aid))}>Vote on the Amendment</button>}
            <button type="button" className={sm} onClick={() => act((x) => ch.callCaucus(x, 120))}>Call a Caucus</button>
          </div>
          {!first && (
            <>
              <button type="button" className={sm} aria-expanded={anyOpen} onClick={() => setAnyOpen((v) => !v)}>Call a State</button>
              {anyOpen && (
                <div className={s.anyBox}>
                  <div className={s.pickRow}>
                    <label htmlFor="fl-any" className="sr-only">State</label>
                    <Select id="fl-any" className="control" value={anyWho} onChange={(e) => setAnyWho(e.target.value)}>
                      <option value="">Choose a state</option>
                      {c.delegates.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </Select>
                    <Why why={!anyWho && "Choose a state first"}><button type="button" className="button secondary sm" disabled={!anyWho} onClick={() => { act((x) => ch.callSpeaker(x, anyWho, anySide, secs)); setAnyOpen(false); setAnyWho(""); }}>Call</button></Why>
                  </div>
                  <SideSwitch side={anySide} setSide={setAnySide} />
                </div>
              )}
            </>
          )}
          {!first && !next && <button type="button" className="button secondary block" onClick={toList}>Add States to Speakers&apos; List</button>}
        </>
      );
    }
    return null;
  })();

  return (
    <section className={`panel ${s.floor}`} aria-label="The floor" data-up={state === "up" || undefined}>
      <Undo c={c} act={act} />
      <div className={s.floorMain}>
        {(sp || chipSide) && (
          <div className={s.chips}>
            {sp && <span className={s.chip} data-tone="accent">{ch.roleName(c, sp.role)}</span>}
            {chipSide && <span className={s.chip} data-side={chipSide}>{SIDE[chipSide]}</span>}
          </div>
        )}
        <h2 className={`serif ${s.who} ${s.whoBig}`}>{typeof title === "string" && c.delegates.some((d) => d.name === title) ? <><Flag name={title} em />{title}</> : title}</h2>
        {sub && <p className={s.subBox}>{sub}</p>}
        {sp && points && between && (
          <p className={s.subBox}><strong className={s.subNum}>{sp.pois}</strong> {sp.pois === 1 ? "Point" : "Points"} of Information taken</p>
        )}
        {t && c.step === "general" && !sp && (() => {
          const all = ch.drafts(c);
          const done = all.filter((d) => d.result).length;
          return <Stats label="Resolutions" items={[{ label: "Debated", value: done, tone: "ok" }, { label: "Still to Debate", value: all.length - done }]} />;
        })()}
        {amendment && c.step === "amend" && <p className={s.subBox}>{amendment.text}</p>}
        {c.result && !c.poll && <p className={s.result} data-pass={c.result.passed}><strong>{c.result.passed ? "Passed" : "Failed"}:</strong> {c.result.yes} For, {c.result.no} Against, {c.result.abstain} Abstaining</p>}
        {c.timer && !between && (c.explain?.who || (c.step !== "closed" && c.step !== "ended")) && <div className={s.time} data-state={state} data-over={ch.overtime(c.timer, now) > 0 || undefined} role="timer">{ch.timerText(c.timer, now)}</div>}
        {k?.clock && (
          <div className={s.caucClock} data-state={kUp ? "up" : kRun ? "running" : "paused"}>
            <span>Whole caucus</span>
            <b className="num" role="timer">{ch.clock(kLeft)}</b>
          </div>
        )}
      </div>
      <div className={s.actions}>{actions}</div>
      {c.timer && !between && (c.explain?.who || (c.step !== "closed" && c.step !== "ended")) && <div className={s.track} aria-hidden="true"><i style={{ width: `${pct}%` }} /></div>}
      {c.timer && !between && (
        <div className={s.floorFoot}>
          <div className={s.nudges}>
            {!sp && c.step !== "caucus" && timerBtn("button secondary")}
            <button type="button" className="button secondary" onClick={() => act((x) => ch.nudgeTimer(x, -15, ch.now()), false)} aria-label="Take 15 seconds off">−15s</button>
            <button type="button" className="button secondary" onClick={() => act((x) => ch.nudgeTimer(x, 15, ch.now()), false)} aria-label="Add 15 seconds">+15s</button>
            <button type="button" className="button secondary" onClick={() => act(ch.resetTimer, false)}>Reset</button>
          </div>
        </div>
      )}
    </section>
  );
}
