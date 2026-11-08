"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import * as ch from "@/lib/chamber";
import type { Ballot, Chamber, Side } from "@/lib/chamber";
import { backgroundData, dataToBlob, uploadBackground, uploadBackgroundBlob } from "@/lib/photo";
import { supabase } from "@/lib/supabase";
import { isId, useChamber } from "@/lib/useChamber";
import { useAuth } from "./AuthProvider";
import { usePill } from "./usePill";
import IconButton, { ConfirmIconButton, ICONS } from "./IconButton";
import PageBand from "./PageBand";
import PanelTabs from "./PanelTabs";
import { useToast } from "./useToast";
import s from "./Chambers.module.css";
import Select from "./Select";

const svg = (d: React.ReactNode) => <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>;
const MONITOR = svg(<><rect x="1.8" y="2.5" width="12.4" height="8.5" rx="1.6" /><path d="M5.5 13.5h5M8 11v2.5" /></>);
const SLIDERS = svg(<><path d="M2.5 4.5h6.5M12 4.5h1.5M2.5 11.5h1.5M7 11.5h6.5" /><circle cx="10.5" cy="4.5" r="1.6" /><circle cx="5.5" cy="11.5" r="1.6" /></>);
const COPY = svg(<><rect x="5.5" y="5.5" width="8" height="8" rx="1.6" /><path d="M10.5 3.5V3a1 1 0 00-1-1H3.5a1 1 0 00-1 1v6a1 1 0 001 1H4" /></>);
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
  const [view, setView] = useState<"manage" | "analytics" | "settings">("manage");
  const { say, node } = useToast();

  const clockRun = ch.running(c?.tr?.cauc?.clock ?? null);
  const now = useNow(ch.running(c?.timer ?? null) || clockRun || (!!c?.tr && Object.keys(c.tr.observers).length > 0));
  const left = c?.timer ? ch.remaining(c.timer, now) : 0;
  const state = !c?.timer ? "none" : left === 0 ? "up" : c.timer.endsAt !== null ? "running" : "paused";

  // A timer that reaches zero stops there, so the saved copy (and the display) agree it is over.
  useEffect(() => {
    if (state !== "up" || !c?.timer || c.timer.endsAt === null) return;
    act((x) => ch.pauseTimer(x, ch.now()));
    setLive("Time's up");
  }, [state, c?.timer, act]);
  // The same for the clock of a whole moderated caucus.
  const cauc = c?.tr?.cauc?.clock ?? null;
  const caucUp = !!cauc && cauc.endsAt !== null && ch.remaining(cauc, now) === 0;
  useEffect(() => {
    if (!caucUp) return;
    act((x) => ch.pauseCauc(x, ch.now()));
    setLive("The caucus is over");
  }, [caucUp, act]);

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
    if (c?.tr && !c.speech && ch.listOpen(c)) {
      if (c.step === "amend" && !c.debate.run.length) { act((x) => ch.callAmender(x)); return; }
      const n = ch.nextCandidate(c);
      if (n) act((x) => ch.callSpeaker(x, n.id, n.side));
      return;
    }
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
  const t = c.tr;
  const trWork = !!t && c.step !== "welcome" && c.step !== "roll" && c.step !== "ended"; // the motions, documents and chair's tools
  const amendOpen = t ? !!t.current && (c.step === "floor" || c.step === "amend" || (c.step === "caucus" && (c.after === "floor" || c.after === "amend"))) : inDebate;

  return (
    <main id="top" className={`container ${s.page}`}>
      <header className={s.top}>
        <div className={s.nameBox}>
        <h1 className={`serif ${s.name}`}>{c.name}{c.topic && ` · ${c.topic}`}</h1>
        {t && <p className={s.procTag}><span className="badge">Trinity Grammar MUN</span><span className="badge">{t.level === "beginner" ? "Beginner committee" : "Experienced committee"}</span><span className="badge">Week {t.week}</span></p>}
        </div>
        <div className={s.topActions}>
          <a className={`button secondary ${s.topBtn}`} href={display} target="_blank" rel="noopener">{MONITOR}Open display</a>
          <button type="button" className={`button secondary ${s.topBtn}`} onClick={() => setView("settings")}>
            {cloudId ? <i className={s.live} data-off={status === "offline"} aria-hidden="true" /> : SLIDERS}
            Settings{status === "offline" && <span className="sr-only"> (offline, trying again)</span>}
          </button>
          <ConfirmIconButton label={cloudId && !owner ? "Leave this committee" : cloudId ? "Delete this committee" : "Close this committee"}
            confirm="Click again to confirm" icon={cloudId && !owner ? ICONS.leave : ICONS.trash} onConfirm={() => void remove()} />
        </div>
      </header>
      {status === "offline" && <p className={s.result} data-pass="false" role="alert">Offline: your changes are kept here and will be sent when the connection is back.</p>}

      <div className="sr-only" role="status" aria-live="polite">{live}</div>

      <PanelTabs idPrefix="chv" label="Committee" tab={view} setTab={setView}
        tabs={[{ id: "manage", label: "Manage", icon: ICONS.manage }, { id: "analytics", label: "Analytics", icon: ICONS.chart }, { id: "settings", label: "Settings", icon: SLIDERS }]} />

      {view === "manage" ? (
        <div id="chv-panel-manage" role="tabpanel" aria-labelledby="chv-tab-manage" className={s.manage}>
          <Rail c={c} />
          {c.step === "welcome" ? <Welcome c={c} act={act} />
            : c.step === "roll" ? <RollCallOpen c={c} act={act} />
            : c.step === "pick" ? (t ? <TrinityPick c={c} act={act} /> : <Pick c={c} act={act} />)
            : <Floor c={c} act={act} left={left} now={now} state={state} toggle={toggle} />}
          {(t ? ch.listOpen(c) : inDebate && ch.listOpen(c)) && <Lists c={c} act={act} wide />}
          {amendOpen && <div className={s.pair}><AmendmentForm c={c} act={act} /><AmendmentQueue c={c} act={act} /></div>}
          {(c.step === "vote" || c.step === "closed" || c.step === "ended") && <RollCall c={c} act={act} />}
          {trWork && <Motions c={c} act={act} />}
          {trWork && <Documents c={c} act={act} />}
          {trWork && <ChairTools c={c} act={act} now={now} />}
        </div>
      ) : view === "analytics" ? (
        <Analytics c={c} say={say} />
      ) : (
        <div id="chv-panel-settings" role="tabpanel" aria-labelledby="chv-tab-settings" className={s.manage}>
          <Background c={c} act={act} say={say} userId={session?.user.id} />
          <Share c={c} cloudId={cloudId} owner={owner} signedIn={!!session} meId={session?.user.id} say={say} setLocal={setLocal} />
        </div>
      )}
      {node}
    </main>
  );
}

