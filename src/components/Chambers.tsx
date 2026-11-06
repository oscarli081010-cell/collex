"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import * as ch from "@/lib/chamber";
import type { Ballot, Chamber, Side } from "@/lib/chamber";
import { supabase } from "@/lib/supabase";
import { isId, useChamber } from "@/lib/useChamber";
import { useAuth } from "./AuthProvider";
import IconButton, { ConfirmIconButton, ICONS } from "./IconButton";
import PageBand from "./PageBand";
import PanelTabs from "./PanelTabs";
import { useToast } from "./useToast";
import s from "./Chambers.module.css";

const svg = (d: React.ReactNode) => <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>;
const MONITOR = svg(<><rect x="1.8" y="2.5" width="12.4" height="8.5" rx="1.6" /><path d="M5.5 13.5h5M8 11v2.5" /></>);
const SWAP = svg(<path d="M3 5.5h9.5M10 3l2.5 2.5L10 8M13 10.5H3.5M6 8l-2.5 2.5L6 13" />);

// The time left, redrawn a few times a second while a timer is running and not at all otherwise.
export function useNow(active: boolean) {
  const [now, setNow] = useState(() => ch.now());
  useEffect(() => {
    setNow(ch.now());
    if (!active) return;
    const t = setInterval(() => setNow(ch.now()), 200);
    return () => clearInterval(t);
  }, [active]);
  return now;
}

const uid = () => crypto.randomUUID();
const SIDE: Record<Side, string> = { for: "In favour", against: "Against" };
type Act = (fn: (x: Chamber) => Chamber) => void;

// A length of time as minutes and seconds. `value` is the total in seconds; `onChange` hears the total (null when both
// boxes are empty) and whether it is allowed. The boxes only follow `value` when it changes from outside.
function Duration({ id, label, value, onChange, min, max, optional }: {
  id: string; label: string; value: number | null; onChange: (secs: number | null, ok: boolean) => void; min: number; max: number; optional?: boolean;
}) {
  const split = (v: number | null) => (v === null ? ["", ""] : [String(Math.floor(v / 60)), String(v % 60)]);
  const [m, setM] = useState(split(value)[0]);
  const [sec, setSec] = useState(split(value)[1]);
  const total = (a: string, b: string) => (a.trim() === "" && b.trim() === "" ? null : Number(a || 0) * 60 + Number(b || 0));
  const last = useRef(value);
  useEffect(() => {
    if (value === last.current) return;
    last.current = value;
    if (total(m, sec) !== value) { const [a, b] = split(value); setM(a); setSec(b); }
  });
  const report = (a: string, b: string) => {
    const t = total(a, b);
    const ok = t === null ? !!optional : Number.isInteger(t) && t >= min && t <= max;
    if (ok) last.current = t;
    onChange(t, ok);
  };
  const t = total(m, sec);
  const bad = t === null ? !optional : !(Number.isInteger(t) && t >= min && t <= max);
  return (
    <div className="field" role="group" aria-labelledby={`${id}-l`}>
      <span id={`${id}-l`}>{label}</span>
      <div className={s.dur}>
        <input id={`${id}-m`} className="control" inputMode="numeric" value={m} aria-label={`${label}, minutes`} aria-invalid={bad} placeholder="0"
          onChange={(e) => { setM(e.target.value); report(e.target.value, sec); }} />
        <span aria-hidden="true">min</span>
        <input id={`${id}-s`} className="control" inputMode="numeric" value={sec} aria-label={`${label}, seconds`} aria-invalid={bad} placeholder="0"
          onChange={(e) => { setSec(e.target.value); report(m, e.target.value); }} />
        <span aria-hidden="true">sec</span>
      </div>
    </div>
  );
}

