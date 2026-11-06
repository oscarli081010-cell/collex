"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import * as ch from "@/lib/chamber";
import type { Chamber, Majority } from "@/lib/chamber";
import { supabase } from "@/lib/supabase";
import { isId, useChamber } from "@/lib/useChamber";
import { useAuth } from "./AuthProvider";
import IconButton, { ConfirmIconButton, ICONS } from "./IconButton";
import PageBand from "./PageBand";
import PanelTabs from "./PanelTabs";
import { useToast } from "./useToast";
import s from "./Chambers.module.css";

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

const MAJORITY: Record<Majority, string> = { simple: "Simple majority", twoThirds: "Two-thirds majority" };

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
  const [tab, setTab] = useState<"motions" | "roll">("motions");
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

  const toggle = () => act((x) => (ch.running(x.timer) ? ch.pauseTimer(x, ch.now()) : ch.startTimer(x, ch.now())));
  const next = () => {
    if (!c) return;
    const after = ch.nextSpeaker(c);
    act(ch.nextSpeaker);
    setLive(after.speaker ? `Speaker: ${ch.nameOf(after, after.speaker)}` : "The speakers list is empty");
  };

  // Space starts or pauses the timer and N brings up the next speaker, unless the keys are going to a control.
  const keys = useRef({ toggle, next });
  keys.current = { toggle, next };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el?.closest("input, textarea, select, button, a, [contenteditable], [role=tab]")) return;
      if (e.key === " ") { e.preventDefault(); keys.current.toggle(); }
      else if (e.key.toLowerCase() === "n") keys.current.next();
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
  if (!c) return <Setup signedIn={!!session} onCreate={(x) => { setLocal(x); setTab("roll"); say("Committee opened"); }} />;

  const present = ch.presentCount(c);
  const waiting = c.delegates.filter((d) => d.present && !c.queue.includes(d.id) && c.speaker !== d.id);
  const pct = c.timer ? Math.min(100, (left / c.timer.total) * 100) : 0;
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

  return (
    <main id="top" className={`container ${s.page}`}>
      <header className={s.top}>
        <div className={s.topText}>
          <h1 className={`serif ${s.name}`}>{c.name}</h1>
          <p className={s.topic}>{c.topic && `${c.topic} · `}{present} of {c.delegates.length} present</p>
          <p className={s.where} data-state={status === "offline" ? "offline" : cloudId ? "live" : "local"}>
            <i aria-hidden="true" />
            {status === "offline" ? "Offline, trying again" : cloudId ? "Shared · updates live" : "Saved in this browser only"}
          </p>
        </div>
        <div className={s.topActions}>
          <a className="button secondary" href={display} target="_blank" rel="noopener">Open display</a>
          <button type="button" className="button secondary" aria-expanded={sharing} aria-controls="ch-share" onClick={() => setSharing((x) => !x)}>Share</button>
          <ConfirmIconButton label={cloudId && !owner ? "Leave this committee" : cloudId ? "Delete this committee" : "Close this committee"}
            confirm="Click again to confirm" icon={cloudId && !owner ? ICONS.leave : ICONS.trash} onConfirm={() => void remove()} />
        </div>
      </header>

      {sharing && <Share c={c} cloudId={cloudId} owner={owner} signedIn={!!session} meId={session?.user.id} say={say} setLocal={setLocal} />}

      <div className="sr-only" role="status" aria-live="polite">{live}</div>

      <PanelTabs idPrefix="chv" label="Committee" tab={view} setTab={setView}
        tabs={[{ id: "manage", label: "Manage", icon: ICONS.manage }, { id: "minutes", label: "Minutes", icon: ICONS.clock }]} />

      {view === "manage" ? (
        <div id="chv-panel-manage" role="tabpanel" aria-labelledby="chv-tab-manage" className={s.manage}>
          <section className={`panel ${s.floor}`} aria-label="Timer" data-up={state === "up" || undefined}>
            <div className={s.floorMain}>
              <p className={s.tag}>{c.speaker ? "Speaking" : c.timer ? "Timer" : "Floor"}</p>
              <h2 className={`serif ${s.who}`}>{c.timer ? c.timer.label : "No one speaking"}</h2>
              <div className={s.time} data-state={state} role="timer">{ch.clock(left)}</div>
              <p className={s.status}>{state === "up" ? "Time's up" : state === "running" ? "Running" : state === "paused" ? "Paused" : "Pick the next speaker to begin"}</p>
            </div>
            <div className={s.floorControls}>
              <div className={s.bigBtns}>
                {state === "up"
                  ? <button type="button" className="button lg" onClick={() => act(ch.resetTimer)}>Reset time</button>
                  : <button type="button" className="button lg" onClick={toggle} disabled={state === "none"}>{state === "running" ? "Pause" : "Start"}</button>}
                <button type="button" className="button secondary lg" onClick={next} disabled={!c.queue.length && !c.speaker}>{c.queue.length ? "Next speaker" : "Finish speaking"}</button>
              </div>
              <div className={s.nudges}>
                <button type="button" className="button secondary" onClick={() => act((x) => ch.nudgeTimer(x, -15, ch.now()))} disabled={!c.timer} aria-label="Take 15 seconds off">−15s</button>
                <button type="button" className="button secondary" onClick={() => act((x) => ch.nudgeTimer(x, 15, ch.now()))} disabled={!c.timer} aria-label="Add 15 seconds">+15s</button>
                <button type="button" className="button secondary" onClick={() => act(ch.resetTimer)} disabled={!c.timer}>Reset</button>
              </div>
            </div>
            <div className={s.track} aria-hidden="true"><i style={{ width: `${pct}%` }} /></div>
            <div className={s.floorFoot}>
              <CustomTimer onSet={(label, secs) => act((x) => ch.setTimer(x, label, secs))} />
              <p className={`${s.keys} muted`}>Space starts or pauses · N for the next speaker</p>
            </div>
          </section>

          <div className={s.pair}>
            <section className={`panel ${s.list}`} aria-labelledby="ch-list">
              <div className={s.head}>
                <h2 id="ch-list" className={s.h2}>Speakers list</h2>
                <span className="badge">{c.queue.length}</span>
              </div>
              <Duration id="ch-sp" label="Time per speaker" value={c.speakSecs} min={5} max={3600}
                onChange={(secs, ok) => { if (ok && secs !== null) act((x) => ch.setSpeakSecs(x, secs)); }} />
              <div className="field">
                <label htmlFor="ch-add" className="sr-only">Add a speaker</label>
                <select id="ch-add" className="control" value="" onChange={(e) => { if (e.target.value) act((x) => ch.enqueue(x, e.target.value)); }} disabled={!waiting.length}>
                  <option value="">{present === 0 ? "Mark delegates present first" : waiting.length ? "Add a speaker…" : "Everyone present is on the list"}</option>
                  {waiting.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              {c.queue.length ? (
                <ol className={s.queue}>
                  {c.queue.map((q, i) => (
                    <li key={q}>
                      <span className={`${s.pos} num`}>{i + 1}</span>
                      <span className={s.qname}>{ch.nameOf(c, q)}</span>
                      <span className={s.rowBtns}>
                        <IconButton label={`Move ${ch.nameOf(c, q)} up`} icon={ICONS.up} onClick={() => act((x) => ch.shift(x, q, -1))} disabled={i === 0} />
                        <IconButton label={`Move ${ch.nameOf(c, q)} down`} icon={ICONS.down} onClick={() => act((x) => ch.shift(x, q, 1))} disabled={i === c.queue.length - 1} />
                        <IconButton label={`Remove ${ch.nameOf(c, q)} from the list`} icon={ICONS.close} onClick={() => act((x) => ch.unqueue(x, q))} />
                      </span>
                    </li>
                  ))}
                </ol>
              ) : <p className={s.empty}>No one is waiting to speak.</p>}
            </section>

            <section className={`panel ${s.side}`}>
              <PanelTabs idPrefix="ch" label="Committee tools" tab={tab} setTab={setTab}
                tabs={[{ id: "motions", label: "Motions", icon: ICONS.chart }, { id: "roll", label: "Roll call", icon: ICONS.check }]} />
              <div id={`ch-panel-${tab}`} role="tabpanel" aria-labelledby={`ch-tab-${tab}`} className={s.panelBody}>
                {tab === "motions" ? <Motions c={c} act={act} /> : <Roll c={c} act={act} />}
              </div>
            </section>
          </div>
        </div>
      ) : (
        <section id="chv-panel-minutes" role="tabpanel" aria-labelledby="chv-tab-minutes" className={`panel ${s.log}`}>
          <div className={s.head}>
            <h2 className={s.h2}>Minutes</h2>
            <button type="button" className="button secondary" onClick={() => navigator.clipboard?.writeText(ch.minutes(c)).then(() => say("Minutes copied"), () => say("Couldn't copy"))}>Copy minutes</button>
          </div>
          <ol className={s.entries}>
            {[...c.log].reverse().map((e, i) => (
              <li key={`${e.at}-${i}`}><time className="num">{new Date(e.at).toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit", timeZone: "Australia/Sydney" })}</time><span>{e.text}</span></li>
            ))}
          </ol>
        </section>
      )}
      {node}
    </main>
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
            <form className={s.addRow} onSubmit={add}>
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

function CustomTimer({ onSet }: { onSet: (label: string, secs: number) => void }) {
  const [label, setLabel] = useState("");
  const [secs, setSecs] = useState<number | null>(300);
  const [ok, setOk] = useState(true);
  return (
    <form className={s.custom} onSubmit={(e) => { e.preventDefault(); if (ok && secs) onSet(label.trim() || "Timer", secs); }}>
      <div className="field">
        <label htmlFor="ch-tl">Timer for something else</label>
        <input id="ch-tl" className="control" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="What it's for" maxLength={60} />
      </div>
      <Duration id="ch-ct" label="Length" value={300} min={5} max={10800} onChange={(v, good) => { setSecs(v); setOk(good); }} />
      <button type="submit" className="button secondary" disabled={!ok || !secs}>Set timer</button>
    </form>
  );
}

type Act = (fn: (x: Chamber) => Chamber) => void;

function Motions({ c, act }: { c: Chamber; act: Act }) {
  const [title, setTitle] = useState("");
  const [secs, setSecs] = useState<number | null>(null);
  const [okSecs, setOkSecs] = useState(true);
  const [needs, setNeeds] = useState<Majority>("simple");
  const v = c.vote;

  if (v) {
    const would = ch.passes(v);
    const present = ch.presentCount(c);
    const cast = v.yes + v.no + v.abstain;
    return (
      <div className={s.vote}>
        <div>
          <p className={s.tag}>{MAJORITY[v.needs]}</p>
          <h3 className={`serif ${s.motion}`}>{v.title}</h3>
          {v.secs ? <p className="muted">Sets a {ch.clock(v.secs * 1000)} timer if it passes.</p> : null}
        </div>
        <div className={s.counters}>
          {([["yes", "For"], ["no", "Against"], ["abstain", "Abstain"]] as const).map(([k, name]) => (
            <div key={k} className={s.counter} data-kind={k}>
              <span className={s.cname}>{name}</span>
              <output className={`${s.count} num`} aria-live="polite">{v[k]}</output>
              <div className={s.step}>
                <button type="button" className="button secondary" onClick={() => act((x) => ch.tally(x, k, -1))} aria-label={`One fewer ${name.toLowerCase()}`} disabled={!v[k]}>−</button>
                <button type="button" className="button secondary" onClick={() => act((x) => ch.tally(x, k, 1))} aria-label={`One more ${name.toLowerCase()}`}>+</button>
              </div>
            </div>
          ))}
        </div>
        <p className={s.hint}>
          {cast} of {present} present have voted. Abstentions aren&apos;t counted towards the majority. {cast ? <strong data-pass={would}>{would ? "Would pass" : "Would fail"}</strong> : null}
        </p>
        <div className="btnStack">
          <button type="button" className="button" onClick={() => act(ch.decide)}>Record result</button>
          <button type="button" className="button secondary" onClick={() => act(ch.dropVote)}>Withdraw</button>
        </div>
      </div>
    );
  }

  return (
    <form className={s.motionForm} onSubmit={(e) => { e.preventDefault(); if (!title.trim() || !okSecs) return; act((x) => ch.openVote(x, title, needs, secs)); setTitle(""); }}>
      {c.result && (
        <p className={s.result} data-pass={c.result.passed}>
          <strong>{c.result.title}</strong> {c.result.passed ? "passed" : "failed"}: {c.result.yes} for, {c.result.no} against, {c.result.abstain} abstaining.
        </p>
      )}
      <div className="field">
        <label htmlFor="ch-mt">Motion</label>
        <input id="ch-mt" className="control" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} placeholder="What is being moved" />
      </div>
      <Duration id="ch-mm" label="Timer if it passes (optional)" value={null} min={5} max={10800} optional onChange={(v, ok) => { setSecs(v); setOkSecs(ok); }} />
      <div className="field">
        <label htmlFor="ch-mn">Needs</label>
        <select id="ch-mn" className="control" value={needs} onChange={(e) => setNeeds(e.target.value as Majority)}>
          <option value="simple">Simple majority</option>
          <option value="twoThirds">Two-thirds majority</option>
        </select>
      </div>
      <button type="submit" className="button block" disabled={!title.trim() || !okSecs}>Put to a vote</button>
    </form>
  );
}

function Roll({ c, act }: { c: Chamber; act: Act }) {
  const [name, setName] = useState("");
  const [edit, setEdit] = useState(false);
  const present = ch.presentCount(c);
  return (
    <div className={s.roll}>
      <div className={s.head}>
        <p className={s.rollCount}><strong className="num">{present}</strong> of {c.delegates.length} present</p>
        <button type="button" className="button secondary" onClick={() => setEdit((e) => !e)} aria-pressed={edit}>{edit ? "Done" : "Edit list"}</button>
      </div>
      <div className="btnStack">
        <button type="button" className="button secondary" onClick={() => act((x) => ch.setAllPresent(x, true))}>All present</button>
        <button type="button" className="button secondary" onClick={() => act((x) => ch.setAllPresent(x, false))}>Clear</button>
      </div>
      {c.delegates.length ? (
        <ul className={s.tiles}>
          {c.delegates.map((d) => (
            <li key={d.id}>
              <button type="button" className={s.tile} aria-pressed={d.present} onClick={() => act((x) => ch.setPresent(x, d.id, !d.present))}>
                <span className={s.tick} aria-hidden="true">{d.present && ICONS.check}</span>
                <span className={s.tname}>{d.name}</span>
              </button>
              {edit && <IconButton label={`Remove ${d.name}`} icon={ICONS.close} onClick={() => act((x) => ch.removeDelegate(x, d.id))} />}
            </li>
          ))}
        </ul>
      ) : <p className={s.empty}>No delegates yet. Add them below.</p>}
      <form className={s.addRow} onSubmit={(e) => { e.preventDefault(); act((x) => ch.addDelegate(x, name)); setName(""); }}>
        <label htmlFor="ch-nd" className="sr-only">Add a delegate</label>
        <input id="ch-nd" className="control" value={name} onChange={(e) => setName(e.target.value)} placeholder="Add a delegate" maxLength={60} />
        <button type="submit" className="button secondary" disabled={!name.trim()}>Add</button>
      </form>
    </div>
  );
}

type Mine = { id: string; name: string; is_owner: boolean; owner_name: string };

function Setup({ onCreate, signedIn }: { onCreate: (c: Chamber) => void; signedIn: boolean }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [topic, setTopic] = useState("");
  const [speak, setSpeak] = useState<number | null>(90);
  const [speakOk, setSpeakOk] = useState(true);
  const [text, setText] = useState("");
  const [mine, setMine] = useState<Mine[]>([]);
  const names = ch.parseNames(text);
  const ok = name.trim().length >= 2 && speakOk && speak !== null && names.length > 0;

  useEffect(() => {
    if (!signedIn || !supabase) return;
    let live = true;
    supabase.rpc("my_chambers").then(({ data }) => { if (live) setMine((data as Mine[] | null) ?? []); });
    return () => { live = false; };
  }, [signedIn]);

  return (
    <main id="top" className={`container ${s.setup}`}>
      <PageBand title="Chambers" lead="Roll call, speakers list, timer and votes on one screen, with a display for the projector." />
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
        <form className={`panel ${s.setupCard}`} onSubmit={(e) => { e.preventDefault(); if (ok && speak !== null) onCreate(ch.create(name, topic, speak, names)); }}>
          <div className={s.two}>
            <div className="field">
              <label htmlFor="cs-name">Committee</label>
              <input id="cs-name" className="control" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required />
            </div>
            <Duration id="cs-sp" label="Speaking time" value={90} min={5} max={3600} onChange={(v, good) => { setSpeak(v); setSpeakOk(good); }} />
          </div>
          <div className="field">
            <label htmlFor="cs-topic">Topic <span className="muted">(optional)</span></label>
            <input id="cs-topic" className="control" value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={160} />
          </div>
          <div className="field">
            <label htmlFor="cs-names">Delegations</label>
            <textarea id="cs-names" className="control" value={text} onChange={(e) => setText(e.target.value)} rows={8} placeholder="One per line, or separated by commas" />
            {names.length > 0 && <small>{names.length} {names.length === 1 ? "delegation" : "delegations"}</small>}
          </div>
          <button type="submit" className="button lg block" disabled={!ok}>Open Committee</button>
          <p className={`${s.keys} muted`}>It is saved in this browser until you share it with other chairs.</p>
        </form>
      </div>
    </main>
  );
}