/* The three parts of the debate, and the step inside the one we're in. */
function Rail({ c }: { c: Chamber }) {
  const idx = ch.stageIndex(c);
  return (
    <ol className={s.rail} aria-label="Where the council is" data-n={ch.stagesOf(c).length} style={{ "--n": ch.stagesOf(c).length } as React.CSSProperties}>
      {ch.stagesOf(c).map((label, i) => (
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
      <h2 className={`serif ${s.welcomeTitle}`}>Welcome to {c.name}</h2>
      {c.topic ? (
        <div className={s.resBox}>
          <span className={s.tag}>{c.tr ? "Topic" : "Resolution"}</span>
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
const ATTEND_TRINITY: ch.Attend[] = ["present", "voting"];
function RollCallOpen({ c, act }: { c: Chamber; act: Act }) {
  const n = ch.rollCount(c);
  return (
    <section className={`panel ${s.opening}`} aria-labelledby="rc-h">
      <div className={s.head}>
        <h2 id="rc-h" className={`serif ${s.who}`}>Roll call{c.tr ? ` \u00B7 Week ${c.tr.week}` : ""}</h2>
      </div>
      <Stats label="Roll call so far" bar items={[
        { label: "Present & Voting", value: n.voting, tone: "ok" },
        { label: "Present", value: n.present },
        ...(c.tr ? [] : [{ label: "Abstain", value: n.abstain, tone: "warn" as const }]),
        { label: "Not marked yet", value: n.unmarked },
      ]} />
      <div className={s.btnRow}>
        <button type="button" className="button secondary" onClick={() => act((x) => ch.markAllRoll(x, "present"))}>Everyone Present</button>
        <button type="button" className="button secondary" onClick={() => act((x) => ch.markAllRoll(x, "voting"))}>Everyone Present & Voting</button>
      </div>
      <ul className={s.ballots}>
        {c.delegates.map((d) => (
          <li key={d.id} className={s.ballot}>
            <span className={s.cname2}>{d.name}</span>
            <Seg label={`Roll call: ${d.name}`} value={c.roll[d.id]} className={`${s.ballotSeg} ${s.rollSeg}`}
              items={(c.tr ? ATTEND_TRINITY : ATTEND).map((a) => ({ id: a, label: ch.ATTEND_LABEL[a] }))}
              onPick={(a) => act((x) => ch.markRoll(x, d.id, c.roll[d.id] === a ? null : a))} />
          </li>
        ))}
      </ul>
      <button type="button" className="button lg block" onClick={() => act(ch.beginDebate)}>Begin Debate</button>
    </section>
  );
}

/* Opening, 3: the chair chooses the Proposer, Seconder and Opposer. Each choice is saved as it is made, so the display shows it at once. */
const PICK = [["proposer", "Proposer"], ["seconder", "Seconder"], ["opposer", "Opposer (optional)"]] as const;
function Pick({ c, act }: { c: Chamber; act: Act }) {
  const here = c.delegates.filter((d) => c.roll[d.id]);
  const pool = here.length ? here : c.delegates;
  const ok = !!(c.roles.proposer && c.roles.seconder); // nobody has to oppose
  return (
    <form className={`panel ${s.opening}`} onSubmit={(e) => { e.preventDefault(); if (ok) act(ch.startSpeeches); }}>
      <div className={s.head}>
        <h2 className={`serif ${s.who}`}>Choose the speakers</h2>
      </div>
      <div className={s.three}>
        {PICK.map(([role, label]) => {
          const taken = PICK.filter(([k]) => k !== role).map(([k]) => c.roles[k]);
          return (
            <div key={role} className="field">
              <label htmlFor={`pk-${role}`}>{label}</label>
              <Select id={`pk-${role}`} className="control" value={c.roles[role] ?? ""} onChange={(e) => act((x) => ch.pickRole(x, role, e.target.value || null))}>
                <option value="">{role === "opposer" ? "No opposer" : "Choose a state"}</option>
                {pool.filter((d) => !taken.includes(d.id)).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </Select>
            </div>
          );
        })}
      </div>
      <button type="submit" className="button lg block" disabled={!ok}>Start the speeches</button>
    </form>
  );
}

/* The floor: who has it, the time, and the one thing the chair does next. */
function Floor({ c, act, left, now, state, toggle }: { c: Chamber; act: Act; left: number; now: number; state: string; toggle: () => void }) {
  const sp = c.speech;
  const name = (id: string | null) => ch.nameOf(c, id);
  const [asker, setAsker] = useState("");
  const [callSecs, setCallSecs] = useState<number | null>(null);
  const [nextRes, setNextRes] = useState("");
  const [anyWho, setAnyWho] = useState("");
  const [anySide, setAnySide] = useState<Side>("for");
  const [anyOpen, setAnyOpen] = useState(false);
  // The time the chair allots is for one speech: the next one starts from the default again.
  useEffect(() => { setCallSecs(null); }, [c.speakSecs, c.debate.run.length]);
  const secs = callSecs ?? c.speakSecs;
  const next = ch.nextCandidate(c);
  const aid = c.amend?.id ?? "";
  const amendment = c.amend ? c.amendments.find((a) => a.id === c.amend!.id) : undefined;
  const debateOpen = c.step === "amend" && c.amend?.stage === "debate";
  const waiting = ch.waitingAmendments(c);
  const pct = c.timer ? Math.min(100, (left / c.timer.total) * 100) : 0;
  const askers = sp ? c.delegates.filter((d) => d.id !== sp.who) : [];
  const askerId = asker && askers.some((d) => d.id === asker) ? asker : "";
  const spokeFromList = c.debate.run.length > 1;
  const timeField = <Duration id="fl-secs" label="Time for this speech" value={c.speakSecs} min={5} max={3600} onChange={(v, ok) => setCallSecs(ok ? v : null)} />;
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
  const [confirmWeek, setConfirmWeek] = useState(false);
  const stNext = ch.nextStatement(c);
  const perField = k && modLike ? <Duration id="fl-per" label="Time per speaker" value={k.per} min={5} max={Math.max(5, k.total - 1)} onChange={(v, ok) => { if (ok && v !== null) act((x) => ch.setPer(x, v)); }} /> : null;
  const poll = c.poll;
  // Extending a caucus once its time has run out: at most twice, by no more than the caucus first was.
  const extend = k && k.ext < 2 && k.kind !== "prep" && k.kind !== "final" && (k.clock ? kUp : state === "up") && !sp ? (
    <div className={s.anyBox}>
      <Duration id="fl-ext" label={`Extend the caucus (${k.ext} of 2 used)`} value={Math.min(k.total, 120)} min={10} max={k.total} onChange={(v, ok) => setExtSecs(ok ? v : null)} />
      <button type="button" className="button secondary sm" disabled={extSecs === null} onClick={() => act((x) => ch.extendCaucus(x, extSecs ?? 0, ch.now()))}>Extend</button>
    </div>
  ) : null;

  const timerBtn = (cls = "button") => state === "up"
    ? <button type="button" className={cls} onClick={() => act(ch.resetTimer)}>Reset time</button>
    : <button type="button" className={cls} onClick={toggle} disabled={state === "none"}>{state === "running" ? "Pause" : "Start"} timer</button>;
  const sm = "button secondary sm";

  // What the floor is showing: a name or title, and a line under it.
  let title: React.ReactNode = "";
  let sub: React.ReactNode = "";
  if (sp) {
    if (sp.phase === "ask") { title = name(sp.asker); sub = `Point of Information for ${name(sp.who)}`; }
    else { title = name(sp.who); sub = sp.phase === "speech" ? "Speaking" : sp.phase === "after" ? "" : "Replying to the Point of Information"; }
  }
  else if (poll?.kind === "motion") { title = "Motion"; sub = poll.title; }
  else if (t && c.step === "statements") { title = stNext ? name(stNext) : "Opening statements"; sub = stNext ? "Next opening statement, up to 2 minutes" : "Every state has given its statement"; }
  else if (t && c.step === "general") { title = next ? name(next.id) : "General speakers\u2019 list"; sub = next ? "Next on the general speakers\u2019 list" : "Add states to the speakers\u2019 list"; }
  else if (c.step === "proposer") { title = name(c.roles.proposer); sub = t ? "Introduces the draft resolution" : "Proposes the resolution"; }
  else if (c.step === "seconder") { title = name(c.roles.seconder); sub = t ? "Speaks as co-proposer" : "Seconds the resolution"; }
  else if (c.step === "opposer") { title = name(c.roles.opposer); sub = t ? "Speaks against the draft resolution" : "Speaks against the resolution"; }
  else if (c.step === "caucus") { title = k?.kind === "mod" ? "Moderated caucus" : k?.kind === "papers" ? "Working papers" : k?.kind === "prep" ? "Preparation" : k?.kind === "final" ? "Final unmoderated caucus" : t ? "Unmoderated caucus" : "Caucus"; sub = k?.kind === "mod" ? k.topic : ""; }
  else if (c.step === "floor") { title = t ? "Draft resolution debate" : "Amendments"; sub = t ? ch.currentDoc(c)?.title ?? "" : ""; }
  else if (c.step === "closing") { title = t ? "Closing" : "Closing speeches"; sub = t && !c.closers.length ? "Final caucus, then the closing speeches" : ""; }
  else if (c.step === "vote") { title = "Roll call vote"; }
  else if (c.step === "ended") { title = "Committee ended"; sub = "The analytics are still here."; }
  else if (c.step === "closed") { title = c.outcome?.passed ? (t ? "Draft resolution approved" : "Resolution approved") : c.outcome?.vetoed ? "Vetoed" : (t ? "Draft resolution not approved" : "Resolution not approved"); sub = c.outcome ? `${c.outcome.yes} for, ${c.outcome.no} against, ${c.outcome.abstain} abstaining${c.outcome.vetoed ? `, vetoed by ${c.outcome.vetoed.join(" and ")}` : ""}` : ""; }
  else if (c.step === "amend" && c.amend?.stage === "read") { title = `Amendment from ${name(amendment?.by ?? null)}`; sub = amendment?.clause || "Read it to the council"; }
  else if (c.step === "amend" && c.amend?.stage === "ask") { title = "Debate this amendment?"; }
  else if (c.step === "amend" && c.amend?.stage === "vote") { title = "Adopt this amendment?"; }
  else if (debateOpen) {
    if (!c.debate.run.length) { title = name(amendment?.by ?? null); sub = "Speaks first on their amendment"; }
    else if (next) { title = name(next.id); sub = "Next on the speakers' list"; }
    else { title = "The speakers' list is empty"; sub = spokeFromList ? "Everyone listed has spoken. Vote on the amendment." : "Add states to the speakers' list, For or Against"; }
  }

  const sideless = !!t && sp && !ch.sided(c) && (sp.role === "speaker" || sp.role === "statement"); // a general speaker or a statement takes no side
  const chipSide: Side | null = sp ? (sideless ? null : sp.side) : debateOpen && !sp && c.debate.run.length && next ? next.side : null;

  const actions = (() => {
    if (sp) {
      if (sp.phase === "speech") return (
        <>
          {timerBtn("button")}
          <button type="button" className="button secondary" onClick={() => act((x) => ch.endSpeech(x, ch.now(), sp.who))}>End speech</button>
        </>
      );
      if (sp.phase === "after") return (
        <>
          <div className="field">
            <label htmlFor="fl-ask">Who asks the Point of Information?</label>
            <Select id="fl-ask" className="control" value={askerId} onChange={(e) => setAsker(e.target.value)}>
              <option value="">Choose a state</option>
              {askers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </Select>
          </div>
          {t?.level === "experienced" && sp.role === "statement" && <p className={s.hint}>Recommended: two Points of Information. {sp.pois} taken.</p>}
          <button type="button" className="button" disabled={!askerId} onClick={() => act((x) => ch.askPoi(x, askerId, sp.who, sp.pois))}>Take a Point of Information</button>
          <button type="button" className="button secondary" onClick={() => act((x) => ch.yieldToChair(x, sp.who, sp.pois))}>Yield to the chair</button>
          {t && (sp.role === "speaker" || sp.role === "amender") && (
            <div className={s.anyBox}>
              <label htmlFor="fl-yto" className="sr-only">Yield to another country</label>
              <div className={s.pickRow}>
                <Select id="fl-yto" className="control" value={yTo} onChange={(e) => setYTo(e.target.value)}>
                  <option value="">Yield to another country{sp.left ? ` (adds ${ch.clock(sp.left * 1000)})` : ""}</option>
                  {c.delegates.filter((d) => d.id !== sp.who && !ch.observing(c, d.id)).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </Select>
                <button type="button" className="button secondary sm" disabled={!yTo} onClick={() => { act((x) => ch.yieldToCountry(x, sp.who, sp.pois, yTo)); setYTo(""); }}>Yield</button>
              </div>
            </div>
          )}
          {sp.pois === 0 && c.timer && <button type="button" className={sm} onClick={() => act((x) => ch.backPhase(x, sp.who, sp.pois))}>Back to the speech</button>}
        </>
      );
      if (sp.phase === "ask") return (
        <>
          {timerBtn("button")}
          <button type="button" className="button secondary" onClick={() => act((x) => ch.answerPoi(x, sp.who, sp.asker ?? "", sp.pois, ch.now()))}>Now {name(sp.who)} replies</button>
          <button type="button" className={sm} onClick={() => act((x) => ch.backPhase(x, sp.who, sp.pois))}>Cancel the question</button>
        </>
      );
      return (
        <>
          {timerBtn("button")}
          <button type="button" className="button secondary" onClick={() => act((x) => ch.donePoi(x, sp.who, sp.asker ?? "", sp.pois, ch.now()))}>Reply finished</button>
          <button type="button" className={sm} onClick={() => act((x) => ch.backPhase(x, sp.who, sp.pois))}>Back to the question</button>
        </>
      );
    }
    if (poll?.kind === "motion") return <PollBox c={c} act={act} />;
    switch (c.step) {
      case "statements": return (
        <>
          {stNext && <button type="button" className="button" onClick={() => act((x) => ch.callStatement(x, stNext))}>Call {name(stNext)}</button>}
          {stNext && (
            <div className={s.anyBox}>
              <div className={s.pickRow}>
                <label htmlFor="fl-st" className="sr-only">Call another state</label>
                <Select id="fl-st" className="control" value={stWho} onChange={(e) => setStWho(e.target.value)}>
                  <option value="">Call another state first</option>
                  {c.delegates.filter((d) => !t!.opened.includes(d.id) && !ch.observing(c, d.id)).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </Select>
                <button type="button" className="button secondary sm" disabled={!stWho} onClick={() => { act((x) => ch.callStatement(x, stWho)); setStWho(""); }}>Call</button>
              </div>
            </div>
          )}
          <button type="button" className={stNext ? "button secondary" : "button"} onClick={() => act(ch.endStatements)}>Finish the statements</button>
        </>
      );
      case "general": {
        const ready = t ? ch.drafts(c).find((d) => d.status === "approved" && !d.result) : undefined;
        const beginner = !!t && !ch.firstWeekSC(c); // a draft resolution is introduced from here, except in the first week of the experienced committee
        const modDone = !!t && t.motions.some((m) => m.kind === "mod" && m.status === "passed");
        return (
          <>
            {next && timeField}
            {next && <button type="button" className="button" onClick={() => act((x) => ch.callSpeaker(x, next.id, next.side, secs))}>Call {name(next.id)}</button>}
            {beginner && ready && <button type="button" className={next ? "button secondary" : "button"} onClick={() => act((x) => ch.introduceDraft(x, ready.id))}>Introduce {ready.title}</button>}
            {t?.level === "beginner" && t.week === 2 && ready && !ready.seen && <button type="button" className="button secondary sm" onClick={() => act(ch.startPrep)}>Preparation, 20 min</button>}
            {ch.firstWeekSC(c) && <button type="button" className="button secondary sm" onClick={() => act((x) => ch.startPapers(x))}>Start working papers, 30 min</button>}
            <div className={s.btnRow}>
              {stNext && t?.week === 1
                ? <button type="button" className={next || ready ? "button secondary sm" : "button"} onClick={() => act(ch.startStatements)}>Opening statements</button>
                : <button type="button" className={next || ready ? "button secondary sm" : "button"} onClick={() => window.dispatchEvent(new Event("chambers:motion"))}>{modDone ? "Start another moderated caucus" : "Start a moderated caucus"}</button>}
            </div>
            {t && t.week === 1 && (confirmWeek
              ? <div className={s.btnRow} role="group" aria-label="End week 1"><button type="button" className="button sm" onClick={() => act(ch.nextWeek)}>Start week 2</button><button type="button" className="button secondary sm" onClick={() => setConfirmWeek(false)}>Not yet</button></div>
              : <button type="button" className="button secondary sm" onClick={() => setConfirmWeek(true)}>End week 1</button>)}
          </>
        );
      }
      case "proposer": return (<><button type="button" className="button" onClick={() => act(ch.callProposer)}>Call {name(c.roles.proposer)} to propose</button></>);
      case "seconder": return (<><button type="button" className="button" onClick={() => act(ch.callSeconder)}>Call {name(c.roles.seconder)} to second</button></>);
      case "opposer": return (<><button type="button" className="button" onClick={() => act(ch.callOpposer)}>Call {name(c.roles.opposer)} to oppose</button></>);
      case "caucus":
        if (t && k?.kind === "mod") {
          const firstUp = ch.nextCandidate(c);
          return (
            <>
              {perField}
              {firstUp ? <button type="button" className="button" onClick={() => act((x) => ch.callSpeaker(x, firstUp.id, firstUp.side))}>Call {name(firstUp.id)}</button> : <p className={s.hint}>Add states to the speakers&apos; list as they raise their hands.</p>}
              {extend}
              <div className={s.btnRow}>
                <button type="button" className={ch.canCloseMod(c) ? "button secondary sm" : "button secondary sm"} onClick={() => act(ch.endCaucus)}>End Caucus</button>
              </div>
              <p className={s.hint}>{c.debate.run.length < 3 ? `A motion to close it can be heard after the last three speakers. ${c.debate.run.length} so far.` : "A motion to close it can be heard now."}</p>
            </>
          );
        }
        return (
          <>
            {t && k?.kind !== "unmod" && k?.kind !== "papers" ? null : c.timer && !ch.running(c.timer) && c.timer.left === c.timer.total && <Duration id="fl-cau" label="Caucus length" value={c.timer ? Math.round(c.timer.total / 1000) : ch.CAUCUS_SECS} min={5} max={t && k?.kind !== "papers" ? ch.TR.maxCaucus : 10800}
              onChange={(v, ok) => { if (ok && v !== null) act((x) => ch.setCaucusSecs(x, v)); }} />}
            {timerBtn("button")}
            {extend}
            <button type="button" className="button secondary" onClick={() => act(ch.endCaucus)}>End Caucus</button>
          </>
        );
      case "floor": return t ? (
        <>
          {waiting[0] && <button type="button" className="button" onClick={() => act((x) => ch.entertain(x, waiting[0].id))}>Entertain the next Amendment</button>}
          {next && timeField}
          {next && <button type="button" className={waiting[0] ? "button secondary" : "button"} onClick={() => act((x) => ch.callSpeaker(x, next.id, next.side, secs))}>Call {name(next.id)}</button>}
          <div className={s.btnRow}>
            <button type="button" className="button secondary sm" onClick={() => act((x) => ch.callCaucus(x, 300))}>Call a Caucus</button>
            <button type="button" className="button secondary sm" onClick={() => act(ch.closeDebate)}>Close the Debate</button>
          </div>
        </>
      ) : (
        <>
          {waiting[0]
            ? <button type="button" className="button" onClick={() => act((x) => ch.entertain(x, waiting[0].id))}>Entertain the next Amendment</button>
            : null}
          <button type="button" className={waiting[0] ? "button secondary" : "button"} onClick={() => act((x) => ch.callCaucus(x, 120))}>Call a Caucus</button>
          <button type="button" className="button secondary" onClick={() => act(ch.closeDebate)}>Close the Debate</button>
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
                  {done ? `${ch.roleName(c, r.role)} ${name(r.id)} has spoken` : `Call the ${ch.roleName(c, r.role)}: ${name(r.id)}`}
                </button>
              );
            })}
            {t && !t.finalDone && !c.closers.length && <button type="button" className="button secondary" onClick={() => act((x) => ch.callCaucus(x, ch.TR.final))}>Final unmoderated caucus, 4 min</button>}
            <button type="button" className={all ? "button" : "button secondary sm"} onClick={() => act(ch.startVote)}>Go to the vote</button>
          </>
        );
      }
      case "vote": return (
        <>
          <button type="button" className="button" disabled={ch.count(c).left > 0} onClick={() => act(ch.finishVote)}>Record the result</button>
          <p className={s.hint}>{ch.count(c).left ? `${ch.count(c).left} state${ch.count(c).left === 1 ? "" : "s"} still to vote.` : "Everyone has voted."}</p>
        </>
      );
      case "closed": return t ? (
        <>
          <button type="button" className="button" onClick={() => act(ch.backToGeneral)}>Back to the general debate</button>
          <button type="button" className="button secondary" onClick={() => act(ch.reopenVote)}>Reopen the vote</button>
          {t.week === 1 && (confirmWeek
            ? <div className={s.btnRow} role="group" aria-label="End week 1"><button type="button" className="button sm" onClick={() => act(ch.nextWeek)}>Start week 2</button><button type="button" className="button secondary sm" onClick={() => setConfirmWeek(false)}>Not yet</button></div>
            : <button type="button" className="button secondary" onClick={() => setConfirmWeek(true)}>End week 1</button>)}
          <button type="button" className="button secondary" onClick={() => act(ch.endCommittee)}>End the Committee</button>
        </>
      ) : (
        <>
          <form className={s.nextRes} onSubmit={(e) => { e.preventDefault(); act((x) => ch.newResolution(x, nextRes)); setNextRes(""); }}>
            <div className="field">
              <label htmlFor="fl-next">Next resolution</label>
              <input id="fl-next" className="control" value={nextRes} onChange={(e) => setNextRes(e.target.value)} maxLength={160} placeholder="The next resolution to debate" />
            </div>
            <button type="submit" className="button" disabled={!nextRes.trim()}>Start the next resolution</button>
          </form>
          <button type="button" className="button secondary" onClick={() => act(ch.reopenVote)}>Reopen the vote</button>
          <button type="button" className="button secondary" onClick={() => act(ch.endCommittee)}>End the Committee</button>
        </>
      );
      case "ended": return (
        <button type="button" className="button secondary" onClick={() => act(ch.reopenCommittee)}>Reopen the committee</button>
      );
      case "amend":
        if (c.amend?.stage === "read") return (
          <>
            <button type="button" className="button" onClick={() => act((x) => ch.amendAsk(x, aid))}>Vote on whether to debate it</button>
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
      return (
        <>
          {perField}
          {first
            ? <button type="button" className="button" onClick={() => act((x) => ch.callAmender(x))}>Call {name(amendment?.by ?? null)} to speak</button>
            : follow
              ? <button type="button" className="button" onClick={() => act((x) => ch.callSpeaker(x, follow.id, follow.side))}>Call {name(follow.id)}</button>
              : <p className={s.hint}>Add states to the speakers&apos; list as they raise their hands.</p>}
          {extend}
          <button type="button" className={first || follow ? "button secondary" : "button"} onClick={() => act((x) => ch.amendVote(x, aid))}>Vote on the amendment</button>
        </>
      );
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
            <button type="button" className={sm} onClick={() => act((x) => ch.callCaucus(x, 120))}>Call a Caucus</button>
          </div>
          {!first && (
            <>
              <button type="button" className={sm} aria-expanded={anyOpen} onClick={() => setAnyOpen((v) => !v)}>Call a State that isn&apos;t on the list</button>
              {anyOpen && (
                <div className={s.anyBox}>
                  <div className={s.pickRow}>
                    <label htmlFor="fl-any" className="sr-only">State</label>
                    <Select id="fl-any" className="control" value={anyWho} onChange={(e) => setAnyWho(e.target.value)}>
                      <option value="">Choose a state</option>
                      {c.delegates.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </Select>
                    <button type="button" className="button secondary sm" disabled={!anyWho} onClick={() => { act((x) => ch.callSpeaker(x, anyWho, anySide, secs)); setAnyOpen(false); setAnyWho(""); }}>Call</button>
                  </div>
                  <SideSwitch side={anySide} setSide={setAnySide} />
                </div>
              )}
            </>
          )}
        </>
      );
    }
    return null;
  })();

  return (
    <section className={`panel ${s.floor}`} aria-label="The floor" data-up={state === "up" || undefined}>
      <div className={s.floorMain}>
        {(sp || chipSide) && (
          <div className={s.chips}>
            {sp && <span className={s.chip} data-tone="accent">{ch.roleName(c, sp.role)}</span>}
            {chipSide && <span className={s.chip} data-side={chipSide}>{SIDE[chipSide]}</span>}
            {sp && sp.phase !== "speech" && <span className={s.chip}>Point of Information{sp.pois ? ` · ${sp.pois} taken` : ""}</span>}
          </div>
        )}
        <h2 className={`serif ${s.who}`}>{title}</h2>
        {sub && <p className={s.sub}>{sub}</p>}
        {t?.level === "beginner" && c.step === "general" && !sp && (
          <p className={s.sub}>Week {t.week}: {t.week === 1 ? "two seen draft resolutions" : "one seen and one unseen draft resolution"} · {t.docs.filter((d) => d.kind === "draft" && d.week === t.week && d.result).length} of 2 debated</p>
        )}
        {amendment && c.step === "amend" && <p className={s.sub}>{amendment.text}</p>}
        {c.result && !c.poll && <p className={s.result} data-pass={c.result.passed}><strong>{c.result.passed ? "Passed" : "Failed"}:</strong> {c.result.yes} For, {c.result.no} Against, {c.result.abstain} Abstaining</p>}
        {c.timer && c.step !== "closed" && c.step !== "ended" && <div className={s.time} data-state={state} role="timer">{ch.clock(left)}</div>}
        {k?.clock && (
          <div className={s.caucClock} data-state={kUp ? "up" : kRun ? "running" : "paused"}>
            <span>Whole caucus</span>
            <b className="num" role="timer">{ch.clock(kLeft)}</b>
            <button type="button" className="button secondary sm" onClick={() => act((x) => (ch.running(x.tr?.cauc?.clock ?? null) ? ch.pauseCauc(x, ch.now()) : ch.startCauc(x, ch.now())))} disabled={kUp}>{kRun ? "Pause" : "Start"}</button>
          </div>
        )}
      </div>
      <div className={s.actions}>{actions}</div>
      {c.timer && c.step !== "closed" && c.step !== "ended" && <div className={s.track} aria-hidden="true"><i style={{ width: `${pct}%` }} /></div>}
      {c.timer && (
        <div className={s.floorFoot}>
          <div className={s.nudges}>
            {!sp && c.step !== "caucus" && timerBtn("button secondary")}
            <button type="button" className="button secondary" onClick={() => act((x) => ch.nudgeTimer(x, -15, ch.now()))} aria-label="Take 15 seconds off">−15s</button>
            <button type="button" className="button secondary" onClick={() => act((x) => ch.nudgeTimer(x, 15, ch.now()))} aria-label="Add 15 seconds">+15s</button>
            <button type="button" className="button secondary" onClick={() => act(ch.resetTimer)}>Reset</button>
          </div>
        </div>
      )}
    </section>
  );
}

// Two or three choices in one pill, with a highlight that slides to the one picked like every other tab control on the site.
function Seg<T extends string>({ items, value, onPick, label, className, disabled }: {
  items: { id: T; label: string; off?: boolean }[]; value: T | null | undefined; onPick: (id: T) => void; label: string; className?: string; disabled?: boolean;
}) {
  const box = useRef<HTMLDivElement>(null);
  const pill = usePill(box, '[aria-pressed="true"]', value ?? "");
  return (
    <div ref={box} className={`${s.seg3} ${className ?? ""}`} role="group" aria-label={label}>
      <span ref={pill} className={`t-pill ${s.segPill}`} aria-hidden="true" />
      {items.map((i) => <button key={i.id} type="button" data-v={i.id} aria-pressed={value === i.id} disabled={disabled || i.off} onClick={() => onPick(i.id)}>{i.label}</button>)}
    </div>
  );
}

function SideSwitch({ side, setSide }: { side: Side; setSide: (s: Side) => void }) {
  return <Seg label="Side" value={side} onPick={setSide} className={s.sideSeg} items={[{ id: "for", label: SIDE.for }, { id: "against", label: SIDE.against }]} />;
}

// A vote by placard: counts for, against and abstaining. More for than against passes; the President may overrule it.
function PollBox({ c, act }: { c: Chamber; act: Act }) {
  const [overrule, setOverrule] = useState(false);
  const p = c.poll;
  if (!p) return null;
  const would = ch.passes(p);
  const cast = p.yes + p.no + p.abstain;
  const id = p.kind === "motion" ? p.motion ?? "" : c.amend?.id ?? "";
  const decide = p.kind === "motion" ? ch.decideMotion : p.kind === "debate" ? ch.decideAsk : ch.decideAmendment;
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
      {cast > 0 && <p className={s.verdict}><strong data-pass={would}>{would ? "Would pass" : "Would fail"}</strong></p>}
      <button type="button" className="button" onClick={() => act((x) => decide(x, null, id))}>Record the result</button>
      {overrule ? (
        <div className={s.btnRow} role="group" aria-label="Overrule the count">
          <button type="button" className="button secondary sm" onClick={() => act((x) => decide(x, "for", id))}>For</button>
          <button type="button" className="button secondary sm" onClick={() => act((x) => decide(x, "against", id))}>Against</button>
        </div>
      ) : (
        <button type="button" className="button secondary sm" onClick={() => setOverrule(true)}>Overrule</button>
      )}
    </>
  );
}

/* Figures, the same everywhere: a big number over its label, and a bar of how they split. */
type Stat = { label: string; value: number; tone?: "ok" | "bad" | "warn" };
function Stats({ items, bar, label }: { items: Stat[]; bar?: boolean; label: string }) {
  const total = items.reduce((n, i) => n + i.value, 0);
  return (
    <div className={s.statsBox}>
      <ul className={s.stats} aria-label={label}>
        {items.map((i) => <li key={i.label} className={s.stat} data-tone={i.tone}><b className="num">{i.value}</b><span>{i.label}</span></li>)}
      </ul>
      {bar && total > 0 && <div className={s.statBar} aria-hidden="true">{items.filter((i) => i.value > 0).map((i) => <i key={i.label} data-tone={i.tone} style={{ flex: i.value }} />)}</div>}
    </div>
  );
}

/* The speakers' list for the amendment in hand: For and Against, in the order they will be called. */
function Lists({ c, act, wide }: { c: Chamber; act: Act; wide?: boolean }) {
  const [who, setWho] = useState("");
  const [side, setSide] = useState<Side>("for");
  const next = ch.nextCandidate(c);
  const options = c.delegates.filter((d) => ch.canAdd(c, d.id, side));
  const pick = options.some((d) => d.id === who) ? who : "";
  const col = (k: Side) => c.debate.list.filter((x) => x.side === k);
  const spoken = c.debate.run.map((x) => ch.nameOf(c, x.id));
  const plain = !ch.sided(c); // the general list and a moderated caucus are one list of states
  const fixedPer = !!c.tr && (c.step === "caucus" || c.step === "amend"); // the caucus sets the time per speech
  const heading = c.tr ? (c.step === "general" ? "General speakers\u2019 list" : c.step === "caucus" ? "Moderated caucus speakers\u2019 list" : c.step === "floor" ? "Draft resolution speakers\u2019 list" : "Speakers\u2019 list") : "Speakers\u2019 list";

  const form = (
    <>
      {!fixedPer && <Duration id="ch-sp" label="Time per speech" value={c.speakSecs} min={5} max={3600}
        onChange={(secs, ok) => { if (ok && secs !== null) act((x) => ch.setSpeakSecs(x, secs)); }} />}
      <form className={s.addRow} onSubmit={(e) => { e.preventDefault(); if (pick) { act((x) => ch.addToList(x, pick, side)); setWho(""); } }}>
        <label htmlFor="ch-add" className="sr-only">Add a state to the list</label>
        <Select id="ch-add" className={`control ${s.addWho}`} value={pick} onChange={(e) => setWho(e.target.value)}>
          <option value="">{options.length ? "Add a state…" : "No one else can join this side"}</option>
          {options.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </Select>
        {!plain && <SideSwitch side={side} setSide={setSide} />}
        <button type="submit" className="button secondary" disabled={!pick}>Add</button>
      </form>
    </>
  );
  const lists = (
    <>
      <div className={s.sides} data-plain={plain || undefined}>
        {(plain ? (["for"] as const) : (["for", "against"] as const)).map((k) => (
          <div key={k} className={s.sideCol}>
            {!plain && <div className={s.sideHead}><span className={s.chip} data-side={k}>{SIDE[k]}</span><span className="muted">{col(k).length}</span></div>}
            {(plain ? c.debate.list : col(k)).length ? (
              <ol className={s.queue}>
                {(plain ? c.debate.list : col(k)).map((x) => (
                  <li key={x.id} data-next={next?.id === x.id}>
                    <span className={s.qname}>{ch.nameOf(c, x.id)}</span>
                    <span className={s.rowBtns}>
                      <IconButton label={`Move ${ch.nameOf(c, x.id)} up`} icon={ICONS.up} onClick={() => act((y) => ch.shiftList(y, x.id, -1))} />
                      <IconButton label={`Move ${ch.nameOf(c, x.id)} down`} icon={ICONS.down} onClick={() => act((y) => ch.shiftList(y, x.id, 1))} />
                      {!plain && <IconButton label={`${ch.nameOf(c, x.id)} changes side`} icon={SWAP} onClick={() => act((y) => ch.switchSide(y, x.id))} />}
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
    </>
  );

  // Trinity: the way to add a state on the left, the list on the right, like the amendments.
  if (c.tr) {
    return (
      <div className={s.pair}>
        <section className={`panel ${s.list}`} aria-labelledby="ch-list-add">
          <div className={s.head}>
            <h2 id="ch-list-add" className={s.h2}>Add to the {heading.charAt(0).toLowerCase() + heading.slice(1)}</h2>
          </div>
          <div className={s.panelBody}>{form}</div>
        </section>
        <section className={`panel ${s.list}`} aria-labelledby="ch-list">
          <div className={s.head}>
            <h2 id="ch-list" className={s.h2}>{heading}</h2>
            <span className="badge">{c.debate.list.length}</span>
          </div>
          {lists}
        </section>
      </div>
    );
  }

  return (
    <section className={`panel ${s.list} ${wide ? s.wideList : ""}`} aria-labelledby="ch-list">
      <div className={s.head}>
        <h2 id="ch-list" className={s.h2}>{heading}</h2>
        <span className="badge">{c.debate.list.length}</span>
      </div>
      {form}
      {lists}
    </section>
  );
}

const STATUS: Record<ch.Amendment["status"], string> = { waiting: "Waiting", entertained: "Being considered", passed: "Passed", failed: "Failed", withdrawn: "Withdrawn", invalid: "Ruled invalid" };
const HOW: Record<ch.AmendHow, string> = { strike: "Strike", amend: "Amend", add: "Add" };
const signs = (n: number) => `${n} signator${n === 1 ? "y" : "ies"}`;

/* Amendments, in two boxes: handing one in (left), and the line of them waiting and what became of the rest (right). */
function AmendmentForm({ c, act }: { c: Chamber; act: Act }) {
  const [by, setBy] = useState("");
  const [clause, setClause] = useState("");
  const [text, setText] = useState("");
  const [backers, setBackers] = useState<string[]>([]);
  const [second, setSecond] = useState("");
  const [consensus, setConsensus] = useState(false);
  const [how, setHow] = useState<ch.AmendHow>("amend");
  const t = c.tr;
  // Trinity: the seconder and a quarter of the states present sign, and a clause already amended needs full consensus.
  const need = ch.signNeeded(c);
  const signed = new Set([by, second, ...backers].filter(Boolean)).size;
  const again = !!t && ch.amendedClause(c, clause);
  const ready = !!by && text.trim().length > 0 && (!t || (!!second && second !== by && signed >= need && (!again || consensus)));
  const free = c.delegates.filter((d) => !ch.observing(c, d.id));
  return (
    <section className={`panel ${s.list}`} aria-labelledby="ch-am-add">
      <div className={s.head}>
        <h2 id="ch-am-add" className={s.h2}>Add an amendment</h2>
      </div>
      <form className={s.panelBody} onSubmit={(e) => { e.preventDefault(); if (!ready) return; act((x) => ch.submitAmendment(x, uid(), by, clause, text, backers, t ? second : null, consensus, how)); setText(""); setClause(""); setBackers([]); setSecond(""); setConsensus(false); }}>
        <div className={s.two}>
          <div className="field">
            <label htmlFor="am-by" className="sr-only">Amendment from</label>
            <Select id="am-by" className="control" value={by} onChange={(e) => { setBy(e.target.value); setBackers((b) => b.filter((x) => x !== e.target.value)); if (second === e.target.value) setSecond(""); }}>
              <option value="">From which state?</option>
              {free.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </Select>
          </div>
          <div className="field">
            <label htmlFor="am-cl" className="sr-only">Clause</label>
            <input id="am-cl" className="control" value={clause} onChange={(e) => setClause(e.target.value)} placeholder="E.g., Operative Clause 1" maxLength={40} />
          </div>
        </div>
        {t && <Seg label="What it does to the clause" value={how} onPick={setHow} items={[{ id: "amend", label: "Amend" }, { id: "strike", label: "Strike" }, { id: "add", label: "Add" }]} />}
        {t && (
          <div className="field">
            <label htmlFor="am-sec" className="sr-only">Seconder</label>
            <Select id="am-sec" className="control" value={second} onChange={(e) => { setSecond(e.target.value); setBackers((b) => b.filter((x) => x !== e.target.value)); }}>
              <option value="">Seconder</option>
              {free.filter((d) => d.id !== by).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </Select>
          </div>
        )}
        <div className="field">
          <label htmlFor="am-tx" className="sr-only">What it changes</label>
          <textarea id="am-tx" className="control" rows={3} value={text} onChange={(e) => setText(e.target.value)} maxLength={600} placeholder="What the amendment changes. The preamble can't be amended." />
        </div>
        <fieldset className={s.procedure}>
          <legend>{t ? "Co-sponsors" : "Signatories"}</legend>
          <div className={s.backers}>
            {free.filter((d) => d.id !== by && d.id !== second).map((d) => (
              <label key={d.id} className={s.check}>
                <input type="checkbox" checked={backers.includes(d.id)} onChange={(e) => setBackers((b) => (e.target.checked ? [...b, d.id] : b.filter((x) => x !== d.id)))} />
                {d.name}
              </label>
            ))}
          </div>
        </fieldset>
        {t && <p className={s.hint}>{signed} of {need} signatories: a quarter of the states present, the proposer and seconder among them.</p>}
        {again && (
          <label className={s.check}><input type="checkbox" checked={consensus} onChange={(e) => setConsensus(e.target.checked)} />This clause was already amended: full consensus, no votes against and no abstentions</label>
        )}
        <button type="submit" className="button secondary block" disabled={!ready}>Add amendment</button>
      </form>
    </section>
  );
}

function AmendmentQueue({ c, act }: { c: Chamber; act: Act }) {
  const waiting = ch.waitingAmendments(c);
  const live = c.amendments.find((a) => a.id === c.amend?.id);
  const done = c.amendments.filter((a) => a.status !== "waiting" && a.status !== "entertained");
  const name = (id: string) => ch.nameOf(c, id);
  const canEntertain = c.step === "floor" && !c.speech && !c.amend;
  return (
    <section className={`panel ${s.list}`} aria-labelledby="ch-am">
      <div className={s.head}>
        <h2 id="ch-am" className={s.h2}>Amendments</h2>
        <span className="badge">{waiting.length}</span>
      </div>
      {waiting.length > 1 && (
        <div className={s.sortRow} role="group" aria-label="Sort the waiting amendments">
          <button type="button" className="button secondary sm" onClick={() => act((x) => ch.sortAmendments(x, "signatories"))}>Most signatories first</button>
          <button type="button" className="button secondary sm" onClick={() => act((x) => ch.sortAmendments(x, "oldest"))}>Oldest first</button>
        </div>
      )}
      {(live || waiting.length > 0) && (
        <ol className={s.queue}>
          {live && (
            <li data-next="true" className={s.amRow}>
              <span className={s.amMain}>
                <span className={s.qname}>{name(live.by)}{live.clause && ` · ${live.clause}`}</span>
                <span className={s.amText}>{live.text}</span>
                <span className={s.qtag}>Being considered{live.backers.length > 0 && ` · ${signs(live.backers.length)}: ${live.backers.map(name).join(", ")}`}</span>
              </span>
            </li>
          )}
          {waiting.map((a, i) => (
            <li key={a.id} className={s.amRow} data-next={!live && i === 0}>
              <span className={s.amMain}>
                {!live && i === 0 && <span className={s.qtag}>Next</span>}
                <span className={s.qname}>{name(a.by)}{a.how && ` · ${HOW[a.how]}`}{a.clause && ` · ${a.clause}`}</span>
                <span className={s.amText}>{a.text}</span>
                <span className="muted" style={{ fontSize: 12.5 }}>{signs(a.backers.length)}{a.backers.length > 0 && `: ${a.backers.map(name).join(", ")}`}</span>
              </span>
              <span className={s.rowBtns}>
                <button type="button" className="button secondary sm" disabled={!canEntertain} onClick={() => act((x) => ch.entertain(x, a.id))}>Entertain</button>
                <IconButton label={`Move ${name(a.by)}'s amendment up`} icon={ICONS.up} onClick={() => act((x) => ch.moveAmendment(x, a.id, -1))} disabled={i === 0} />
                <IconButton label={`Move ${name(a.by)}'s amendment down`} icon={ICONS.down} onClick={() => act((x) => ch.moveAmendment(x, a.id, 1))} disabled={i === waiting.length - 1} />
                <IconButton label={`Rule ${name(a.by)}'s amendment invalid`} icon={ICONS.hide} onClick={() => act((x) => ch.invalidAmendment(x, a.id))} />
                <IconButton label={`Withdraw ${name(a.by)}'s amendment`} icon={ICONS.close} onClick={() => act((x) => ch.withdrawAmendment(x, a.id))} />
              </span>
            </li>
          ))}
        </ol>
      )}
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
  const t = c.tr;
  const sc = t?.level === "experienced";
  const need = t ? (sc ? Math.ceil((2 * (n.yes + n.no)) / 3) : Math.floor((n.yes + n.no) / 2) + 1) : ch.needed(c.delegates.length);
  const closed = c.step === "closed" || c.step === "ended";
  const vetoes = sc ? [...new Set(c.delegates.filter((d) => c.ballots[d.id] === "against").map((d) => ch.permanent(d.name)).filter((x): x is string => !!x))] : [];
  return (
    <section className={`panel ${s.side}`}>
      <div className={s.head}>
        <h2 className={s.h2}>Roll call vote</h2>
      </div>
      {closed && c.outcome && (
        <p className={s.banner} data-pass={c.outcome.passed}>
          <strong>{c.outcome.passed ? "Approved" : c.outcome.vetoed ? "Vetoed" : "Not approved"}</strong>
          {c.outcome.yes} for, {c.outcome.no} against, {c.outcome.abstain} abstaining.
          {c.outcome.vetoed ? ` Vetoed by ${c.outcome.vetoed.join(" and ")}.` : !c.outcome.passed ? ` ${c.outcome.needed} votes in favour were needed.` : ""}
        </p>
      )}
      <Stats label="Votes so far" bar items={[
        { label: "For", value: n.yes, tone: "ok" },
        { label: "Against", value: n.no, tone: "bad" },
        { label: t ? "Neutral" : "Abstain", value: n.abstain },
        { label: "Still to vote", value: n.left },
      ]} />
      {t ? <p className={s.hint}>{sc ? `Security Council: two thirds of the For and Against, so ${need} For at the moment, and no permanent member Against.` : `General Assembly: more For than Against, so ${need} For at the moment.`} Abstentions count for neither.</p> : <p className={s.hint}>Needs at least {need} in favour</p>}
      {vetoes.length > 0 && !closed && <p className={s.banner} data-pass="false"><strong>Veto</strong>{vetoes.join(" and ")} voted Against.</p>}
      <ul className={s.ballots}>
        {c.delegates.map((d) => (
          <li key={d.id} className={s.ballot}>
            <span className={s.cname2}>{d.name}</span>
            <Seg label={`Vote of ${d.name}`} value={c.ballots[d.id]} disabled={closed} className={s.ballotSeg}
              items={[{ id: "for", label: "For" }, { id: "against", label: "Against" }, { id: "abstain", label: t ? "Neutral" : "Abstain", off: !!t && c.roll[d.id] === "voting" }]}
              onPick={(b) => act((x) => ch.cast(x, d.id, c.ballots[d.id] === b ? null : (b as Ballot)))} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/* Trinity Grammar MUN: introducing a draft resolution. Its proposer and co-proposer come from the draft; the chair chooses an opposer, if anyone will. */
function TrinityPick({ c, act }: { c: Chamber; act: Act }) {
  const d = ch.currentDoc(c);
  const name = (id: string | null) => ch.nameOf(c, id);
  const here = c.delegates.filter((x) => (c.roll[x.id] === "present" || c.roll[x.id] === "voting") && !ch.observing(c, x.id));
  const pool = (here.length ? here : c.delegates).filter((x) => x.id !== c.roles.proposer && x.id !== c.roles.seconder);
  return (
    <form className={`panel ${s.opening}`} onSubmit={(e) => { e.preventDefault(); act(ch.startSpeeches); }}>
      <div className={s.head}>
        <h2 className={`serif ${s.who}`}>Introduce the draft resolution</h2>
      </div>
      {d && (
        <div className={s.resBox}>
          <span className={s.tag}>Draft resolution</span>
          <p className={`serif ${s.resText}`}>{d.title}</p>
        </div>
      )}
      <div className={s.three}>
        <div className="field"><span>Proposer</span><p className={s.fixedVal}>{name(c.roles.proposer)}</p></div>
        <div className="field"><span>Co-proposer</span><p className={s.fixedVal}>{name(c.roles.seconder)}</p></div>
        <div className="field">
          <label htmlFor="pk-opposer">Opposer (optional)</label>
          <Select id="pk-opposer" className="control" value={c.roles.opposer ?? ""} onChange={(e) => act((x) => ch.pickRole(x, "opposer", e.target.value || null))}>
            <option value="">No opposer</option>
            {pool.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </Select>
        </div>
      </div>
      <button type="submit" className="button lg block">Start the speeches</button>
      <button type="button" className="button secondary block" onClick={() => act(ch.cancelIntroduction)}>Back to the general debate</button>
    </form>
  );
}

/* Trinity Grammar MUN: motions. Raised in any order, put in the order the chair chooses, then voted on by placard. */
/** A country's two-letter badge, for the people on a motion or a document. */
const initials = (n: string) => { const w = n.trim().split(/\s+/); return (w.length > 1 ? w[0][0] + w[1][0] : n.slice(0, 2)).toUpperCase(); };
function Avatar({ name, tone }: { name: string; tone?: "lead" | "second" }) {
  return <span className={s.kAvatar} data-tone={tone} aria-hidden="true">{initials(name)}</span>;
}

function Motions({ c, act }: { c: Chamber; act: Act }) {
  const [chosen, setKind] = useState<ch.MotionKind>("mod");
  const kinds = ch.motionKinds(c);
  const kind = kinds.includes(chosen) ? chosen : kinds[0];
  const [by, setBy] = useState("");
  const [topic, setTopic] = useState("");
  const [total, setTotal] = useState<number | null>(600);
  const [per, setPer] = useState<number | null>(60);
  const [ref, setRef] = useState("");
  const waiting = ch.waitingMotions(c);
  const past = c.tr!.motions.filter((m) => m.status === "passed" || m.status === "failed").slice(-6).reverse();
  const input: ch.MotionInput = { kind, by: by || null, topic, total: total ?? 0, per: per ?? 0, ref: ref || null };
  const err = ch.motionError(c, input);
  const pickKind = (k: ch.MotionKind) => { setKind(k); setRef(""); setTotal(k === "mod" ? 600 : k === "unmod" ? 300 : 120); setPer(60); };
  const amendments = ch.waitingAmendments(c);
  const approved = ch.drafts(c).filter((d) => d.status === "approved" && !d.result);
  const busy = !!c.poll || !!c.speech;
  // "Start a moderated caucus" on the floor lands here, on that motion, with the topic ready to be typed.
  useEffect(() => {
    const open = () => { setKind("mod"); setTimeout(() => { const el = document.getElementById("mo-topic"); el?.scrollIntoView({ block: "center", behavior: "smooth" }); el?.focus({ preventScroll: true }); }, 50); };
    window.addEventListener("chambers:motion", open);
    return () => window.removeEventListener("chambers:motion", open);
  }, []);
  return (
    <div className={s.pair}>
    <section className={`panel ${s.list}`} aria-labelledby="ch-mo-add">
      <div className={s.head}>
        <h2 id="ch-mo-add" className={s.h2}>Add a motion</h2>
      </div>
      <form className={s.panelBody} onSubmit={(e) => { e.preventDefault(); if (err) return; act((x) => ch.addMotion(x, uid(), input)); setTopic(""); }}>
        <div className={s.two}>
          <div className="field">
            <label htmlFor="mo-kind" className="sr-only">Motion</label>
            <Select id="mo-kind" className="control" value={kind} onChange={(e) => pickKind(e.target.value as ch.MotionKind)}>
              {kinds.map((k) => <option key={k} value={k}>{ch.MOTION_LABEL[k]}</option>)}
            </Select>
          </div>
          <div className="field">
            <label htmlFor="mo-by" className="sr-only">From which state</label>
            <Select id="mo-by" className="control" value={by} onChange={(e) => setBy(e.target.value)}>
              <option value="">From which state?</option>
              {c.delegates.filter((d) => !ch.observing(c, d.id)).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </Select>
          </div>
        </div>
        {kind === "mod" && (
          <div className="field">
            <label htmlFor="mo-topic" className="sr-only">Topic</label>
            <input id="mo-topic" className="control" value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={120} placeholder="Topic of the caucus" />
          </div>
        )}
        {(kind === "mod" || kind === "unmod" || kind === "extend") && (
          <div className={s.two} key={kind}>
            <Duration id="mo-total" label={kind === "extend" ? "Extend by" : "Duration"} value={total} min={kind === "unmod" ? 30 : 10} max={ch.TR.maxCaucus} onChange={(v) => setTotal(v)} />
            {kind === "mod" && <Duration id="mo-per" label="Time per speaker" value={per} min={5} max={ch.TR.maxCaucus} onChange={(v) => setPer(v)} />}
          </div>
        )}
        {kind === "amend" && (
          <div className="field">
            <label htmlFor="mo-ref" className="sr-only">Amendment</label>
            <Select id="mo-ref" className="control" value={ref} onChange={(e) => setRef(e.target.value)}>
              <option value="">{amendments.length ? "Which amendment?" : "No amendment is waiting"}</option>
              {amendments.map((a) => <option key={a.id} value={a.id}>{ch.nameOf(c, a.by)}{a.clause && ` · ${a.clause}`}</option>)}
            </Select>
          </div>
        )}
        {kind === "draft" && (
          <div className="field">
            <label htmlFor="mo-ref" className="sr-only">Draft resolution</label>
            <Select id="mo-ref" className="control" value={ref} onChange={(e) => setRef(e.target.value)}>
              <option value="">{approved.length ? "Which draft resolution?" : "No approved draft resolution"}</option>
              {approved.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
            </Select>
          </div>
        )}
        {err && <p className={s.hint} role="status">{err}</p>}
        <button type="submit" className="button secondary block" disabled={!!err}>Add the motion</button>
      </form>
    </section>
    <section className={`panel ${s.list}`} aria-labelledby="ch-mo">
      <div className={s.head}>
        <h2 id="ch-mo" className={s.h2}>Motions</h2>
        <span className="badge">{waiting.length}</span>
      </div>
      {waiting.length > 1 && (
        <div className={s.sortRow} role="group" aria-label="Order the motions">
          <button type="button" className="button secondary sm" onClick={() => act(ch.sortMotions)}>Oldest first</button>
        </div>
      )}
      {waiting.length > 0 && (
        <ol className={s.queue}>
          {waiting.map((m, i) => (
            <li key={m.id} className={`${s.card} ${s.motion}`} data-next={i === 0}>
              <span className={s.cardTop}>
                <span className={s.cardTitle}>{ch.MOTION_LABEL[m.kind]}</span>
                {i === 0 && <span className={s.nextTag}>Next</span>}
              </span>
              <span className={s.cardMeta}>
                {m.by && <span className={s.kSigner}><Avatar name={ch.nameOf(c, m.by)} tone="lead" />{ch.nameOf(c, m.by)}<small>proposes</small></span>}
                {ch.motionDetail(c, m) && <span className={s.detail}>{ch.motionDetail(c, m)}</span>}
              </span>
              <span className={s.kActions}>
                <button type="button" className="button secondary sm" disabled={busy || !!ch.motionError(c, m)} onClick={() => act((x) => ch.voteMotion(x, m.id))}>Put to the vote</button>
                <IconButton label={`Move the ${ch.MOTION_LABEL[m.kind]} motion up`} icon={ICONS.up} onClick={() => act((x) => ch.moveMotion(x, m.id, -1))} disabled={i === 0} />
                <IconButton label={`Move the ${ch.MOTION_LABEL[m.kind]} motion down`} icon={ICONS.down} onClick={() => act((x) => ch.moveMotion(x, m.id, 1))} disabled={i === waiting.length - 1} />
                <IconButton label={`Withdraw the ${ch.MOTION_LABEL[m.kind]} motion`} icon={ICONS.close} onClick={() => act((x) => ch.withdrawMotion(x, m.id))} disabled={c.poll?.motion === m.id} />
              </span>
            </li>
          ))}
        </ol>
      )}
      {past.length > 0 && (
        <ul className={s.states}>
          {past.map((m) => <li key={m.id}><span>{ch.MOTION_LABEL[m.kind]}{m.by && ` · ${ch.nameOf(c, m.by)}`}</span><span className={s.chip} data-tone={m.status === "passed" ? "ok" : "bad"}>{m.status === "passed" ? "Passed" : "Failed"}</span></li>)}
        </ul>
      )}
    </section>
    </div>
  );
}

/* Trinity Grammar MUN: working papers and draft resolutions. */
const DOC_STATUS: Record<ch.Doc["status"], string> = { submitted: "Submitted", approved: "Approved", sent: "Sent back" };
const DOC_RESULT = { passed: "Passed", failed: "Failed", vetoed: "Vetoed" } as const;
function Documents({ c, act }: { c: Chamber; act: Act }) {
  const t = c.tr!;
  // The experienced committee writes working papers in week 1 and debates a draft resolution in week 2; the beginner committee debates draft resolutions throughout.
  const kind: ch.Doc["kind"] = t.level === "experienced" && t.week === 1 ? "paper" : "draft";
  const askSeen = t.level === "beginner" && t.week === 2; // week 2 has one seen and one unseen resolution
  const [title, setTitle] = useState("");
  const [seen, setSeen] = useState(true);
  const [proposer, setProposer] = useState("");
  const [seconder, setSeconder] = useState("");
  const [sponsors, setSponsors] = useState<string[]>([]);
  const [link, setLink] = useState("");
  const [clauses, setClauses] = useState("");
  const [from, setFrom] = useState<string[]>([]);
  const papers = t.docs.filter((d) => d.kind === "paper");
  const need = ch.signNeeded(c);
  const name = (id: string | null) => ch.nameOf(c, id);
  const signers = new Set([proposer, seconder, ...sponsors].filter(Boolean)).size;
  const ready = title.trim().length > 0 && !!proposer && (kind === "paper" ? sponsors.length > 0 : !!seconder && seconder !== proposer);
  const reset = () => { setTitle(""); setProposer(""); setSeconder(""); setSponsors([]); setLink(""); setClauses(""); setSeen(true); setFrom([]); };
  const can = c.delegates.filter((d) => !ch.observing(c, d.id));
  const noun = kind === "paper" ? "working paper" : "draft resolution";
  return (
    <div className={s.pair}>
      <section className={`panel ${s.list}`} aria-labelledby="ch-docs-add">
        <div className={s.head}>
          <h2 id="ch-docs-add" className={s.h2}>Add a {noun}</h2>
        </div>
        <form className={s.panelBody} onSubmit={(e) => { e.preventDefault(); if (!ready) return; act((x) => ch.addDoc(x, uid(), { kind, title, week: t.week, seen: askSeen ? seen : true, proposer, seconder: kind === "draft" ? seconder : null, sponsors, link, clauses, from })); reset(); }}>
          <div className="field">
            <label htmlFor="dc-title" className="sr-only">Title</label>
            <input id="dc-title" className="control" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} placeholder="Title" />
          </div>
          <div className={s.two}>
            <div className="field">
              <label htmlFor="dc-prop" className="sr-only">Proposer</label>
              <Select id="dc-prop" className="control" value={proposer} onChange={(e) => { setProposer(e.target.value); setSponsors((b) => b.filter((x) => x !== e.target.value)); }}>
                <option value="">{kind === "paper" ? "Sponsor" : "Proposer"}</option>
                {can.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </Select>
            </div>
            {kind === "draft" && (
              <div className="field">
                <label htmlFor="dc-sec" className="sr-only">Seconder</label>
                <Select id="dc-sec" className="control" value={seconder} onChange={(e) => { setSeconder(e.target.value); setSponsors((b) => b.filter((x) => x !== e.target.value)); }}>
                  <option value="">Seconder</option>
                  {can.filter((d) => d.id !== proposer).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </Select>
              </div>
            )}
          </div>
          <fieldset className={s.procedure}>
            <legend>Co-sponsors</legend>
            <div className={s.backers}>
              {can.filter((d) => d.id !== proposer && d.id !== seconder).map((d) => (
                <label key={d.id} className={s.check}>
                  <input type="checkbox" checked={sponsors.includes(d.id)} onChange={(e) => setSponsors((b) => (e.target.checked ? [...b, d.id] : b.filter((x) => x !== d.id)))} />
                  {d.name}
                </label>
              ))}
            </div>
          </fieldset>
          {kind === "draft" && t.level === "experienced" && papers.length > 0 && (
            <fieldset className={s.procedure}>
              <legend>Made from these working papers</legend>
              <div className={s.backers}>
                {papers.map((d) => (
                  <label key={d.id} className={s.check}>
                    <input type="checkbox" checked={from.includes(d.id)} onChange={(e) => setFrom((b) => (e.target.checked ? [...b, d.id] : b.filter((x) => x !== d.id)))} />
                    {d.title}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          {kind === "draft" && <p className={s.hint}>{signers} of {need} signatories: a quarter of the states present, the proposer and seconder among them.</p>}
          {askSeen && <label className={s.check}><input type="checkbox" checked={seen} onChange={(e) => setSeen(e.target.checked)} />Seen resolution (the unseen one gets 20 minutes of preparation)</label>}
          <div className="field">
            <label htmlFor="dc-link" className="sr-only">Link to the document</label>
            <input id="dc-link" className="control" value={link} onChange={(e) => setLink(e.target.value)} maxLength={300} inputMode="url" placeholder="Link to the document or research sheet (optional)" />
          </div>
          <div className="field">
            <label htmlFor="dc-cl" className="sr-only">Operative clauses</label>
            <textarea id="dc-cl" className="control" rows={4} value={clauses} onChange={(e) => setClauses(e.target.value)} maxLength={8000} placeholder="Paste the operative clauses (optional). They show beside an amendment." />
            {clauses.length > 0 && <small>{clauses.length} of 8,000</small>}
          </div>
          <button type="submit" className="button secondary block" disabled={!ready}>Add the {noun}</button>
        </form>
      </section>
      <section className={`panel ${s.list}`} aria-labelledby="ch-docs">
        <div className={s.head}>
          <h2 id="ch-docs" className={s.h2}>Documents</h2>
          <span className="badge">{t.docs.length}</span>
        </div>
        {t.docs.length > 0 ? (
          <ul className={s.queue}>
            {t.docs.map((d) => {
              const n = ch.docSigners(d).length;
              const locked = !!d.result || (d.kind === "draft" && d.status === "approved");
              return (
                <li key={d.id} className={`${s.card} ${s.doc}`} data-next={t.current === d.id}>
                  <span className={s.cardTop}>
                    <span className={s.cardTitle}>{d.title}</span>
                    {d.result
                      ? <span className={s.chip} data-tone={d.result === "passed" ? "ok" : "bad"}>{DOC_RESULT[d.result]}</span>
                      : t.current === d.id
                        ? <span className={s.chip} data-tone="accent">Being debated</span>
                        : d.kind === "draft" && <span className={s.chip} data-tone={d.status === "approved" ? "ok" : d.status === "sent" ? "bad" : undefined}>{DOC_STATUS[d.status]}</span>}
                  </span>
                  <span className={s.docMeta}>
                    {[d.kind === "paper" ? "Working paper" : "Draft resolution", `Week ${d.week}`, d.kind === "draft" && t.level === "beginner" ? (d.seen ? "Seen" : "Unseen") : ""].filter(Boolean).join(" \u00B7 ")}
                  </span>
                  <span className={s.signBox}>
                    <span className={s.kSigners}>
                      {ch.docSigners(d).map((id) => (
                        <span key={id} className={s.kSigner}>
                          <Avatar name={name(id)} tone={id === d.proposer ? "lead" : id === d.seconder ? "second" : undefined} />
                          {name(id)}
                          {id === d.proposer && <small>proposer</small>}
                          {id === d.seconder && <small>seconder</small>}
                        </span>
                      ))}
                    </span>
                    {d.kind === "draft" ? (
                      <span className={s.kMeter} data-met={n >= need} role="img" aria-label={`${n} of ${need} signatures`}>
                        <span className={s.kMeterBar}><i style={{ width: `${Math.min(100, (n / Math.max(need, 1)) * 100)}%` }} /></span>
                        <span className={s.kMeterText}>{n} of {need} signed</span>
                      </span>
                    ) : <span className={s.kMeterText}>{n} signator{n === 1 ? "y" : "ies"}</span>}
                  </span>
                  {d.from.length > 0 && <span className={s.docMeta}>From {d.from.map((f) => t.docs.find((x) => x.id === f)?.title).filter(Boolean).join(", ")}</span>}
                  {d.link && <a className={s.docLink} href={d.link} target="_blank" rel="noopener noreferrer">Open the document</a>}
                  {!locked && (
                    <details className={s.docSign}>
                      <summary>Edit signatories</summary>
                      <div className={s.backers}>
                        {can.filter((x) => x.id !== d.proposer && x.id !== d.seconder).map((x) => (
                          <label key={x.id} className={s.check}>
                            <input type="checkbox" checked={d.sponsors.includes(x.id)} onChange={(e) => act((y) => ch.signDoc(y, d.id, x.id, e.target.checked))} />
                            {x.name}
                          </label>
                        ))}
                      </div>
                    </details>
                  )}
                  <span className={s.kActions}>
                    {d.kind === "draft" && d.status === "submitted" && <button type="button" className="button secondary sm" disabled={n < need} onClick={() => act((x) => ch.approveDoc(x, d.id))}>Approve</button>}
                    {d.kind === "draft" && d.status === "approved" && !d.result && t.current !== d.id && <button type="button" className="button secondary sm" disabled={c.step !== "general" || !!c.speech || !!c.poll} onClick={() => act((x) => ch.introduceDraft(x, d.id))}>Introduce</button>}
                    {d.kind === "draft" && d.status === "sent" && <button type="button" className="button secondary sm" onClick={() => act((x) => ch.resubmitDoc(x, d.id))}>Resubmit</button>}
                    {d.kind === "draft" && d.status !== "sent" && !d.result && t.current !== d.id && <IconButton label={`Send ${d.title} back`} icon={ICONS.hide} onClick={() => act((x) => ch.sendBackDoc(x, d.id))} />}
                    {!d.result && t.current !== d.id && <IconButton label={`Remove ${d.title}`} icon={ICONS.close} onClick={() => act((x) => ch.removeDoc(x, d.id))} />}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : <p className={s.empty}>No documents yet.</p>}
      </section>
    </div>
  );
}

/* Trinity Grammar MUN: points, rights of reply and the honorary observer. */
function ChairTools({ c, act, now }: { c: Chamber; act: Act; now: number }) {
  const t = c.tr!;
  const [by, setBy] = useState("");
  const [to, setTo] = useState("");
  const [obs, setObs] = useState("");
  const name = (id: string | null) => ch.nameOf(c, id);
  const toId = to || c.speech?.who || "";
  const active = Object.keys(t.observers).filter((id) => ch.observing(c, id, now) && c.delegates.some((d) => d.id === id));
  return (
    <section className={`panel ${s.list}`} aria-labelledby="ch-tools">
      <div className={s.head}>
        <h2 id="ch-tools" className={s.h2}>Chair&apos;s tools</h2>
      </div>
      <div className={s.panelBody}>
        <fieldset className={s.procedure}>
          <legend>Right of reply</legend>
          {t.reply ? (
            <>
              <p className={s.hint}>{name(t.reply.by)} has {ch.REPLY_SECS} seconds{t.reply.to ? `, then ${name(t.reply.to)} answers` : ""}. No questions.</p>
              <div className={s.sortRow}>
                {(["apologised", "withdrew", "refused"] as const).map((o) => <button key={o} type="button" className="button secondary sm" onClick={() => act((x) => ch.finishReply(x, o))}>{o === "apologised" ? "Apologised" : o === "withdrew" ? "Withdrew" : "Refused"}</button>)}
                <button type="button" className="button secondary sm" onClick={() => act((x) => ch.finishReply(x, null))}>No answer</button>
              </div>
            </>
          ) : (
            <div className={s.two}>
              <Select id="rr-by" className="control" value={by} onChange={(e) => setBy(e.target.value)}>
                <option value="">Who claims it?</option>
                {c.delegates.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </Select>
              <Select id="rr-to" className="control" value={toId} onChange={(e) => setTo(e.target.value)}>
                <option value="">Against whom?</option>
                {c.delegates.filter((d) => d.id !== by).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </Select>
              <button type="button" className="button secondary" disabled={!by || by === toId} onClick={() => { act((x) => ch.startReply(x, by, toId || null)); setBy(""); setTo(""); }}>Start the 20 seconds</button>
            </div>
          )}
        </fieldset>
        <fieldset className={s.procedure}>
          <legend>Honorary observer</legend>
          <div className={s.pickRow}>
            <Select id="ob-who" className="control" value={obs} onChange={(e) => setObs(e.target.value)}>
              <option value="">Which state?</option>
              {c.delegates.filter((d) => !ch.observing(c, d.id, now) && c.speech?.who !== d.id).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </Select>
            <button type="button" className="button secondary sm" disabled={!obs} onClick={() => { act((x) => ch.setObserver(x, obs)); setObs(""); }}>5 minutes</button>
          </div>
          {active.length > 0 && (
            <ul className={s.states}>
              {active.map((id) => (
                <li key={id}>
                  <span>{name(id)} <span className="num muted">{ch.clock(ch.observerLeft(c, id, now))}</span></span>
                  <button type="button" className="button secondary sm" onClick={() => act((x) => ch.endObserver(x, id))}>End</button>
                </li>
              ))}
            </ul>
          )}
        </fieldset>
      </div>
    </section>
  );
}

const PER_PAGE = 10;
// The activity can be narrowed to what is worth looking at for awards; the three opening speeches and the closing ones are already in the table.
const FILTERS: ch.StatKind[] = ["speaker", "amender", "poi", "reply", "amendment"];

/* Analytics: what each state did and for how long, to help decide awards. */
function Analytics({ c, say }: { c: Chamber; say: (t: string) => void }) {
  const [tab, setTab] = useState<"states" | "activity">("states");
  const [kind, setKind] = useState<"" | ch.StatKind>("");
  const [sat, setSat] = useState(0);
  const [aat, setAat] = useState(0);
  const [wkv, setWkv] = useState<"all" | "1" | "2">("all");
  const t = c.tr;
  const wk = wkv === "all" ? undefined : wkv === "1" ? 1 : 2;
  const name = (id: string) => ch.nameOf(c, id) || "A removed state";
  const roleOf = (id: string) => (["proposer", "seconder", "opposer"] as const).filter((k) => c.roles[k] === id).map((k) => ch.ROLE_LABEL[k]);
  const rows = ch.summary(c, wk).sort((a, b) => b.secs - a.secs || b.speeches - a.speeches || a.name.localeCompare(b.name));
  const feed = [...c.stats].reverse().filter((x) => (!kind || x.kind === kind) && (!wk || x.wk === wk));
  const sPages = Math.max(1, Math.ceil(rows.length / PER_PAGE));
  const aPages = Math.max(1, Math.ceil(feed.length / PER_PAGE));
  const sp = Math.min(sat, sPages - 1);
  const ap = Math.min(aat, aPages - 1);
  const when = (t: number) => new Date(t).toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit", timeZone: "Australia/Sydney" });
  const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
  const csv = () => {
    const q = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const lines = [["Time", ...(t ? ["Week"] : []), "State", "What", "Seconds", "With", "Resolution"].join(","), ...c.stats.map((x) => [when(x.at), ...(t ? [x.wk ?? ""] : []), q(name(x.who)), q(ch.STAT_LABEL[x.kind]), x.secs, q(x.with ? name(x.with) : ""), q(x.res)].join(","))];
    navigator.clipboard?.writeText(lines.join("\n")).then(() => say("Copied as CSV"), () => say("Couldn't copy"));
  };

  return (
    <section id="chv-panel-analytics" role="tabpanel" aria-labelledby="chv-tab-analytics" className={`panel ${s.log}`}>
      <div className={s.head}>
        <h2 className={s.h2}>Analytics</h2>
        <button type="button" className={`button secondary ${s.csvBtn}`} onClick={csv} disabled={!c.stats.length}>{COPY}Copy as CSV</button>
      </div>
      {t && <Seg label="Week" value={wkv} onPick={(v) => { setWkv(v); setSat(0); setAat(0); }} items={[{ id: "all", label: "Both weeks" }, { id: "1", label: "Week 1" }, { id: "2", label: "Week 2" }]} />}
      <PanelTabs idPrefix="cha" label="Analytics views" tab={tab} setTab={setTab}
        tabs={[{ id: "states", label: "By state", icon: ICONS.chart }, { id: "activity", label: "Activity", icon: ICONS.clock }]} />
      {tab === "states" ? (
        <div id="cha-panel-states" role="tabpanel" aria-labelledby="cha-tab-states" className={s.panelBody}>
          <div className={s.tableWrap}>
            <table className={s.aTable}>
              <thead>
                <tr><th scope="col">State</th><th scope="col">Speeches</th><th scope="col">Speaking time</th><th scope="col">POI asked</th><th scope="col">POI answered</th><th scope="col">Amendments</th><th scope="col">Signed</th></tr>
              </thead>
              <tbody>
                {rows.slice(sp * PER_PAGE, (sp + 1) * PER_PAGE).map((r) => (
                  <tr key={r.id}>
                    <th scope="row">
                      <span className={s.aName}>{r.name}</span>
                      {roleOf(r.id).map((x) => <span key={x} className={s.pbadge}>{x}</span>)}
                    </th>
                    <td>{r.speeches}</td>
                    <td className="num">{ch.clock(r.secs * 1000)}</td>
                    <td>{r.asked}</td>
                    <td>{r.answered}</td>
                    <td>{r.amendments}</td>
                    <td>{r.signed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {sPages > 1 && <Pager at={sp} pages={sPages} go={setSat} label="By state pages" />}
          {t && (() => {
            const inWk = <T extends { wk: 1 | 2 }>(x: T) => !wk || x.wk === wk;
            const rep = t.replies.filter(inWk);
            return (
              <Stats label="Chair's totals" items={[
                { label: "Motions passed", value: t.motions.filter((m) => m.status === "passed").length, tone: "ok" },
                { label: "Motions failed", value: t.motions.filter((m) => m.status === "failed").length, tone: "bad" },
                { label: "Rights of reply", value: rep.length },
              ]} />
            );
          })()}
        </div>
      ) : (
        <div id="cha-panel-activity" role="tabpanel" aria-labelledby="cha-tab-activity" className={s.panelBody}>
          <div className="field">
            <label htmlFor="an-kind" className="sr-only">Show</label>
            <Select id="an-kind" className="control" value={kind} onChange={(e) => { setKind(e.target.value as "" | ch.StatKind); setAat(0); }}>
              <option value="">Everything</option>
              {(t ? (["statement", ...FILTERS] as ch.StatKind[]) : FILTERS).map((k) => <option key={k} value={k}>{ch.STAT_LABEL[k]}</option>)}
            </Select>
          </div>
          {feed.length === 0 ? <p className={s.empty}>Nothing yet.</p> : (
            <ol className={s.entries}>
              {feed.slice(ap * PER_PAGE, (ap + 1) * PER_PAGE).map((x, i) => (
                <li key={`${x.at}-${i}`} className={s.statRow}>
                  <span className={s.statMain}>
                    <strong>{name(x.who)}</strong>
                    <small>{ch.STAT_LABEL[x.kind]}{x.with ? (x.kind === "signatory" ? ` on ${name(x.with)}'s` : ` to ${name(x.with)}`) : ""} · {when(x.at)}</small>
                  </span>
                  <span className={`${s.statTime} num`}>{x.kind === "amendment" || x.kind === "signatory" ? "" : ch.clock(x.secs * 1000)}</span>
                </li>
              ))}
            </ol>
          )}
          {aPages > 1 && <Pager at={ap} pages={aPages} go={setAat} label="Activity pages" />}
        </div>
      )}
    </section>
  );
}

function Pager({ at, pages, go, label }: { at: number; pages: number; go: (n: number) => void; label: string }) {
  return (
    <nav className={s.pager} aria-label={label}>
      <button type="button" className="button secondary" onClick={() => go(at - 1)} disabled={at === 0}>Previous</button>
      <span className="muted" aria-live="polite">Page {at + 1} of {pages}</span>
      <button type="button" className="button secondary" onClick={() => go(at + 1)} disabled={at === pages - 1}>Next</button>
    </nav>
  );
}

/* Settings, 1: a photo behind the display. */
function Background({ c, act, say, userId }: { c: Chamber; act: Act; say: (t: string) => void; userId?: string }) {
  const [busy, setBusy] = useState(false);
  const [strength, setStrength] = useState(c.backgroundStrength);
  useEffect(() => { setStrength(c.backgroundStrength); }, [c.backgroundStrength]);
  const commit = () => { if (strength !== c.backgroundStrength) act((x) => ch.setBackgroundStrength(x, strength)); };

  const choose = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    // Logged in: the picture goes to Collex and the committee keeps its address. Not logged in: a smaller copy travels inside the committee.
    const r = userId ? await uploadBackground(file, userId) : await backgroundData(file);
    setBusy(false);
    if ("error" in r) { say(r.error); return; }
    const bg = "url" in r ? r.url : r.data;
    act((x) => ch.setBackground(x, bg));
  };

  return (
    <section className={`panel ${s.share}`} aria-labelledby="st-bg">
      <h2 id="st-bg" className={s.h2}>Display background</h2>
      <div className={s.bgPreview} data-empty={!c.background}>
        {c.background ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={c.background} alt="The display background" /> : <span>No photo</span>}
      </div>
      <div className={s.bgActions} data-one={!c.background}>
        <label className={`button ${s.fileBtn}`} aria-disabled={busy}>
          {busy ? "Uploading…" : c.background ? "Change photo" : "Choose a photo"}
          <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={busy} onChange={(e) => { void choose(e.target.files?.[0]); e.target.value = ""; }} />
        </label>
        {c.background && <button type="button" className="button secondary" onClick={() => act((x) => ch.setBackground(x, null))}>Remove photo</button>}
      </div>
      {c.background && (
        <div className={s.strength}>
          <div className={s.strengthHead}>
            <label htmlFor="st-str">Photo strength</label>
            <output htmlFor="st-str" className="num">{strength}%</output>
          </div>
          <input id="st-str" type="range" min={20} max={100} step={5} value={strength} className={s.range} style={{ "--fill": `${((strength - 20) / 80) * 100}%` } as React.CSSProperties}
            onChange={(e) => setStrength(Number(e.target.value))} onPointerUp={commit} onKeyUp={commit} onBlur={commit} />
        </div>
      )}
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
    // A background carried inside the committee is too big to keep in the shared copy: it goes to Collex and the address is kept instead.
    let initial = c;
    if (c.background?.startsWith("data:")) {
      const blob = dataToBlob(c.background);
      const up = blob && meId ? await uploadBackgroundBlob(blob, meId) : null;
      initial = { ...c, background: up && "url" in up ? up.url : null };
    }
    const { data, error } = await supabase.rpc("create_chamber", { initial });
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
    <section id="ch-share" className={`panel ${s.share}`} aria-labelledby="st-share">
      <h2 id="st-share" className={s.h2}>Share</h2>
      {!cloudId ? (
        <>
          <p className="muted">Share this committee and add other chairs by the email on their Collex account.</p>
          {signedIn
            ? <button type="button" className="button" onClick={share} disabled={busy}>Share this committee</button>
            : <Link href="/login" className="button">Log in to share</Link>}
        </>
      ) : (
        <>
          <p className="muted">Everyone here can run the console and open the display. They need to be logged in on their own device.</p>
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
  const [proc, setProc] = useState<"evatt" | "trinity">("evatt");
  const [level, setLevel] = useState<ch.Level>("beginner");
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
      <PageBand title="Chambers" lead="Run a committee under the Evatt rules or Trinity Grammar MUN's: roll call, speeches, amendments and the vote, with a display for the projector." />
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
        <form className={`panel ${s.setupCard}`} onSubmit={(e) => { e.preventDefault(); if (!ok || speak === null) return; const ids = names.map(uid); onCreate(proc === "trinity" ? ch.createTrinity(name, resolution, level, speak, names, ids) : ch.create(name, resolution, speak, names, ids)); }}>
          <div className={s.two}>
            <div className="field">
              <label htmlFor="cs-proc">Procedure</label>
              <Select id="cs-proc" className="control" value={proc} onChange={(e) => { const v = e.target.value as "evatt" | "trinity"; setProc(v); setSpeak(v === "trinity" ? 60 : 120); setSpeakOk(true); }}>
                <option value="evatt">Evatt</option>
                <option value="trinity">Trinity Grammar MUN</option>
              </Select>
            </div>
            {proc === "trinity" && (
              <div className="field">
                <label htmlFor="cs-level">Committee</label>
                <Select id="cs-level" className="control" value={level} onChange={(e) => setLevel(e.target.value as ch.Level)}>
                  <option value="beginner">Beginner committee</option>
                  <option value="experienced">Experienced committee</option>
                </Select>
              </div>
            )}
          </div>
          <div className={s.two}>
            <div className="field">
              <label htmlFor="cs-name">Committee</label>
              <input id="cs-name" className="control" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required />
            </div>
            <Duration key={proc} id="cs-sp" label={proc === "trinity" ? "Time per speaker" : "Speaking time"} value={proc === "trinity" ? 60 : 120} min={5} max={3600} onChange={(v, good) => { setSpeak(v); setSpeakOk(good); }} />
          </div>
          <div className="field">
            <label htmlFor="cs-res">{proc === "trinity" ? "Topic" : "Resolution"}</label>
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
