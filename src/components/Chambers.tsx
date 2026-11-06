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

// "Welcome to the UNSC", not "the The UNSC".
export const bare = (name: string) => name.replace(/^the\s+/i, "");

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
    setLive(sp ? `${ch.ROLE_LABEL[sp.role]} ${ch.nameOf(c, sp.who)}: ${sp.phase === "speech" ? "speech" : sp.phase === "after" ? "Points of Information or yield" : sp.phase === "ask" ? `Point of Information from ${ch.nameOf(c, sp.asker)}` : "reply"}` : ch.substep(c));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp?.who, sp?.phase, sp?.asker, c?.step, c?.amend?.stage]);

  const toggle = () => act((x) => (ch.running(x.timer) ? ch.pauseTimer(x, ch.now()) : ch.startTimer(x, ch.now())));
  // Space starts or pauses the timer. N calls the next speaker, and only when no one is speaking, so a stray key can't end a speech.
  const callNext = () => {
    if (!c || c.speech || c.step !== "amend" || c.amend?.stage !== "debate") return;
    if (!c.debate.run.length) { act((x) => ch.callAmender(x)); return; }
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

  const inDebate = c.step === "caucus" || c.step === "floor" || c.step === "amend";

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
          <Rail c={c} />
          {c.step === "welcome" ? <Welcome c={c} act={act} />
            : c.step === "roll" ? <RollCallOpen c={c} act={act} />
            : c.step === "pick" ? <Pick c={c} act={act} />
            : <Floor c={c} act={act} left={left} state={state} toggle={toggle} />}
          {inDebate && (ch.listOpen(c)
            ? <div className={s.pair}><Lists c={c} act={act} /><Amendments c={c} act={act} /></div>
            : <Amendments c={c} act={act} />)}
          {(c.step === "vote" || c.step === "closed") && <RollCall c={c} act={act} />}
        </div>
      ) : (
        <Minutes c={c} act={act} say={say} />
      )}
      {node}
    </main>
  );
}