export default function Chambers() {
  const q = useSearchParams().get("c");
  const cloudId = isId(q) ? q : null;
  const { ready: authReady, session } = useAuth();
  const router = useRouter();
  const { c, status, owner, act, setLocal } = useChamber(cloudId, { signedIn: !!session, authReady });
  const [live, setLive] = useState("");
  const [view, setView] = useState<"manage" | "minutes">("manage");
  const [sharing, setSharing] = useState(false);
  const { say, node } = useToast();

  const now = useNow(ch.running(c?.timer ?? null));
  const left = c?.timer ? ch.remaining(c.timer, now) : 0;
  const state = !c?.timer ? "none" : left === 0 ? "up" : c.timer.endsAt !== null ? "running" : "paused";

  // A timer that reaches zero stops there, so the saved copy (and the display) agree it is over.
  useEffect(() => {
    if (state !== "up" || !c?.timer || c.timer.endsAt === null) return;
    act((x) => ch.pauseTimer(x, ch.now()));
    setLive("Time's up");
  }, [state, c?.timer, act]);

  // What a screen reader hears as the debate moves on.
  const sp = c?.speech;
  useEffect(() => {
    if (!c) return;
    setLive(sp ? `${ch.ROLE_LABEL[sp.role]} ${ch.nameOf(c, sp.who)}: ${sp.phase === "speech" ? "speech" : sp.phase === "questions" ? "points of information" : "yield"}` : ch.STAGES[ch.stageIndex(c)]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp?.who, sp?.phase, c?.step]);

  const toggle = () => act((x) => (ch.running(x.timer) ? ch.pauseTimer(x, ch.now()) : ch.startTimer(x, ch.now())));
  // Space starts or pauses the timer. N calls the next speaker, and only when no one is speaking, so a stray key can't end a speech.
  const callNext = () => {
    if (!c || c.speech || (c.step !== "floor" && !(c.step === "amend" && c.amend?.stage === "debate"))) return;
    const n = ch.nextCandidate(c);
    if (n) act((x) => ch.callSpeaker(x, n.id, n.side));
  };
  const keys = useRef({ toggle, callNext });
  keys.current = { toggle, callNext };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el?.closest("input, textarea, select, button, a, [contenteditable], [role=tab]")) return;
      if (e.key === " ") { e.preventDefault(); keys.current.toggle(); }
      else if (e.key.toLowerCase() === "n") keys.current.callNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (cloudId && (status === "signin" || status === "denied")) {
    return (
      <main id="top" className={`container ${s.setup}`}>
        <div className={`panel ${s.notice}`}>
          <h1 className={`serif ${s.name}`}>{status === "signin" ? "Log in to open this committee" : "This committee isn't shared with you"}</h1>
          <p className="muted">{status === "signin" ? "Shared committees are for the chairs who were added to them. Log in with the account they added." : "Ask the person who runs it to add the email on your Collex account."}</p>
          <div className="btnStack">
            {status === "signin" && <Link href="/login" className="button">Log in</Link>}
            <Link href="/chambers" className="button secondary">Your committees</Link>
          </div>
        </div>
      </main>
    );
  }
  if (status === "loading" || (cloudId && !c)) return <main id="top" className="container" />;
  if (!c) return <Setup signedIn={!!session} onCreate={(x) => { setLocal(x); say("Committee opened"); }} />;

  const display = cloudId ? `/chambers/display?c=${cloudId}` : "/chambers/display";
  const idx = ch.stageIndex(c);

  const finish = async (fn: () => PromiseLike<{ error: { message: string } | null }>) => {
    const { error } = await fn();
    if (error) say(error.message); else router.replace("/chambers");
  };
  const leave = () => cloudId && supabase && session && finish(() => supabase!.rpc("remove_chamber_member", { cid: cloudId, target: session.user.id }));
  const remove = () => {
    if (!cloudId) { setLocal(null); return; }
    if (!supabase) return;
    return owner ? finish(() => supabase!.rpc("delete_chamber", { cid: cloudId })) : leave();
  };

  return (
    <main id="top" className={`container ${s.page}`}>
      <header className={s.top}>
        <h1 className={`serif ${s.name}`}>{c.name}{c.topic && ` · ${c.topic}`}</h1>
        <div className={s.topActions}>
          <a className={`button secondary ${s.topBtn}`} href={display} target="_blank" rel="noopener">{MONITOR}Open display</a>
          <button type="button" className={`button secondary ${s.topBtn}`} aria-expanded={sharing} aria-controls="ch-share" onClick={() => setSharing((x) => !x)}>
            {cloudId ? <i className={s.live} data-off={status === "offline"} aria-hidden="true" /> : ICONS.share}
            Share{status === "offline" && <span className="sr-only"> (offline, trying again)</span>}
          </button>
          <ConfirmIconButton label={cloudId && !owner ? "Leave this committee" : cloudId ? "Delete this committee" : "Close this committee"}
            confirm="Click again to confirm" icon={cloudId && !owner ? ICONS.leave : ICONS.trash} onConfirm={() => void remove()} />
        </div>
      </header>
      {status === "offline" && <p className={s.result} data-pass="false" role="alert">Offline: your changes are kept here and will be sent when the connection is back.</p>}

      {sharing && <Share c={c} cloudId={cloudId} owner={owner} signedIn={!!session} meId={session?.user.id} say={say} setLocal={setLocal} />}

      <div className="sr-only" role="status" aria-live="polite">{live}</div>

      <PanelTabs idPrefix="chv" label="Committee" tab={view} setTab={setView}
        tabs={[{ id: "manage", label: "Manage", icon: ICONS.manage }, { id: "minutes", label: "Minutes", icon: ICONS.clock }]} />

      {view === "manage" ? (
        <div id="chv-panel-manage" role="tabpanel" aria-labelledby="chv-tab-manage" className={s.manage}>
          <Rail idx={idx} />
          {c.step === "open" ? <Opening c={c} act={act} /> : <Floor c={c} act={act} left={left} state={state} toggle={toggle} />}
          {c.step === "vote" || c.step === "closed"
            ? <Workspace c={c} act={act} />
            : <div className={s.pair}><Lists c={c} act={act} /><Workspace c={c} act={act} /></div>}
        </div>
      ) : (
        <Minutes c={c} act={act} say={say} />
      )}
      {node}
    </main>
  );
}

function Rail({ idx }: { idx: number }) {
  return (
    <div>
      <ol className={s.rail} aria-label="Where the council is">
        {ch.STAGES.map((label, i) => (
          <li key={label} data-state={i < idx ? "done" : i === idx ? "now" : "next"} aria-current={i === idx ? "step" : undefined}>
            <span className={s.dot}>{i < idx ? ICONS.check : i + 1}</span>
            <span className={s.railLabel}>{label}</span>
          </li>
        ))}
      </ol>
      <p className={s.railNow}>Step {idx + 1} of {ch.STAGES.length} · {ch.STAGES[idx]}</p>
    </div>
  );
}

