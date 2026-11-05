"use client";

import { useEffect, useRef, useState } from "react";
import * as ch from "@/lib/chamber";
import type { Chamber, Majority } from "@/lib/chamber";
import IconButton, { ConfirmIconButton, ICONS } from "./IconButton";
import PageBand from "./PageBand";
import PanelTabs from "./PanelTabs";
import { useToast } from "./useToast";
import s from "./Chambers.module.css";

// The time left, redrawn a few times a second while a timer is running and not at all otherwise.
export function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) { setNow(Date.now()); return; }
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, [active]);
  return now;
}

const MAJORITY: Record<Majority, string> = { simple: "Simple majority", twoThirds: "Two-thirds majority" };

export default function Chambers() {
  const [c, setC] = useState<Chamber | null>(null);
  const [ready, setReady] = useState(false);
  const [live, setLive] = useState("");
  const [tab, setTab] = useState<"motions" | "roll">("motions");
  const { say, node } = useToast();

  useEffect(() => { setC(ch.load()); setReady(true); }, []);
  useEffect(() => { if (ready) ch.save(c); }, [c, ready]);

  const act = (fn: (x: Chamber) => Chamber) => setC((p) => (p ? fn(p) : p));
  const now = useNow(ch.running(c?.timer ?? null));
  const left = c?.timer ? ch.remaining(c.timer, now) : 0;
  const state = !c?.timer ? "none" : left === 0 ? "up" : c.timer.endsAt !== null ? "running" : "paused";

  // A timer that reaches zero stops there, so the saved copy (and the display) agree it is over.
  useEffect(() => {
    if (state !== "up" || !c?.timer || c.timer.endsAt === null) return;
    setC((p) => (p ? ch.pauseTimer(p, Date.now()) : p));
    setLive("Time's up");
  }, [state, c?.timer]);

  const toggle = () => act((x) => (ch.running(x.timer) ? ch.pauseTimer(x, Date.now()) : ch.startTimer(x, Date.now())));
  const next = () => {
    if (!c) return;
    const after = ch.nextSpeaker(c);
    setC(after);
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

  if (!ready) return <main id="top" className="container" />;
  if (!c) return <Setup onCreate={(x) => { setC(x); setTab("roll"); say("Committee opened"); }} />;

  const present = ch.presentCount(c);
  const waiting = c.delegates.filter((d) => d.present && !c.queue.includes(d.id) && c.speaker !== d.id);
  const pct = c.timer ? Math.min(100, (left / c.timer.total) * 100) : 0;

  return (
    <main id="top" className={`container ${s.page}`}>
      <header className={s.top}>
        <div className={s.topText}>
          <h1 className={`serif ${s.name}`}>{c.name}</h1>
          <p className={s.topic}>{c.topic || `${present} of ${c.delegates.length} present`}{c.topic && ` · ${present} of ${c.delegates.length} present`}</p>
        </div>
        <div className={s.topActions}>
          <a className="button secondary" href="/chambers/display" target="_blank" rel="noopener">Open display</a>
          <button type="button" className="button secondary" onClick={() => navigator.clipboard?.writeText(ch.minutes(c)).then(() => say("Minutes copied"), () => say("Couldn't copy"))}>Copy minutes</button>
          <ConfirmIconButton label="Close this committee" confirm="Click again to clear it" icon={ICONS.trash} onConfirm={() => { setC(null); ch.save(null); }} />
        </div>
      </header>

      <div className="sr-only" role="status" aria-live="polite">{live}</div>

      <div className={s.grid}>
        <section className={`panel ${s.floor}`} aria-label="Floor">
          <p className={s.tag}>{c.speaker ? "Speaking" : c.timer ? "Timer" : "Floor"}</p>
          <h2 className={`serif ${s.who}`}>{c.timer ? c.timer.label : "No one speaking"}</h2>
          <div className={s.time} data-state={state} role="timer">{ch.clock(left)}</div>
          <div className={s.track} aria-hidden="true"><i style={{ width: `${pct}%` }} /></div>
          <p className={s.status}>{state === "up" ? "Time's up" : state === "running" ? "Running" : state === "paused" ? "Paused" : "Pick the next speaker to begin"}</p>

          <div className="btnStack">
            {state === "up"
              ? <button type="button" className="button lg" onClick={() => act(ch.resetTimer)}>Reset time</button>
              : <button type="button" className="button lg" onClick={toggle} disabled={state === "none"}>{state === "running" ? "Pause" : "Start"}</button>}
            <button type="button" className="button secondary lg" onClick={next} disabled={!c.queue.length && !c.speaker}>{c.queue.length ? "Next speaker" : "Finish speaking"}</button>
          </div>
          <div className={s.nudges}>
            <button type="button" className="button secondary" onClick={() => act((x) => ch.nudgeTimer(x, -15, Date.now()))} disabled={!c.timer} aria-label="Take 15 seconds off">−15s</button>
            <button type="button" className="button secondary" onClick={() => act((x) => ch.nudgeTimer(x, 15, Date.now()))} disabled={!c.timer} aria-label="Add 15 seconds">+15s</button>
            <button type="button" className="button secondary" onClick={() => act(ch.resetTimer)} disabled={!c.timer}>Reset</button>
          </div>
          <CustomTimer onSet={(label, secs) => act((x) => ch.setTimer(x, label, secs))} />
          <p className={`${s.keys} muted`}>Space starts or pauses · N for the next speaker</p>
        </section>

        <section className={`panel ${s.list}`} aria-labelledby="ch-list">
          <div className={s.head}>
            <h2 id="ch-list" className={s.h2}>Speakers list</h2>
            <span className="badge">{c.queue.length}</span>
          </div>
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

        <section className={`panel ${s.log}`} aria-labelledby="ch-log">
          <h2 id="ch-log" className={s.h2}>Minutes</h2>
          <ol className={s.entries}>
            {[...c.log].reverse().map((e, i) => (
              <li key={`${e.at}-${i}`}><time className="num">{new Date(e.at).toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit", timeZone: "Australia/Sydney" })}</time><span>{e.text}</span></li>
            ))}
          </ol>
        </section>
      </div>
      {node}
    </main>
  );
}

function CustomTimer({ onSet }: { onSet: (label: string, secs: number) => void }) {
  const [label, setLabel] = useState("");
  const [mins, setMins] = useState("5");
  const secs = Math.round(Number(mins) * 60);
  const ok = secs >= 5 && secs <= 3 * 60 * 60;
  return (
    <form className={s.custom} onSubmit={(e) => { e.preventDefault(); if (ok) onSet(label.trim() || "Timer", secs); }}>
      <div className="field">
        <label htmlFor="ch-tl">Timer for something else</label>
        <div className={s.customRow}>
          <input id="ch-tl" className="control" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="What it's for" maxLength={60} />
          <input className="control" inputMode="decimal" value={mins} onChange={(e) => setMins(e.target.value)} aria-label="Minutes" />
          <button type="submit" className="button secondary" disabled={!ok}>Set</button>
        </div>
      </div>
    </form>
  );
}

type Act = (fn: (x: Chamber) => Chamber) => void;

function Motions({ c, act }: { c: Chamber; act: Act }) {
  const [title, setTitle] = useState("");
  const [mins, setMins] = useState("");
  const [needs, setNeeds] = useState<Majority>("simple");
  const v = c.vote;
  const minutes = mins.trim() ? Number(mins) : null;
  const okMins = minutes === null || (Number.isFinite(minutes) && minutes > 0 && minutes <= 180);

  if (v) {
    const would = ch.passes(v);
    const present = ch.presentCount(c);
    const cast = v.yes + v.no + v.abstain;
    return (
      <div className={s.vote}>
        <div>
          <p className={s.tag}>{MAJORITY[v.needs]}</p>
          <h3 className={`serif ${s.motion}`}>{v.title}</h3>
          {v.minutes && <p className="muted">Sets a {v.minutes}-minute timer if it passes.</p>}
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
    <form className={s.motionForm} onSubmit={(e) => { e.preventDefault(); if (!title.trim() || !okMins) return; act((x) => ch.openVote(x, title, needs, minutes)); setTitle(""); setMins(""); }}>
      {c.result && (
        <p className={s.result} data-pass={c.result.passed}>
          <strong>{c.result.title}</strong> {c.result.passed ? "passed" : "failed"}: {c.result.yes} for, {c.result.no} against, {c.result.abstain} abstaining.
        </p>
      )}
      <div className="field">
        <label htmlFor="ch-mt">Motion</label>
        <input id="ch-mt" className="control" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} placeholder="What is being moved" />
      </div>
      <div className={s.two}>
        <div className="field">
          <label htmlFor="ch-mm">Minutes</label>
          <input id="ch-mm" className="control" inputMode="decimal" value={mins} onChange={(e) => setMins(e.target.value)} placeholder="Optional" aria-invalid={!okMins} />
          <small>If it passes, starts a timer this long.</small>
        </div>
        <div className="field">
          <label htmlFor="ch-mn">Needs</label>
          <select id="ch-mn" className="control" value={needs} onChange={(e) => setNeeds(e.target.value as Majority)}>
            <option value="simple">Simple majority</option>
            <option value="twoThirds">Two-thirds majority</option>
          </select>
        </div>
      </div>
      <button type="submit" className="button block" disabled={!title.trim() || !okMins}>Put to a vote</button>
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

function Setup({ onCreate }: { onCreate: (c: Chamber) => void }) {
  const [name, setName] = useState("");
  const [topic, setTopic] = useState("");
  const [secs, setSecs] = useState("90");
  const [text, setText] = useState("");
  const names = ch.parseNames(text);
  const speak = Math.round(Number(secs));
  const ok = name.trim().length >= 2 && speak >= 10 && speak <= 600 && names.length > 0;
  return (
    <main id="top" className={`container ${s.setup}`}>
      <PageBand title="Chambers" lead="Roll call, speakers list, timer and votes on one screen, with a display for the projector." />
      <form className={`panel ${s.setupCard}`} onSubmit={(e) => { e.preventDefault(); if (ok) onCreate(ch.create(name, topic, speak, names)); }}>
        <div className={s.two}>
          <div className="field">
            <label htmlFor="cs-name">Committee</label>
            <input id="cs-name" className="control" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required />
          </div>
          <div className="field">
            <label htmlFor="cs-secs">Speaking time (seconds)</label>
            <input id="cs-secs" className="control" inputMode="numeric" value={secs} onChange={(e) => setSecs(e.target.value)} />
            <small>You can change the time for any speaker as they begin.</small>
          </div>
        </div>
        <div className="field">
          <label htmlFor="cs-topic">Topic <span className="muted">(optional)</span></label>
          <input id="cs-topic" className="control" value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={160} />
        </div>
        <div className="field">
          <label htmlFor="cs-names">Delegations</label>
          <textarea id="cs-names" className="control" value={text} onChange={(e) => setText(e.target.value)} rows={8} placeholder="One per line, or separated by commas" />
          <small>{names.length ? `${names.length} ${names.length === 1 ? "delegation" : "delegations"}` : "Paste the list from your spreadsheet."}</small>
        </div>
        <button type="submit" className="button lg block" disabled={!ok}>Open committee</button>
        <p className={`${s.keys} muted`}>This committee is saved in this browser only. The display window has to be open on the same computer.</p>
      </form>
    </main>
  );
}