/* The three parts of the debate, and the step inside the one we're in. */
function Rail({ c }: { c: Chamber }) {
  const idx = ch.stageIndex(c);
  return (
    <ol className={s.rail} aria-label="Where the council is">
      {ch.STAGES.map((label, i) => (
        <li key={label} data-state={i < idx ? "done" : i === idx ? "now" : "next"} aria-current={i === idx ? "step" : undefined}>
          <span className={s.dot}>{i < idx ? ICONS.check : i + 1}</span>
          <span className={s.railText}>
            <span className={s.railLabel}>{label}</span>
            {i === idx && <span className={s.railSub}>{ch.substep(c)}</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}

/* Opening, 1: the welcome, with the resolution. */
function Welcome({ c, act }: { c: Chamber; act: Act }) {
  const [text, setText] = useState("");
  return (
    <section className={`panel ${s.welcome}`} aria-label="Welcome">
      <h2 className={`serif ${s.welcomeTitle}`}>Welcome to the {bare(c.name)}</h2>
      {c.topic ? (
        <div className={s.resBox}>
          <span className={s.tag}>Resolution</span>
          <p className={`serif ${s.resText}`}>{c.topic}</p>
        </div>
      ) : (
        <form className={s.resBox} onSubmit={(e) => { e.preventDefault(); act((x) => ch.setResolution(x, text)); }}>
          <div className="field">
            <label htmlFor="wl-res">Resolution</label>
            <input id="wl-res" className="control" value={text} onChange={(e) => setText(e.target.value)} maxLength={160} placeholder="The resolution being debated" />
          </div>
          <button type="submit" className="button secondary" disabled={!text.trim()}>Save the resolution</button>
        </form>
      )}
      <button type="button" className="button lg block" disabled={!c.topic} onClick={() => act(ch.startRoll)}>Start Roll Call</button>
    </section>
  );
}

/* Opening, 2: the roll call. */
const ATTEND: ch.Attend[] = ["present", "voting", "abstain"];
function RollCallOpen({ c, act }: { c: Chamber; act: Act }) {
  const n = ch.rollCount(c);
  return (
    <section className={`panel ${s.opening}`} aria-labelledby="rc-h">
      <div className={s.head}>
        <h2 id="rc-h" className={`serif ${s.who}`}>Roll call</h2>
        <span className="badge">{c.delegates.length - n.unmarked} of {c.delegates.length}</span>
      </div>
      <div className={s.tally}>
        <span className={s.chip} data-tone="ok">Present and Voting {n.voting}</span>
        <span className={s.chip}>Present {n.present}</span>
        <span className={s.chip} data-tone="warn">Abstain {n.abstain}</span>
        {n.unmarked > 0 && <span className={s.chip}>Not marked {n.unmarked}</span>}
      </div>
      <div className={s.btnRow}>
        <button type="button" className="button secondary" onClick={() => act((x) => ch.markAllRoll(x, "present"))}>Everyone Present</button>
        <button type="button" className="button secondary" onClick={() => act((x) => ch.markAllRoll(x, "voting"))}>Everyone Present and Voting</button>
      </div>
      <ul className={s.ballots}>
        {c.delegates.map((d) => (
          <li key={d.id} className={s.ballot}>
            <span className={s.cname2}>{d.name}</span>
            <div className={`${s.vote3} ${s.roll3}`} role="group" aria-label={`Roll call: ${d.name}`}>
              {ATTEND.map((a) => (
                <button key={a} type="button" data-a={a} aria-pressed={c.roll[d.id] === a} onClick={() => act((x) => ch.markRoll(x, d.id, c.roll[d.id] === a ? null : a))}>{ch.ATTEND_LABEL[a]}</button>
              ))}
            </div>
          </li>
        ))}
      </ul>
      <button type="button" className="button lg block" onClick={() => act(ch.beginDebate)}>Begin Debate</button>
      {n.unmarked > 0 && <p className={s.hint}>{n.unmarked} state{n.unmarked === 1 ? "" : "s"} not marked yet. They are noted as not marked in the minutes.</p>}
    </section>
  );
}

/* Opening, 3: the chair chooses the Proposer, Seconder and Opposer. */
function Pick({ c, act }: { c: Chamber; act: Act }) {
  const [prop, setProp] = useState("");
  const [sec, setSec] = useState("");
  const [opp, setOpp] = useState("");
  const here = c.delegates.filter((d) => c.roll[d.id]);
  const pool = here.length ? here : c.delegates;
  const field = (id: string, label: string, value: string, set: (v: string) => void, taken: string[]) => (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select id={id} className="control" value={value} onChange={(e) => set(e.target.value)}>
        <option value="">Choose a state</option>
        {pool.filter((d) => !taken.includes(d.id)).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
      </select>
    </div>
  );
  const ok = prop && sec && opp;
  return (
    <form className={`panel ${s.opening}`} onSubmit={(e) => { e.preventDefault(); if (ok) act((x) => ch.chooseSpeakers(x, prop, sec, opp)); }}>
      <div>
        <h2 className={`serif ${s.who}`}>Choose the speakers</h2>
        <p className={s.sub}>The Proposer and Seconder are in favour of the resolution, and the Opposer is against it. Each speaks in turn.</p>
      </div>
      <div className={s.three}>
        {field("pk-p", "Proposer", prop, setProp, [sec, opp])}
        {field("pk-s", "Seconder", sec, setSec, [prop, opp])}
        {field("pk-o", "Opposer", opp, setOpp, [prop, sec])}
      </div>
      <button type="submit" className="button lg block" disabled={!ok}>Start the speeches</button>
    </form>
  );
}

/* The floor: who has it, the time, and the one thing the chair does next. */
function Floor({ c, act, left, state, toggle }: { c: Chamber; act: Act; left: number; state: string; toggle: () => void }) {
  const sp = c.speech;
  const name = (id: string | null) => ch.nameOf(c, id);
  const [asker, setAsker] = useState("");
  const [callSecs, setCallSecs] = useState<number | null>(null);
  const [nextRes, setNextRes] = useState("");
  const [anyWho, setAnyWho] = useState("");
  const [anySide, setAnySide] = useState<Side>("for");
  useEffect(() => { setCallSecs(null); }, [c.speakSecs]);
  const secs = callSecs ?? c.speakSecs;
  const next = ch.nextCandidate(c);
  const aid = c.amend?.id ?? "";
  const amendment = c.amend ? c.amendments.find((a) => a.id === c.amend!.id) : undefined;
  const debateOpen = c.step === "amend" && c.amend?.stage === "debate";
  const waiting = ch.waitingAmendments(c);
  const pct = c.timer ? Math.min(100, (left / c.timer.total) * 100) : 0;
  const idx = ch.stageIndex(c);
  const askers = sp ? c.delegates.filter((d) => d.id !== sp.who) : [];
  const askerId = asker && askers.some((d) => d.id === asker) ? asker : "";
  const spokeFromList = c.debate.run.length > 1;
  const timeField = <Duration id="fl-secs" label="Time for this speech" value={c.speakSecs} min={5} max={3600} onChange={(v, ok) => setCallSecs(ok ? v : null)} />;

  const timerBtn = (cls = "button") => state === "up"
    ? <button type="button" className={cls} onClick={() => act(ch.resetTimer)}>Reset time</button>
    : <button type="button" className={cls} onClick={toggle} disabled={state === "none"}>{state === "running" ? "Pause" : "Start"} timer</button>;
  const sm = "button secondary sm";

  // What the floor is showing: a name or title, and a line under it.
  let title: React.ReactNode = "";
  let sub: React.ReactNode = "";
  if (sp) {
    if (sp.phase === "ask") { title = name(sp.asker); sub = `Point of Information for ${name(sp.who)}`; }
    else { title = name(sp.who); sub = sp.phase === "speech" ? "Speaking" : sp.phase === "after" ? "Takes a Point of Information, or yields to the chair" : "Replying to the Point of Information"; }
  }
  else if (c.step === "proposer") { title = name(c.roles.proposer); sub = "Proposes the resolution"; }
  else if (c.step === "seconder") { title = name(c.roles.seconder); sub = "Seconds the resolution"; }
  else if (c.step === "opposer") { title = name(c.roles.opposer); sub = "Speaks against the resolution"; }
  else if (c.step === "caucus") { title = c.timer?.label ?? "Caucus"; sub = "The debate begins with a caucus. States talk directly to each other, and amendments come in by note."; }
  else if (c.step === "floor") { title = waiting.length ? "Amendments" : "No amendments waiting"; sub = waiting.length ? `${waiting.length} waiting. The one with the most co-sponsors is first.` : "Add the notes you are handed on the right, or close the debate."; }
  else if (c.step === "closing") { title = "Closing speeches"; sub = "The Proposer, Seconder and Opposer each have a last speech. There are no Points of Information."; }
  else if (c.step === "vote") { title = "Roll call vote"; sub = "Record every state's vote below"; }
  else if (c.step === "closed") { title = c.outcome?.passed ? "Resolution approved" : "Resolution not approved"; sub = c.outcome ? `${c.outcome.yes} for, ${c.outcome.no} against, ${c.outcome.abstain} abstaining` : ""; }
  else if (c.step === "amend" && c.amend?.stage === "read") { title = `Amendment from ${name(amendment?.by ?? null)}`; sub = amendment?.clause || "Read it to the council"; }
  else if (c.step === "amend" && c.amend?.stage === "ask") { title = "Debate this amendment?"; sub = "A show of placards: more for than against"; }
  else if (c.step === "amend" && c.amend?.stage === "vote") { title = "Adopt this amendment?"; sub = "A show of placards: more for than against"; }
  else if (debateOpen) {
    if (!c.debate.run.length) { title = name(amendment?.by ?? null); sub = "Speaks first on their amendment"; }
    else if (next) { title = name(next.id); sub = "Next on the speakers' list"; }
    else { title = "The speakers' list is empty"; sub = spokeFromList ? "Everyone listed has spoken. Vote on the amendment." : "Add states to the speakers' list, For or Against"; }
  }

  const stageChip = ch.STAGES[idx];
  const chipSide: Side | null = sp ? sp.side : debateOpen && !sp && c.debate.run.length && next ? next.side : null;

  const actions = (() => {
    if (sp) {
      if (sp.phase === "speech") return (
        <>
          {timerBtn("button")}
          <button type="button" className="button secondary" onClick={() => act((x) => ch.endSpeech(x, ch.now(), sp.who))}>End speech</button>
          <p className={s.hint}>{HINT[sp.role]}</p>
        </>
      );
      if (sp.phase === "after") return (
        <>
          <div className="field">
            <label htmlFor="fl-ask">Who asks the Point of Information?</label>
            <select id="fl-ask" className="control" value={askerId} onChange={(e) => setAsker(e.target.value)}>
              <option value="">Choose a state</option>
              {askers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <button type="button" className="button" disabled={!askerId} onClick={() => act((x) => ch.askPoi(x, askerId, sp.who, sp.pois))}>Take a Point of Information</button>
          <button type="button" className="button secondary" onClick={() => act((x) => ch.yieldToChair(x, sp.who, sp.pois))}>Yield to the chair</button>
          {sp.pois === 0 && c.timer && <button type="button" className={sm} onClick={() => act((x) => ch.backPhase(x, sp.who, sp.pois))}>Back to the speech</button>}
          <p className={s.hint}>{sp.pois ? `${sp.pois} Point${sp.pois === 1 ? "" : "s"} of Information taken. ` : ""}A state has {ch.POI_SECS} seconds to ask, then {name(sp.who)} has {ch.POI_SECS} seconds to reply.</p>
        </>
      );
      if (sp.phase === "ask") return (
        <>
          {timerBtn("button")}
          <button type="button" className="button secondary" onClick={() => act((x) => ch.answerPoi(x, sp.who, sp.asker ?? "", sp.pois))}>Now {name(sp.who)} replies</button>
          <button type="button" className={sm} onClick={() => act((x) => ch.backPhase(x, sp.who, sp.pois))}>Cancel the question</button>
          <p className={s.hint}>{name(sp.asker)} asks one brief question.</p>
        </>
      );
      return (
        <>
          {timerBtn("button")}
          <button type="button" className="button secondary" onClick={() => act((x) => ch.donePoi(x, sp.who, sp.asker ?? "", sp.pois))}>Reply finished</button>
          <button type="button" className={sm} onClick={() => act((x) => ch.backPhase(x, sp.who, sp.pois))}>Back to the question</button>
          <p className={s.hint}>{name(sp.who)} gives one answer.</p>
        </>
      );
    }
    switch (c.step) {
      case "proposer": return (<><button type="button" className="button" onClick={() => act(ch.callProposer)}>Call {name(c.roles.proposer)} to propose</button><p className={s.hint}>{HINT.proposer}</p></>);
      case "seconder": return (<><button type="button" className="button" onClick={() => act(ch.callSeconder)}>Call {name(c.roles.seconder)} to second</button><p className={s.hint}>{HINT.seconder}</p></>);
      case "opposer": return (<><button type="button" className="button" onClick={() => act(ch.callOpposer)}>Call {name(c.roles.opposer)} to oppose</button><p className={s.hint}>{HINT.opposer}</p></>);
      case "caucus": return (
        <>
          {!ch.running(c.timer) && <Duration id="fl-cau" label="Caucus length" value={c.timer ? Math.round(c.timer.total / 1000) : ch.CAUCUS_SECS} min={5} max={10800}
            onChange={(v, ok) => { if (ok && v !== null) act((x) => ch.setCaucusSecs(x, v)); }} />}
          {timerBtn("button")}
          <button type="button" className="button secondary" onClick={() => act(ch.endCaucus)}>End caucus</button>
          <p className={s.hint}>The length is the chair&apos;s call. Amendments can be added on the right while states talk.</p>
        </>
      );
      case "floor": return (
        <>
          {waiting[0]
            ? <button type="button" className="button" onClick={() => act((x) => ch.entertain(x, waiting[0].id))}>Entertain the next amendment</button>
            : null}
          <div className={s.btnRow}>
            <button type="button" className={sm} onClick={() => act((x) => ch.callCaucus(x, 120))}>Call a caucus</button>
            <button type="button" className={waiting[0] ? sm : "button"} onClick={() => act(ch.closeDebate)}>Close the debate</button>
          </div>
          <p className={s.hint}>Closing the debate moves to the closing speeches and the vote on the resolution.</p>
        </>
      );
      case "closing": {
        const roles = ch.closingRoles(c);
        const all = roles.every((r) => c.closers.includes(r.id));
        const nextRole = roles.find((r) => !c.closers.includes(r.id));
        return (
          <>
            {roles.map((r) => {
              const done = c.closers.includes(r.id);
              return (
                <button key={r.role} type="button" className={r === nextRole ? "button" : "button secondary"} disabled={done} onClick={() => act((x) => ch.callCloser(x, r.id))}>
                  {done ? `${ch.ROLE_LABEL[r.role]} ${name(r.id)} has spoken` : `Call the ${ch.ROLE_LABEL[r.role]}: ${name(r.id)}`}
                </button>
              );
            })}
            <button type="button" className={all ? "button" : "button secondary sm"} onClick={() => act(ch.startVote)}>Go to the vote</button>
            <p className={s.hint}>Any order. Each speaks once, and there are no Points of Information.</p>
          </>
        );
      }
      case "vote": return (
        <>
          <button type="button" className="button" disabled={ch.count(c).left > 0} onClick={() => act(ch.finishVote)}>Record the result</button>
          <p className={s.hint}>{ch.count(c).left ? `${ch.count(c).left} state${ch.count(c).left === 1 ? "" : "s"} still to vote.` : "Everyone has voted."}</p>
        </>
      );
      case "closed": return (
        <>
          <form className={s.nextRes} onSubmit={(e) => { e.preventDefault(); act((x) => ch.newResolution(x, nextRes)); setNextRes(""); }}>
            <div className="field">
              <label htmlFor="fl-next">Next resolution</label>
              <input id="fl-next" className="control" value={nextRes} onChange={(e) => setNextRes(e.target.value)} maxLength={160} placeholder="The next resolution to debate" />
            </div>
            <button type="submit" className="button" disabled={!nextRes.trim()}>Start the next resolution</button>
          </form>
          <button type="button" className="button secondary" onClick={() => act(ch.reopenVote)}>Reopen the vote</button>
        </>
      );
      case "amend":
        if (c.amend?.stage === "read") return (
          <>
            <button type="button" className="button" onClick={() => act((x) => ch.amendAsk(x, aid))}>Vote on whether to debate it</button>
            <div className={s.btnRow}>
              <button type="button" className={sm} onClick={() => act((x) => ch.amendDebate(x, aid))}>Debate it now</button>
              <button type="button" className={sm} onClick={() => act((x) => ch.amendVote(x, aid))}>Straight to the vote</button>
            </div>
            <div className={s.btnRow}>
              <button type="button" className={sm} onClick={() => act((x) => ch.setTimer(x, "Explanation", 30))}>30 second explanation</button>
              <button type="button" className={sm} onClick={() => act((x) => ch.callCaucus(x, 120))}>Call a caucus</button>
            </div>
            <button type="button" className={sm} onClick={() => act((x) => ch.backOutAmendment(x, aid))}>Set it aside for now</button>
          </>
        );
        if (c.amend?.stage === "ask" || c.amend?.stage === "vote") return <PollBox c={c} act={act} />;
        break;
    }
    if (debateOpen) {
      const first = !c.debate.run.length;
      const primary = first
        ? <button type="button" className="button" onClick={() => act((x) => ch.callAmender(x, secs))}>Call {name(amendment?.by ?? null)} to speak</button>
        : next
          ? <button type="button" className="button" onClick={() => act((x) => ch.callSpeaker(x, next.id, next.side, secs))}>Call {name(next.id)}</button>
          : spokeFromList
            ? <button type="button" className="button" onClick={() => act((x) => ch.amendVote(x, aid))}>Vote on the amendment</button>
            : null;
      const votePrimary = !first && !next && spokeFromList;
      return (
        <>
          {(first || next) && timeField}
          {primary}
          <div className={s.btnRow}>
            {!votePrimary && <button type="button" className={sm} onClick={() => act((x) => ch.amendVote(x, aid))}>Vote on the amendment</button>}
            <button type="button" className={sm} onClick={() => act((x) => ch.callCaucus(x, 120))}>Call a caucus</button>
          </div>
          {!first && (
            <details>
              <summary className={s.hint}>Call a state that isn&apos;t on the list</summary>
              <div className={s.pickRow} style={{ marginTop: 8 }}>
                <label htmlFor="fl-any" className="sr-only">State</label>
                <select id="fl-any" className="control" value={anyWho} onChange={(e) => setAnyWho(e.target.value)}>
                  <option value="">Choose a state</option>
                  {c.delegates.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                <button type="button" className="button secondary sm" disabled={!anyWho} onClick={() => act((x) => ch.callSpeaker(x, anyWho, anySide, secs))}>Call</button>
              </div>
              <div style={{ marginTop: 8 }}><SideSwitch side={anySide} setSide={setAnySide} /></div>
            </details>
          )}
          <p className={s.hint}>{first ? "The amendment's proposer speaks first, then the chair puts states on the speakers' list, For or Against, with the time each gets." : "The sides alternate. When everyone listed has spoken, vote on the amendment."}</p>
        </>
      );
    }
    return null;
  })();

  return (
    <section className={`panel ${s.floor}`} aria-label="The floor" data-up={state === "up" || undefined}>
      <div className={s.floorMain}>
        <div className={s.chips}>
          <span className={s.chip} data-tone="accent">{sp ? ch.ROLE_LABEL[sp.role] : stageChip}</span>
          {chipSide && <span className={s.chip} data-side={chipSide}>{SIDE[chipSide]}</span>}
          {sp && sp.phase !== "speech" && <span className={s.chip}>Point of Information{sp.pois ? ` · ${sp.pois} taken` : ""}</span>}
        </div>
        {c.topic && <p className={s.res}>Resolution: {c.topic}</p>}
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
          {!c.timer && <span className={`${s.keys} muted`}>Each speech is {ch.clock(c.speakSecs * 1000)}.</span>}
        </div>
        <p className={`${s.keys} muted`}>Space starts or pauses · N calls the next speaker</p>
      </div>
    </section>
  );
}

const HINT: Record<ch.Role, string> = {
  proposer: "The Proposer speaks in favour. Then a state may ask a Point of Information, or they yield to the chair. They cannot yield to another state.",
  seconder: "The Seconder speaks in favour. Then a Point of Information, or they yield to the chair.",
  opposer: "The Opposer speaks against. Then a Point of Information, or they yield to the chair. The debate begins with a caucus.",
  speaker: "A Point of Information, or yield to the chair.",
  amender: "The amendment's proposer speaks in favour of it. Then a Point of Information, or they yield to the chair.",
  closer: "A last speech. There are no Points of Information.",
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
  const id = c.amend?.id ?? "";
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
      <button type="button" className="button" onClick={() => act((x) => decide(x, false, id))}>Record the result</button>
      <button type="button" className="button secondary sm" onClick={() => act((x) => decide(x, true, id))}>Overrule: record the opposite</button>
    </>
  );
}

/* The speakers' list for the amendment in hand: For and Against, in the order they will be called. */
function Lists({ c, act }: { c: Chamber; act: Act }) {
  const [who, setWho] = useState("");
  const [side, setSide] = useState<Side>("for");
  const next = ch.nextCandidate(c);
  const options = c.delegates.filter((d) => ch.canAdd(c, d.id, side));
  const pick = options.some((d) => d.id === who) ? who : "";
  const col = (k: Side) => c.debate.list.filter((x) => x.side === k);
  const spoken = c.debate.run.map((x) => ch.nameOf(c, x.id));

  return (
    <section className={`panel ${s.list}`} aria-labelledby="ch-list">
      <div className={s.head}>
        <h2 id="ch-list" className={s.h2}>Speakers&apos; list</h2>
        <span className="badge">{c.debate.list.length}</span>
      </div>
      <Duration id="ch-sp" label="Time per speech" value={c.speakSecs} min={5} max={3600}
        onChange={(secs, ok) => { if (ok && secs !== null) act((x) => ch.setSpeakSecs(x, secs)); }} />
      <form className={s.addRow} onSubmit={(e) => { e.preventDefault(); if (pick) { act((x) => ch.addToList(x, pick, side)); setWho(""); } }}>
        <label htmlFor="ch-add" className="sr-only">Add a state to the list</label>
        <select id="ch-add" className={`control ${s.addWho}`} value={pick} onChange={(e) => setWho(e.target.value)}>
          <option value="">{options.length ? "Add a state…" : "No one else can join this side"}</option>
          {options.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <SideSwitch side={side} setSide={setSide} />
        <button type="submit" className="button secondary" disabled={!pick}>Add</button>
      </form>
      <div className={s.sides}>
        {(["for", "against"] as const).map((k) => (
          <div key={k} className={s.sideCol}>
            <div className={s.sideHead}><span className={s.chip} data-side={k}>{SIDE[k]}</span><span className="muted">{col(k).length}</span></div>
            {col(k).length ? (
              <ol className={s.queue}>
                {col(k).map((x) => (
                  <li key={x.id} data-next={next?.id === x.id}>
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

const STATUS: Record<ch.Amendment["status"], string> = { waiting: "Waiting", entertained: "Being considered", passed: "Passed", failed: "Failed", withdrawn: "Withdrawn", invalid: "Ruled invalid" };

/* Amendments, set out like the speakers' list: the ones waiting in the order they will be taken. */
function Amendments({ c, act }: { c: Chamber; act: Act }) {
  const [by, setBy] = useState("");
  const [clause, setClause] = useState("");
  const [text, setText] = useState("");
  const [backers, setBackers] = useState<string[]>([]);
  const waiting = ch.waitingAmendments(c);
  const live = c.amendments.find((a) => a.id === c.amend?.id);
  const done = c.amendments.filter((a) => a.status !== "waiting" && a.status !== "entertained");
  const name = (id: string) => ch.nameOf(c, id);
  const ready = !!by && text.trim().length > 0;
  const canEntertain = c.step === "floor" && !c.speech && !c.amend;

  return (
    <section className={`panel ${s.list}`} aria-labelledby="ch-am">
      <div className={s.head}>
        <h2 id="ch-am" className={s.h2}>Amendments</h2>
        <span className="badge">{waiting.length}</span>
      </div>
      <form className={s.panelBody} onSubmit={(e) => { e.preventDefault(); if (!ready) return; act((x) => ch.submitAmendment(x, uid(), by, clause, text, backers)); setText(""); setClause(""); setBackers([]); }}>
        <div className={s.two}>
          <div className="field">
            <label htmlFor="am-by" className="sr-only">Amendment from</label>
            <select id="am-by" className="control" value={by} onChange={(e) => { setBy(e.target.value); setBackers((b) => b.filter((x) => x !== e.target.value)); }}>
              <option value="">From which state?</option>
              {c.delegates.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="am-cl" className="sr-only">Clause</label>
            <input id="am-cl" className="control" value={clause} onChange={(e) => setClause(e.target.value)} placeholder="Operative clause 2" maxLength={40} />
          </div>
        </div>
        <div className="field">
          <label htmlFor="am-tx" className="sr-only">What it changes</label>
          <textarea id="am-tx" className="control" rows={2} value={text} onChange={(e) => setText(e.target.value)} maxLength={600} placeholder="What the amendment changes. The preamble can't be amended." />
        </div>
        <details>
          <summary className={s.hint}>Co-sponsors{backers.length ? ` (${backers.length})` : ""}</summary>
          <div className={s.backers} style={{ marginTop: 8 }}>
            {c.delegates.filter((d) => d.id !== by).map((d) => (
              <label key={d.id} className={s.check}>
                <input type="checkbox" checked={backers.includes(d.id)} onChange={(e) => setBackers((b) => (e.target.checked ? [...b, d.id] : b.filter((x) => x !== d.id)))} />
                {d.name}
              </label>
            ))}
          </div>
        </details>
        <button type="submit" className="button secondary block" disabled={!ready}>Add amendment</button>
      </form>

      {(live || waiting.length > 0) ? (
        <ol className={s.queue}>
          {live && (
            <li data-next="true" className={s.amRow}>
              <span className={s.amMain}>
                <span className={s.qname}>{name(live.by)}{live.clause && ` · ${live.clause}`}</span>
                <span className={s.amText}>{live.text}</span>
                <span className={s.qtag}>Being considered{live.backers.length > 0 && ` · co-sponsors: ${live.backers.map(name).join(", ")}`}</span>
              </span>
            </li>
          )}
          {waiting.map((a, i) => (
            <li key={a.id} className={s.amRow} data-next={!live && i === 0}>
              <span className={s.amMain}>
                <span className={s.qname}>{name(a.by)}{a.clause && ` · ${a.clause}`}</span>
                <span className={s.amText}>{a.text}</span>
                <span className="muted" style={{ fontSize: 12.5 }}>{a.backers.length} co-sponsor{a.backers.length === 1 ? "" : "s"}{a.backers.length > 0 && `: ${a.backers.map(name).join(", ")}`}</span>
              </span>
              <span className={s.rowBtns}>
                <button type="button" className="button secondary sm" disabled={!canEntertain} onClick={() => act((x) => ch.entertain(x, a.id))}>Entertain</button>
                <IconButton label={`Rule ${name(a.by)}'s amendment invalid`} icon={ICONS.hide} onClick={() => act((x) => ch.invalidAmendment(x, a.id))} />
                <IconButton label={`Withdraw ${name(a.by)}'s amendment`} icon={ICONS.close} onClick={() => act((x) => ch.withdrawAmendment(x, a.id))} />
              </span>
            </li>
          ))}
        </ol>
      ) : <p className={s.empty}>No amendments waiting.</p>}
      {!canEntertain && waiting.length > 0 && !live && <p className={s.hint}>Amendments are taken between speeches, once the caucus is over.</p>}

      {done.length > 0 && (
        <ul className={s.states}>
          {done.map((a) => <li key={a.id}><span>{name(a.by)}{a.clause && ` · ${a.clause}`}</span><span className={s.chip} data-tone={a.status === "passed" ? "ok" : a.status === "failed" || a.status === "invalid" ? "bad" : undefined}>{STATUS[a.status]}</span></li>)}
        </ul>
      )}
    </section>
  );
}

/* The vote on the resolution, state by state. */
function RollCall({ c, act }: { c: Chamber; act: Act }) {
  const n = ch.count(c);
  const need = ch.needed(c.delegates.length);
  const closed = c.step === "closed";
  return (
    <section className={`panel ${s.side}`}>
      <div className={s.head}>
        <h2 className={s.h2}>Roll call vote</h2>
        <span className="badge">{c.delegates.length - n.left} of {c.delegates.length}</span>
      </div>
      {closed && c.outcome && (
        <p className={s.banner} data-pass={c.outcome.passed}>
          <strong>{c.outcome.passed ? "Approved" : "Not approved"}</strong>
          {c.outcome.yes} for, {c.outcome.no} against, {c.outcome.abstain} abstaining.
          {!c.outcome.passed ? ` ${c.outcome.needed} votes in favour were needed.` : ""}
        </p>
      )}
      <div className={s.tally}>
        <span className={s.chip} data-side="for">For {n.yes}</span>
        <span className={s.chip} data-side="against">Against {n.no}</span>
        <span className={s.chip}>Abstain {n.abstain}</span>
      </div>
      <p className={s.hint}>Needs at least {need} in favour, which is three-fifths of all {c.delegates.length} states, whoever is present. An abstention counts as neither for nor against.</p>
      <ul className={s.ballots}>
        {c.delegates.map((d) => (
          <li key={d.id} className={s.ballot}>
            <span className={s.cname2}>{d.name}</span>
            <div className={s.vote3} role="group" aria-label={`Vote of ${d.name}`}>
              {([["for", "For"], ["against", "Against"], ["abstain", "Abstain"]] as const).map(([b, label]) => (
                <button key={b} type="button" data-b={b} aria-pressed={c.ballots[d.id] === b} disabled={closed}
                  onClick={() => act((x) => ch.cast(x, d.id, c.ballots[d.id] === b ? null : (b as Ballot)))}>{label}</button>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </section>
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
  const [resolution, setResolution] = useState("");
  const [speak, setSpeak] = useState<number | null>(120);
  const [speakOk, setSpeakOk] = useState(true);
  const [text, setText] = useState("");
  const [mine, setMine] = useState<Mine[]>([]);
  const names = ch.parseNames(text);
  const ok = name.trim().length >= 2 && resolution.trim().length >= 2 && speakOk && speak !== null && names.length > 0;

  useEffect(() => {
    if (!signedIn || !supabase) return;
    let live = true;
    supabase.rpc("my_chambers").then(({ data }) => { if (live) setMine((data as Mine[] | null) ?? []); });
    return () => { live = false; };
  }, [signedIn]);

  return (
    <main id="top" className={`container ${s.setup}`}>
      <PageBand title="Chambers" lead="Run a Security Council debate under the Evatt rules: roll call, speeches, amendments and the vote, with a display for the projector." />
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
        <form className={`panel ${s.setupCard}`} onSubmit={(e) => { e.preventDefault(); if (ok && speak !== null) onCreate(ch.create(name, resolution, speak, names, names.map(uid))); }}>
          <fieldset className={s.procedure}>
            <legend>Procedure</legend>
            <div role="radiogroup" aria-label="Procedure">
              <button type="button" role="radio" aria-checked="true" className={s.proc}>
                <span className={s.procMark}>{ICONS.check}</span>
                <span className={s.procText}>
                  <strong>Evatt</strong>
                  <small>UN Youth Australia&apos;s Security Council debate: an opening, a debate on amendments, and a closing with a roll-call vote.</small>
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
            <label htmlFor="cs-res">Resolution</label>
            <input id="cs-res" className="control" value={resolution} onChange={(e) => setResolution(e.target.value)} maxLength={160} required />
          </div>
          <div className="field">
            <label htmlFor="cs-names">Member states</label>
            <textarea id="cs-names" className="control" value={text} onChange={(e) => setText(e.target.value)} rows={8} placeholder="One per line, or separated by commas" />
            {names.length > 0 && <small>{names.length} {names.length === 1 ? "state" : "states"}</small>}
          </div>
          <button type="submit" className="button lg block" disabled={!ok}>Open Committee</button>
          <p className={`${s.keys} muted`}>It is saved in this browser until you share it with other chairs.</p>
        </form>
      </div>
    </main>
  );
}