/* Opening: the President announces the resolution and calls a proposer and a seconder. */
function Opening({ c, act }: { c: Chamber; act: Act }) {
  const [title, setTitle] = useState("");
  const [prop, setProp] = useState("");
  const [sec, setSec] = useState("");
  const ok = title.trim() && prop && sec && prop !== sec;
  return (
    <form className={`panel ${s.opening}`} onSubmit={(e) => { e.preventDefault(); if (ok) act((x) => ch.announce(x, title, prop, sec)); }}>
      <div>
        <h2 className={`serif ${s.who}`}>Announce the resolution</h2>
        <p className={s.sub}>The President names the resolution and calls on one state in favour to propose it and a different state in favour to second it.</p>
      </div>
      <div className="field">
        <label htmlFor="op-t">Resolution</label>
        <input id="op-t" className="control" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} placeholder="The topic of the resolution" />
      </div>
      <div className={s.two}>
        <div className="field">
          <label htmlFor="op-p">Proposer</label>
          <select id="op-p" className="control" value={prop} onChange={(e) => setProp(e.target.value)}>
            <option value="">Choose a state</option>
            {c.delegates.filter((d) => d.id !== sec).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="op-s">Seconder</label>
          <select id="op-s" className="control" value={sec} onChange={(e) => setSec(e.target.value)}>
            <option value="">Choose a state</option>
            {c.delegates.filter((d) => d.id !== prop).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
      </div>
      <button type="submit" className="button lg block" disabled={!ok}>Begin debate</button>
    </form>
  );
}

/* The floor: who has it, the time, and the one thing the chair does next. */
function Floor({ c, act, left, state, toggle }: { c: Chamber; act: Act; left: number; state: string; toggle: () => void }) {
  const sp = c.speech;
  const name = (id: string | null) => ch.nameOf(c, id);
  const [opp, setOpp] = useState("");
  const [rep, setRep] = useState("");
  const [anyWho, setAnyWho] = useState("");
  const [anySide, setAnySide] = useState<Side>("for");
  const next = ch.nextCandidate(c);
  const amendment = c.amend ? c.amendments.find((a) => a.id === c.amend!.id) : undefined;
  const amendLive = c.step === "amend" && c.amend?.stage === "debate";
  const debating = c.step === "floor" || amendLive;
  const against = c.debate.list.filter((x) => x.side === "against").map((x) => x.id);
  const oppOptions = [...against, ...c.delegates.filter((d) => !against.includes(d.id) && d.id !== c.resolution.proposer && d.id !== c.resolution.seconder).map((d) => d.id)];
  const oppId = opp && oppOptions.includes(opp) ? opp : oppOptions[0] ?? "";
  const favour = [...new Set([ch.replyBy(c) ?? "", ...ch.inFavour(c).map((d) => d.id)].filter(Boolean))];
  const repOptions = [...favour, ...c.delegates.filter((d) => !favour.includes(d.id)).map((d) => d.id)];
  const repId = rep && repOptions.includes(rep) ? rep : repOptions[0] ?? "";
  const pct = c.timer ? Math.min(100, (left / c.timer.total) * 100) : 0;
  const idx = ch.stageIndex(c);

  const timerBtn = (cls = "button") => state === "up"
    ? <button type="button" className={cls} onClick={() => act(ch.resetTimer)}>Reset time</button>
    : <button type="button" className={cls} onClick={toggle} disabled={state === "none"}>{state === "running" ? "Pause" : "Start"} timer</button>;
  const sm = "button secondary sm";

  // What the floor is showing: a name or title, and a line under it.
  let title: React.ReactNode = "";
  let sub: React.ReactNode = "";
  if (sp) {
    title = name(sp.who);
    sub = sp.phase === "speech" ? "Speaking" : sp.phase === "questions" ? "Taking points of information" : "Yielding the floor";
  } else if (c.step === "proposer") { title = name(c.resolution.proposer); sub = "Proposes the resolution"; }
  else if (c.step === "seconder") { title = name(c.resolution.seconder); sub = "Seconds the resolution"; }
  else if (c.step === "opposer") { title = "The first state against"; sub = "Choose who speaks against the resolution"; }
  else if (c.step === "caucus") { title = c.timer?.label ?? "Caucus"; sub = "Debate stops while states talk directly to each other"; }
  else if (c.step === "reply") { title = "Right of Reply"; sub = "The proposer, or a state in favour, speaks last"; }
  else if (c.step === "vote") { title = "Roll call vote"; sub = "Record every state's vote on the right"; }
  else if (c.step === "closed") { title = c.outcome?.passed ? "Resolution approved" : "Resolution not approved"; sub = c.outcome ? `${c.outcome.yes} for, ${c.outcome.no} against, ${c.outcome.abstain} abstaining` : ""; }
  else if (c.step === "amend" && c.amend?.stage === "read") { title = `Amendment from ${name(amendment?.by ?? null)}`; sub = amendment?.clause || "Read it to the council"; }
  else if (c.step === "amend" && c.amend?.stage === "ask") { title = "Debate this amendment?"; sub = "A show of placards: more for than against"; }
  else if (c.step === "amend" && c.amend?.stage === "vote") { title = "Adopt this amendment?"; sub = "A show of placards: more for than against"; }
  else if (debating) {
    if (amendLive && !c.debate.run.length) { title = name(amendment?.by ?? null); sub = "Speaks first on their amendment"; }
    else if (next) { title = name(next.id); sub = c.debate.yielded ? "Yielded to, speaks next" : "Next on the list"; }
    else { title = "The list is empty"; sub = "Add states to the speakers' list, or call one below"; }
  }

  const stageChip = c.step === "amend" ? "Amendment" : ch.STAGES[idx];
  const chipSide: Side | null = sp ? sp.side : debating && !sp && next ? next.side : null;
  const showNeg = c.step !== "open" && c.step !== "vote" && c.step !== "closed";

  const actions = (() => {
    if (sp) {
      if (sp.phase === "speech") return (
        <>
          {timerBtn("button")}
          <button type="button" className="button secondary" onClick={() => act((x) => ch.endSpeech(x, ch.now()))}>{sp.role === "reply" ? "Finish Right of Reply" : "End speech"}</button>
          <p className={s.hint}>{HINT[sp.role]}</p>
        </>
      );
      if (sp.phase === "questions") return (
        <>
          <div className={s.stepper}>
            <button type="button" className="button secondary" onClick={() => act((x) => ch.poi(x, -1))} aria-label="One fewer question" disabled={!sp.pois}>−</button>
            <output aria-live="polite">{sp.pois}<small>points of information</small></output>
            <button type="button" className="button secondary" onClick={() => act((x) => ch.poi(x, 1))} aria-label="One more question">+</button>
          </div>
          <button type="button" className="button" onClick={() => act(ch.endQuestions)}>End questions</button>
          <button type="button" className={sm} onClick={() => act(ch.backPhase)}>Back to the speech</button>
          <p className={s.hint}>The President decides how many to take, usually one or two. Each is a single brief question with a single answer.</p>
        </>
      );
      const targets = ch.yieldTargets(c);
      const sameSide = c.debate.list.filter((x) => x.side === sp.side);
      return (
        <>
          <button type="button" className="button" onClick={() => act((x) => ch.yieldTo(x, null))}>Yield to the chair</button>
          {targets.length > 0 && (
            <div className={s.targets}>
              {targets.map((t) => <button key={t.id} type="button" className={sm} onClick={() => act((x) => ch.yieldTo(x, t.id))}>Yield to {name(t.id)}</button>)}
            </div>
          )}
          <button type="button" className={sm} onClick={() => act(ch.backPhase)}>Back to questions</button>
          <p className={s.hint}>
            {sameSide.length && !targets.length
              ? "Four speakers in a row on one side isn't in order, so the floor goes back to the chair."
              : "To the chair, and the other side speaks next. Or to a state on the same side of the list who hasn't spoken."}
          </p>
        </>
      );
    }
    switch (c.step) {
      case "proposer": return (
        <>
          <button type="button" className="button" onClick={() => act(ch.callProposer)}>Call {name(c.resolution.proposer)} to propose</button>
          <p className={s.hint}>{HINT.proposer}</p>
        </>
      );
      case "seconder": return (
        <>
          <button type="button" className="button" onClick={() => act(ch.callSeconder)}>Call {name(c.resolution.seconder)} to second</button>
          <p className={s.hint}>{HINT.seconder}</p>
        </>
      );
      case "opposer": return (
        <>
          <div className="field">
            <label htmlFor="fl-opp" className="sr-only">State to speak against</label>
            <select id="fl-opp" className="control" value={oppId} onChange={(e) => setOpp(e.target.value)}>
              {oppOptions.map((id) => <option key={id} value={id}>{name(id)}{against.includes(id) ? " (on the list)" : ""}</option>)}
            </select>
          </div>
          <button type="button" className="button" disabled={!oppId} onClick={() => act((x) => ch.callOpposer(x, oppId))}>Call to speak against</button>
          <p className={s.hint}>{HINT.opposer}</p>
        </>
      );
      case "caucus": return (
        <>
          {timerBtn("button")}
          <button type="button" className="button secondary" onClick={() => act(ch.endCaucus)}>End caucus</button>
          <p className={s.hint}>The negotiation room is closed. Delegates stand up and talk directly. Set the time with the buttons below.</p>
        </>
      );
      case "reply": return (
        <>
          {repId ? <button type="button" className="button" onClick={() => act((x) => ch.callReply(x, repId))}>Call {name(repId)} for the Right of Reply</button>
            : <p className={s.hint}>No one is in favour, so the Right of Reply doesn&apos;t take place.</p>}
          <button type="button" className={repId ? "button secondary" : "button"} onClick={() => act(ch.skipReply)}>{repId ? "No Right of Reply" : "Go to the vote"}</button>
          {repOptions.length > 1 && (
            <div className="field">
              <label htmlFor="fl-rep">Someone else in favour</label>
              <select id="fl-rep" className="control" value={repId} onChange={(e) => setRep(e.target.value)}>
                {repOptions.map((id) => <option key={id} value={id}>{name(id)}</option>)}
              </select>
            </div>
          )}
          <p className={s.hint}>{HINT.reply}</p>
        </>
      );
      case "vote": return (
        <>
          <button type="button" className="button" disabled={ch.count(c).left > 0} onClick={() => act(ch.finishVote)}>Record the result</button>
          <p className={s.hint}>{ch.count(c).left ? `${ch.count(c).left} state${ch.count(c).left === 1 ? "" : "s"} still to vote.` : "Everyone has voted."}</p>
        </>
      );
      case "closed": return (
        <>
          <button type="button" className="button" onClick={() => act(ch.newResolution)}>Next resolution</button>
          <button type="button" className="button secondary" onClick={() => act(ch.reopenVote)}>Reopen the vote</button>
        </>
      );
      case "amend":
        if (c.amend?.stage === "read") return (
          <>
            <button type="button" className="button" onClick={() => act(ch.amendAsk)}>Vote on whether to debate it</button>
            <div className={s.btnRow}>
              <button type="button" className={sm} onClick={() => act(ch.amendDebate)}>Debate it now</button>
              <button type="button" className={sm} onClick={() => act(ch.amendVote)}>Straight to the vote</button>
            </div>
            <div className={s.btnRow}>
              <button type="button" className={sm} onClick={() => act((x) => ch.setTimer(x, "Explanation", 30))}>30 second explanation</button>
              <button type="button" className={sm} onClick={() => act((x) => ch.callCaucus(x, 120))}>Call a caucus</button>
            </div>
            <button type="button" className={sm} onClick={() => act(ch.backOutAmendment)}>Set it aside for now</button>
            <p className={s.hint}>The negotiation room is closed while an amendment is read, explained and voted on.</p>
          </>
        );
        if (c.amend?.stage === "ask" || c.amend?.stage === "vote") return <PollBox c={c} act={act} />;
        break;
    }
    if (debating) return (
      <>
        {amendLive && !c.debate.run.length
          ? <button type="button" className="button" onClick={() => act(ch.callAmender)}>Call {name(amendment?.by ?? null)} to speak</button>
          : next
            ? <button type="button" className="button" onClick={() => act((x) => ch.callSpeaker(x, next.id, next.side))}>Call {name(next.id)}</button>
            : null}
        <div className={s.btnRow}>
          <button type="button" className={sm} onClick={() => act((x) => ch.callCaucus(x, 120))}>Call a caucus</button>
          {amendLive
            ? <button type="button" className={sm} disabled={!!sp} onClick={() => act(ch.amendVote)}>Close and vote</button>
            : <button type="button" className={sm} onClick={() => act(ch.closeDebate)}>Close debate</button>}
        </div>
        <details>
          <summary className={s.hint}>Call a state that isn&apos;t on the list</summary>
          <div className={s.pickRow} style={{ marginTop: 8 }}>
            <label htmlFor="fl-any" className="sr-only">State</label>
            <select id="fl-any" className="control" value={anyWho} onChange={(e) => setAnyWho(e.target.value)}>
              <option value="">Choose a state</option>
              {c.delegates.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <button type="button" className="button secondary sm" disabled={!anyWho} onClick={() => act((x) => ch.callSpeaker(x, anyWho, anySide))}>Call</button>
          </div>
          <div style={{ marginTop: 8 }}><SideSwitch side={anySide} setSide={setAnySide} /></div>
        </details>
        <p className={s.hint}>{amendLive ? "After the amendment's proposer, the other side speaks. Closing the debate goes to the vote." : "The sides alternate, unless a state was yielded to. Close debate for the final caucus, then the Right of Reply."}</p>
      </>
    );
    return null;
  })();

  return (
    <section className={`panel ${s.floor}`} aria-label="The floor" data-up={state === "up" || undefined}>
      <div className={s.floorMain}>
        <div className={s.chips}>
          <span className={s.chip} data-tone="accent">{sp ? ch.ROLE_LABEL[sp.role] : stageChip}</span>
          {chipSide && <span className={s.chip} data-side={chipSide}>{SIDE[chipSide]}</span>}
          {showNeg && <span className={s.chip} data-tone={c.negotiation ? "ok" : undefined}>Negotiation room {c.negotiation ? "open" : "closed"}</span>}
        </div>
        {c.resolution.title && <p className={s.res}>Resolution: {c.resolution.title}</p>}
        <h2 className={`serif ${s.who}`}>{title}</h2>
        {sub && <p className={s.sub}>{sub}</p>}
        {amendment && c.step === "amend" && <p className={s.sub}>{amendment.text}</p>}
        {c.result && !c.poll && <p className={s.result} data-pass={c.result.passed}><strong>{c.result.title}</strong> {c.result.passed ? "passed" : "failed"}: {c.result.yes} for, {c.result.no} against, {c.result.abstain} abstaining.</p>}
        {c.timer && c.step !== "closed" && <div className={s.time} data-state={state} role="timer">{ch.clock(left)}</div>}
      </div>
      <div className={s.actions}>{actions}</div>
      {c.timer && c.step !== "closed" && <div className={s.track} aria-hidden="true"><i style={{ width: `${pct}%` }} /></div>}
      <div className={s.floorFoot}>
        <div className={s.nudges}>
          {c.timer && <>
            {!sp && c.step !== "caucus" && timerBtn("button secondary")}
            <button type="button" className="button secondary" onClick={() => act((x) => ch.nudgeTimer(x, -15, ch.now()))} aria-label="Take 15 seconds off">−15s</button>
            <button type="button" className="button secondary" onClick={() => act((x) => ch.nudgeTimer(x, 15, ch.now()))} aria-label="Add 15 seconds">+15s</button>
            <button type="button" className="button secondary" onClick={() => act(ch.resetTimer)}>Reset</button>
          </>}
          {!c.timer && <span className={`${s.keys} muted`}>Each speech is {ch.clock(c.speakSecs * 1000)}. Change it under the speakers&apos; list.</span>}
        </div>
        <p className={`${s.keys} muted`}>Space starts or pauses · N calls the next speaker</p>
      </div>
    </section>
  );
}

const HINT: Record<ch.Role, string> = {
  proposer: "The proposer speaks in favour, then takes one or two points of information. They cannot yield.",
  seconder: "The seconder speaks in favour and takes points of information. They cannot yield. The speakers' list opens now.",
  opposer: "The first state against may yield to the chair, or to another state against who speaks after the caucus.",
  speaker: "Points of information next, then they yield to the chair or to a state on their side who hasn't spoken.",
  amender: "The amendment's proposer speaks in favour of it and may yield.",
  reply: "The last speech, in favour. No points of information. Notes end and the negotiation room stays closed.",
};

function SideSwitch({ side, setSide }: { side: Side; setSide: (s: Side) => void }) {
  return (
    <div className={s.segmini} role="group" aria-label="Side">
      {(["for", "against"] as const).map((k) => <button key={k} type="button" data-side={k} aria-pressed={side === k} onClick={() => setSide(k)}>{SIDE[k]}</button>)}
    </div>
  );
}

// A vote by placard: counts for, against and abstaining. More for than against passes; the President may overrule it.
function PollBox({ c, act }: { c: Chamber; act: Act }) {
  const p = c.poll;
  if (!p) return null;
  const would = ch.passes(p);
  const cast = p.yes + p.no + p.abstain;
  const decide = p.kind === "debate" ? ch.decideAsk : ch.decideAmendment;
  return (
    <>
      <div className={s.counters}>
        {([["yes", "For"], ["no", "Against"], ["abstain", "Abstain"]] as const).map(([k, label]) => (
          <div key={k} className={s.counter} data-kind={k}>
            <span className={s.cname}>{label}</span>
            <output className={`${s.count} num`} aria-live="polite">{p[k]}</output>
            <div className={s.step}>
              <button type="button" className="button secondary" onClick={() => act((x) => ch.tally(x, k, -1))} aria-label={`One fewer ${label.toLowerCase()}`} disabled={!p[k]}>−</button>
              <button type="button" className="button secondary" onClick={() => act((x) => ch.tally(x, k, 1))} aria-label={`One more ${label.toLowerCase()}`}>+</button>
            </div>
          </div>
        ))}
      </div>
      <p className={s.verdict}>Abstentions don&apos;t count. {cast ? <strong data-pass={would}>{would ? "Would pass" : "Would fail"}</strong> : null}</p>
      <button type="button" className="button" onClick={() => act((x) => decide(x, false))}>Record the result</button>
      <button type="button" className="button secondary sm" onClick={() => act((x) => decide(x, true))}>Overrule: record the opposite</button>
    </>
  );
}

/* The speakers' list: two sides, in the order they will be called. */
function Lists({ c, act }: { c: Chamber; act: Act }) {
  const [who, setWho] = useState("");
  const [side, setSide] = useState<Side>("for");
  const open = ch.listOpen(c);
  const next = ch.nextCandidate(c);
  const options = c.delegates.filter((d) => ch.canAdd(c, d.id, side));
  const pick = options.some((d) => d.id === who) ? who : "";
  const col = (k: Side) => c.debate.list.filter((x) => x.side === k);
  const spoken = c.debate.run.map((x) => `${ch.nameOf(c, x.id)}${c.debate.run.filter((y) => y.id === x.id).length > 1 ? ` (${x.side})` : ""}`);

  return (
    <section className={`panel ${s.list}`} aria-labelledby="ch-list">
      <div className={s.head}>
        <h2 id="ch-list" className={s.h2}>{c.step === "amend" ? "Amendment speakers' list" : "Speakers' list"}</h2>
        <span className="badge">{c.debate.list.length}</span>
      </div>
      <Duration id="ch-sp" label="Time per speech" value={c.speakSecs} min={5} max={3600}
        onChange={(secs, ok) => { if (ok && secs !== null) act((x) => ch.setSpeakSecs(x, secs)); }} />
      {!open ? <p className={s.hint}>The list opens when the seconder begins. States join by note, saying whether they are for or against.</p> : (
        <form className={s.addRow} onSubmit={(e) => { e.preventDefault(); if (pick) { act((x) => ch.addToList(x, pick, side)); setWho(""); } }}>
          <label htmlFor="ch-add" className="sr-only">Add a state to the list</label>
          <select id="ch-add" className={`control ${s.addWho}`} value={pick} onChange={(e) => setWho(e.target.value)}>
            <option value="">{options.length ? "Add a state…" : "No one else can join this side"}</option>
            {options.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <SideSwitch side={side} setSide={setSide} />
          <button type="submit" className="button secondary" disabled={!pick}>Add</button>
        </form>
      )}
      {c.debate.yielded && (
        <ul className={s.queue}>
          <li data-next="true"><span className={s.qname}>{ch.nameOf(c, c.debate.yielded.id)}</span><span className={s.qtag}>Yielded to · speaks next</span></li>
        </ul>
      )}
      <div className={s.sides}>
        {(["for", "against"] as const).map((k) => (
          <div key={k} className={s.sideCol}>
            <div className={s.sideHead}><span className={s.chip} data-side={k}>{SIDE[k]}</span><span className="muted">{col(k).length}</span></div>
            {col(k).length ? (
              <ol className={s.queue}>
                {col(k).map((x) => (
                  <li key={x.id} data-next={!c.debate.yielded && next?.id === x.id}>
                    <span className={s.qname}>{ch.nameOf(c, x.id)}</span>
                    <span className={s.rowBtns}>
                      <IconButton label={`Move ${ch.nameOf(c, x.id)} up`} icon={ICONS.up} onClick={() => act((y) => ch.shiftList(y, x.id, -1))} />
                      <IconButton label={`Move ${ch.nameOf(c, x.id)} down`} icon={ICONS.down} onClick={() => act((y) => ch.shiftList(y, x.id, 1))} />
                      <IconButton label={`${ch.nameOf(c, x.id)} changes side`} icon={SWAP} onClick={() => act((y) => ch.switchSide(y, x.id))} />
                      <IconButton label={`Remove ${ch.nameOf(c, x.id)}`} icon={ICONS.close} onClick={() => act((y) => ch.removeFromList(y, x.id))} />
                    </span>
                  </li>
                ))}
              </ol>
            ) : <p className={s.empty}>No one yet.</p>}
          </div>
        ))}
      </div>
      {spoken.length > 0 && <p className={s.spoken}>Has spoken: {spoken.join(", ")}.</p>}
    </section>
  );
}

/* What sits beside the list changes with the step: amendments and the council, the amendment in hand, or the roll call. */
function Workspace({ c, act }: { c: Chamber; act: Act }) {
  const [tab, setTab] = useState<"amendments" | "council">("amendments");
  if (c.step === "vote" || c.step === "closed") return <section className={`panel ${s.side}`}><RollCall c={c} act={act} /></section>;
  return (
    <section className={`panel ${s.side}`}>
      <PanelTabs idPrefix="chw" label="Committee tools" tab={tab} setTab={setTab}
        tabs={[{ id: "amendments", label: "Amendments", icon: ICONS.edit, badge: ch.waitingAmendments(c).length || undefined, badgeNote: "waiting" }, { id: "council", label: "Council", icon: ICONS.check }]} />
      <div id={`chw-panel-${tab}`} role="tabpanel" aria-labelledby={`chw-tab-${tab}`} className={s.panelBody}>
        {tab === "amendments" ? <Amendments c={c} act={act} /> : <Council c={c} act={act} />}
      </div>
    </section>
  );
}

const STATUS: Record<ch.Amendment["status"], string> = { waiting: "Waiting", entertained: "Being considered", passed: "Passed", failed: "Failed", withdrawn: "Withdrawn", invalid: "Ruled invalid" };

function Amendments({ c, act }: { c: Chamber; act: Act }) {
  const [by, setBy] = useState("");
  const [clause, setClause] = useState("");
  const [text, setText] = useState("");
  const [backers, setBackers] = useState<string[]>([]);
  const waiting = ch.waitingAmendments(c);
  const live = c.amendments.find((a) => a.id === c.amend?.id);
  const done = c.amendments.filter((a) => a.status !== "waiting" && a.status !== "entertained");
  const notes = c.step === "seconder" || c.step === "opposer" || c.step === "caucus" || c.step === "floor" || c.step === "amend";
  const name = (id: string) => ch.nameOf(c, id);
  const ready = notes && !!by && text.trim().length > 0;
  const canEntertain = c.step === "floor" && !c.speech && !c.amend;

  return (
    <>
      {live && (
        <div className={s.amendCard} data-live="true">
          <span className={s.chip} data-tone="accent">Being considered</span>
          <p className={s.amendText}>{live.text}</p>
          <p className={s.amendMeta}>From {name(live.by)}{live.clause && ` · ${live.clause}`}{live.backers.length > 0 && ` · Co-sponsors: ${live.backers.map(name).join(", ")}`}</p>
        </div>
      )}
      {waiting.length > 0 && (
        <ul className={s.states} style={{ gap: 10 }}>
          {waiting.map((a) => (
            <li key={a.id} style={{ display: "block" }}>
              <div className={s.amendCard}>
                <p className={s.amendText}>{a.text}</p>
                <p className={s.amendMeta}>From {name(a.by)}{a.clause && ` · ${a.clause}`} · {a.backers.length} co-sponsor{a.backers.length === 1 ? "" : "s"}{a.backers.length > 0 && `: ${a.backers.map(name).join(", ")}`}</p>
                <div className={s.amendBtns}>
                  <button type="button" className="button" disabled={!canEntertain} onClick={() => act((x) => ch.entertain(x, a.id))}>Entertain</button>
                  <button type="button" className="button secondary" onClick={() => act((x) => ch.invalidAmendment(x, a.id))}>Rule invalid</button>
                  <button type="button" className="button secondary" onClick={() => act((x) => ch.withdrawAmendment(x, a.id))}>Withdraw</button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {!canEntertain && waiting.length > 0 && !live && <p className={s.hint}>Amendments are entertained between speeches, after the first caucus. More co-sponsors first.</p>}
      {!waiting.length && !live && <p className={s.empty}>No amendments waiting.</p>}

      <form className={s.panelBody} onSubmit={(e) => { e.preventDefault(); if (!ready) return; act((x) => ch.submitAmendment(x, uid(), by, clause, text, backers)); setText(""); setClause(""); setBackers([]); }}>
        <h3 className={s.h2}>Take an amendment</h3>
        {!notes && <p className={s.hint}>Amendments come by note once the proposer has spoken.</p>}
        <div className={s.two}>
          <div className="field">
            <label htmlFor="am-by">From</label>
            <select id="am-by" className="control" value={by} onChange={(e) => { setBy(e.target.value); setBackers((b) => b.filter((x) => x !== e.target.value)); }} disabled={!notes}>
              <option value="">Choose a state</option>
              {c.delegates.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="am-cl">Clause</label>
            <input id="am-cl" className="control" value={clause} onChange={(e) => setClause(e.target.value)} placeholder="Operative clause 2" maxLength={40} disabled={!notes} />
          </div>
        </div>
        <div className="field">
          <label htmlFor="am-tx">What it changes</label>
          <textarea id="am-tx" className="control" rows={3} value={text} onChange={(e) => setText(e.target.value)} maxLength={600} disabled={!notes} />
          <small>One operative clause, or one new clause. The preamble can&apos;t be amended.</small>
        </div>
        <fieldset className={s.procedure} disabled={!notes || !by}>
          <legend>Co-sponsors</legend>
          <div className={s.backers}>
            {c.delegates.filter((d) => d.id !== by).map((d) => (
              <label key={d.id} className={s.check}>
                <input type="checkbox" checked={backers.includes(d.id)} onChange={(e) => setBackers((b) => (e.target.checked ? [...b, d.id] : b.filter((x) => x !== d.id)))} />
                {d.name}
              </label>
            ))}
          </div>
        </fieldset>
        <button type="submit" className="button secondary block" disabled={!ready}>Add amendment</button>
      </form>

      {done.length > 0 && (
        <ul className={s.states}>
          {done.map((a) => <li key={a.id}><span>{name(a.by)}{a.clause && ` · ${a.clause}`}</span><span className={s.chip} data-tone={a.status === "passed" ? "ok" : a.status === "failed" || a.status === "invalid" ? "bad" : undefined}>{STATUS[a.status]}</span></li>)}
        </ul>
      )}
    </>
  );
}

function Council({ c, act }: { c: Chamber; act: Act }) {
  const [edit, setEdit] = useState(false);
  const [name, setName] = useState("");
  const between = c.step === "open" || c.step === "closed";
  return (
    <>
      <div className={s.head}>
        <p className={s.hint}>{c.delegates.length} states · {c.delegates.filter((d) => d.permanent).length} permanent. Three-fifths of {c.delegates.length} is {ch.needed(c.delegates.length)}.</p>
        <button type="button" className="button secondary" onClick={() => setEdit((e) => !e)} aria-pressed={edit}>{edit ? "Done" : "Edit"}</button>
      </div>
      <ul className={s.council}>
        {c.delegates.map((d) => {
          const stance = c.resolution.stance[d.id];
          return (
            <li key={d.id}>
              <span className={s.cname2}>{d.name}</span>
              {edit
                ? <button type="button" className={s.pbadge} aria-pressed={d.permanent} onClick={() => act((x) => ch.setPermanent(x, d.id, !d.permanent))}>{d.permanent ? "Permanent" : "Make permanent"}</button>
                : d.permanent && <span className={s.pbadge}>Permanent</span>}
              {!edit && stance && <span className={s.chip} data-side={stance}>{SIDE[stance]}</span>}
              {edit && between && <IconButton label={`Remove ${d.name}`} icon={ICONS.close} onClick={() => act((x) => ch.removeDelegate(x, d.id))} />}
            </li>
          );
        })}
      </ul>
      {edit && (
        <form className={s.addRow2} onSubmit={(e) => { e.preventDefault(); act((x) => ch.addDelegate(x, uid(), name)); setName(""); }}>
          <label htmlFor="co-add" className="sr-only">Add a state</label>
          <input id="co-add" className="control" value={name} onChange={(e) => setName(e.target.value)} placeholder="Add a state" maxLength={60} />
          <button type="submit" className="button secondary" disabled={!name.trim()}>Add</button>
        </form>
      )}
      {!between && edit && <p className={s.hint}>States can only be removed between resolutions.</p>}
    </>
  );
}

/* The vote on the resolution, state by state. */
function RollCall({ c, act }: { c: Chamber; act: Act }) {
  const n = ch.count(c);
  const need = ch.needed(c.delegates.length);
  const closed = c.step === "closed";
  return (
    <>
      <div className={s.head}>
        <h2 className={s.h2}>Roll call</h2>
        <span className="badge">{c.delegates.length - n.left} of {c.delegates.length}</span>
      </div>
      {closed && c.outcome && (
        <p className={s.banner} data-pass={c.outcome.passed}>
          <strong>{c.outcome.passed ? "Approved" : "Not approved"}</strong>
          {c.outcome.yes} for, {c.outcome.no} against, {c.outcome.abstain} abstaining.
          {c.outcome.vetoed.length > 0 ? ` Vetoed by ${c.outcome.vetoed.join(", ")}.` : !c.outcome.passed ? ` ${c.outcome.needed} votes in favour were needed.` : ""}
        </p>
      )}
      <div className={s.tally}>
        <span className={s.chip} data-side="for">For {n.yes}</span>
        <span className={s.chip} data-side="against">Against {n.no}</span>
        <span className={s.chip}>Abstain {n.abstain}</span>
        {n.vetoed.length > 0 && <span className={s.chip} data-tone="bad">Veto: {n.vetoed.join(", ")}</span>}
      </div>
      <p className={s.hint}>Needs at least {need} in favour (three-fifths of all {c.delegates.length}) and no vote against from a permanent member. An abstention counts as neither.</p>
      <ul className={s.ballots}>
        {c.delegates.map((d) => (
          <li key={d.id} className={s.ballot}>
            <span className={s.cname2}>{d.name}</span>
            {d.permanent && <span className={s.pbadge}>Permanent</span>}
            <div className={s.vote3} role="group" aria-label={`Vote of ${d.name}`}>
              {([["for", "For"], ["against", "Against"], ["abstain", "Abstain"]] as const).map(([b, label]) => (
                <button key={b} type="button" data-b={b} aria-pressed={c.ballots[d.id] === b} disabled={closed}
                  onClick={() => act((x) => ch.cast(x, d.id, c.ballots[d.id] === b ? null : (b as Ballot)))}>{label}</button>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

function Minutes({ c, act, say }: { c: Chamber; act: Act; say: (t: string) => void }) {
  const [text, setText] = useState("");
  return (
    <section id="chv-panel-minutes" role="tabpanel" aria-labelledby="chv-tab-minutes" className={`panel ${s.log}`}>
      <div className={s.head}>
        <h2 className={s.h2}>Minutes</h2>
        <button type="button" className="button secondary" onClick={() => navigator.clipboard?.writeText(ch.minutes(c)).then(() => say("Minutes copied"), () => say("Couldn't copy"))}>Copy minutes</button>
      </div>
      <form className={s.addRow2} onSubmit={(e) => { e.preventDefault(); act((x) => ch.addNote(x, text)); setText(""); }}>
        <label htmlFor="mn-t" className="sr-only">Add to the minutes</label>
        <input id="mn-t" className="control" value={text} onChange={(e) => setText(e.target.value)} placeholder="Note a ruling or point of order" maxLength={300} />
        <button type="submit" className="button secondary" disabled={!text.trim()}>Add</button>
      </form>
      <ol className={s.entries}>
        {[...c.log].reverse().map((e, i) => (
          <li key={`${e.at}-${i}`}><time className="num">{new Date(e.at).toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit", timeZone: "Australia/Sydney" })}</time><span>{e.text}</span></li>
        ))}
      </ol>
    </section>
  );
}

type Member = { user_id: string; name: string; email: string; is_owner: boolean };

// Who can run this committee. A committee kept in this browser can be shared, which moves it to Collex so the people
// added (by the email on their account) can open the console and the display from their own devices.
function Share({ c, cloudId, owner, signedIn, meId, say, setLocal }: {
  c: Chamber; cloudId: string | null; owner: boolean; signedIn: boolean; meId?: string; say: (t: string) => void; setLocal: (c: Chamber | null) => void;
}) {
  const router = useRouter();
  const [team, setTeam] = useState<Member[] | null>(null);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const load = async () => {
    if (!cloudId || !supabase) return;
    const { data } = await supabase.rpc("chamber_team", { cid: cloudId });
    setTeam((data as Member[] | null) ?? []);
  };
  useEffect(() => { void load(); }, [cloudId]); // eslint-disable-line react-hooks/exhaustive-deps

  const share = async () => {
    if (!supabase) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("create_chamber", { initial: c });
    setBusy(false);
    if (error) { say(error.message); return; }
    setLocal(null);
    router.replace(`/chambers?c=${data}`);
    say("Committee shared");
  };
  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !cloudId || !email.trim()) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("add_chamber_member", { cid: cloudId, invitee_email: email });
    setBusy(false);
    if (error) { say(error.message); return; }
    setEmail("");
    say(`${data} added`);
    void load();
  };
  const drop = async (target: string) => {
    if (!supabase || !cloudId) return;
    const { error } = await supabase.rpc("remove_chamber_member", { cid: cloudId, target });
    if (error) say(error.message); else void load();
  };

  return (
    <section id="ch-share" className={`panel ${s.share}`} aria-label="Share this committee">
      {!cloudId ? (
        <>
          <div>
            <h2 className={s.h2}>Run it from more than one screen</h2>
            <p className="muted">Share this committee and add other chairs by the email on their Collex account. One can have the display on the projector while another runs the committee from a laptop.</p>
          </div>
          {signedIn
            ? <button type="button" className="button" onClick={share} disabled={busy}>Share this committee</button>
            : <Link href="/login" className="button">Log in to share</Link>}
        </>
      ) : (
        <>
          <div>
            <h2 className={s.h2}>On this committee</h2>
            <p className="muted">Everyone here can run the console and open the display. They need to be logged in on their own device.</p>
          </div>
          <ul className={s.team}>
            {(team ?? []).map((m) => (
              <li key={m.user_id}>
                <span className={s.tname}>{m.name || m.email}{m.user_id === meId && " (you)"}</span>
                <span className="badge">{m.is_owner ? "Owner" : "Chair"}</span>
                {owner && !m.is_owner && <IconButton label={`Remove ${m.name || m.email}`} icon={ICONS.close} onClick={() => drop(m.user_id)} />}
              </li>
            ))}
          </ul>
          {owner ? (
            <form className={s.addRow2} onSubmit={add}>
              <label htmlFor="ch-inv" className="sr-only">Email on their Collex account</label>
              <input id="ch-inv" type="email" className="control" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email on their Collex account" maxLength={254} />
              <button type="submit" className="button secondary" disabled={busy || !email.trim()}>Add</button>
            </form>
          ) : <p className="muted">Only the person who shared it can add people.</p>}
        </>
      )}
    </section>
  );
}

type Mine = { id: string; name: string; is_owner: boolean; owner_name: string };

function Setup({ onCreate, signedIn }: { onCreate: (c: Chamber) => void; signedIn: boolean }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [topic, setTopic] = useState("");
  const [speak, setSpeak] = useState<number | null>(120);
  const [speakOk, setSpeakOk] = useState(true);
  const [text, setText] = useState("");
  const [mine, setMine] = useState<Mine[]>([]);
  const names = ch.parseNames(text);
  const ok = name.trim().length >= 2 && speakOk && speak !== null && names.length > 0;
  const perm = names.filter(ch.isPermanent);

  useEffect(() => {
    if (!signedIn || !supabase) return;
    let live = true;
    supabase.rpc("my_chambers").then(({ data }) => { if (live) setMine((data as Mine[] | null) ?? []); });
    return () => { live = false; };
  }, [signedIn]);

  return (
    <main id="top" className={`container ${s.setup}`}>
      <PageBand title="Chambers" lead="Run a Security Council debate under the Evatt rules: the speakers' list, timer, amendments and the vote, with a display for the projector." />
      <div className={s.setupStack}>
        {mine.length > 0 && (
          <section className={`panel ${s.setupCard}`} aria-labelledby="cs-mine">
            <h2 id="cs-mine" className={s.h2}>Shared with you</h2>
            <ul className={s.mine}>
              {mine.map((m) => (
                <li key={m.id}>
                  <button type="button" className={s.mineBtn} onClick={() => router.push(`/chambers?c=${m.id}`)}>
                    <span className={s.tname}>{m.name}</span>
                    <small>{m.is_owner ? "You run this" : `Run by ${m.owner_name}`}</small>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
        <form className={`panel ${s.setupCard}`} onSubmit={(e) => { e.preventDefault(); if (ok && speak !== null) onCreate(ch.create(name, topic, speak, names, names.map(uid))); }}>
          <fieldset className={s.procedure}>
            <legend>Procedure</legend>
            <div role="radiogroup" aria-label="Procedure">
              <button type="button" role="radio" aria-checked="true" className={s.proc}>
                <span className={s.procMark}>{ICONS.check}</span>
                <span className={s.procText}>
                  <strong>Evatt</strong>
                  <small>UN Youth Australia&apos;s Security Council debate: a proposer and seconder, amendments, caucus and a roll-call vote.</small>
                </span>
              </button>
            </div>
          </fieldset>
          <div className={s.two}>
            <div className="field">
              <label htmlFor="cs-name">Committee</label>
              <input id="cs-name" className="control" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required />
            </div>
            <Duration id="cs-sp" label="Speaking time" value={120} min={5} max={3600} onChange={(v, good) => { setSpeak(v); setSpeakOk(good); }} />
          </div>
          <div className="field">
            <label htmlFor="cs-topic">Topic <span className="muted">(optional)</span></label>
            <input id="cs-topic" className="control" value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={160} />
          </div>
          <div className="field">
            <label htmlFor="cs-names">Member states</label>
            <textarea id="cs-names" className="control" value={text} onChange={(e) => setText(e.target.value)} rows={8} placeholder="One per line, or separated by commas" />
            {names.length > 0 && <small>{names.length} {names.length === 1 ? "state" : "states"}{perm.length > 0 ? `, ${perm.length} permanent (${perm.join(", ")}). You can change who is permanent once it's open.` : ". None are permanent members yet; you can set them once it's open."}</small>}
          </div>
          <button type="submit" className="button lg block" disabled={!ok}>Open Committee</button>
          <p className={`${s.keys} muted`}>It is saved in this browser until you share it with other chairs.</p>
        </form>
      </div>
    </main>
  );
}
