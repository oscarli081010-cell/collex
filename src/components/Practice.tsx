"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import Flag from "./Flag";
import h from "./Hub.module.css";
import rs from "./Roles.module.css";
import p from "./Practice.module.css";

// Speech practice: a kind of speech, a random topic and country, and a timer. Everything stays in this browser; the
// only thing kept is how many practices were finished this week (localStorage, "collex:practice").

export const TOPICS = [
  "Access to clean water and sanitation", "Plastic pollution in the oceans", "Rising sea levels and Pacific island nations",
  "Girls’ access to education", "People displaced by climate change", "Rules for artificial intelligence",
  "Cyber attacks on hospitals and power grids", "Food security and preventing famine", "Fair access to vaccines",
  "Antimicrobial resistance", "Child labour in global supply chains", "Protecting cultural heritage during conflict",
  "Space debris and the peaceful use of outer space", "Nuclear disarmament", "Clearing landmines after conflict",
  "Ending the use of child soldiers", "Human trafficking", "Safety of journalists and freedom of the press",
  "Rights of Indigenous peoples", "Deforestation of tropical rainforests", "Overfishing and marine biodiversity",
  "Access to affordable clean energy", "Air pollution in cities", "Mental health of young people",
  "Misinformation on social media", "Internet access in developing countries", "Protecting civilians in armed conflict",
  "The future of UN peacekeeping", "The illegal trade in small arms", "Desertification and drought",
  "Sharing water from rivers that cross borders", "Debt relief for developing countries", "Gender equality at work",
  "Ending extreme poverty", "Rights of people with disabilities", "Stateless people", "Electronic waste",
  "Preparing for the next pandemic", "Reducing the risk of natural disasters", "Protecting Antarctica",
  "Ocean acidification and coral reefs", "Rights of migrant workers", "Youth unemployment", "Road safety",
  "Sustainable tourism",
];

export const COUNTRIES = [
  "Argentina", "Australia", "Bangladesh", "Brazil", "Canada", "Chile", "China", "Colombia", "Cuba", "Denmark",
  "Egypt", "Ethiopia", "Fiji", "Finland", "France", "Germany", "Ghana", "Greece", "India", "Indonesia",
  "Iran", "Ireland", "Italy", "Jamaica", "Japan", "Jordan", "Kenya", "Malaysia", "Maldives", "Mexico",
  "Morocco", "Nepal", "Netherlands", "New Zealand", "Nigeria", "Norway", "Pakistan", "Papua New Guinea", "Peru", "Philippines",
  "Poland", "Qatar", "Russia", "Rwanda", "Samoa", "Saudi Arabia", "Singapore", "South Africa", "South Korea", "Spain",
  "Sweden", "Switzerland", "Thailand", "Tonga", "Türkiye", "Ukraine", "United Arab Emirates", "United Kingdom", "United States", "Uruguay",
  "Vietnam",
];

// The question or accusation a reply answers. {t} is the topic.
const POI = [
  "How would your country pay for its plan on {t}?",
  "Can you name one country that supports your position on {t}?",
  "Why should countries not affected by {t} support your proposal?",
  "What has your own country done about {t} so far?",
  "Who would check that countries keep to your plan on {t}?",
];
const REPLY = [
  "Another delegate said your country has done nothing about {t}.",
  "Another delegate said your country’s plan on {t} would cost poorer countries too much.",
  "Another delegate said your country is only pretending to care about {t}.",
  "Another delegate said your country caused the problem of {t}.",
];

const KINDS = [
  { id: "opening", label: "60-Second Opening Speech", seconds: 60, how: "Give your country’s opening speech on this topic." },
  { id: "poi", label: "Point of Information Reply", seconds: 30, how: "Answer this point of information, as your country." },
  { id: "reply", label: "30-Second Right of Reply", seconds: 30, how: "Reply to this, as your country, politely and briefly." },
] as const;
type Kind = (typeof KINDS)[number]["id"];

const CHECKS = ["Stated your country’s position", "Gave one fact", "Made one proposal", "Finished on time"];
const LEAD = 3;
const KEY = "collex:practice";

type Prompt = { topic: string; country: string; line: string | null };
type Phase = "ready" | "lead" | "running" | "paused" | "done";

const pick = <T,>(xs: readonly T[]) => xs[Math.floor(Math.random() * xs.length)];
function newPrompt(kind: Kind): Prompt {
  const topic = pick(TOPICS);
  const lower = topic.charAt(0).toLowerCase() + topic.slice(1);
  const line = kind === "poi" ? pick(POI).replace("{t}", lower) : kind === "reply" ? pick(REPLY).replace("{t}", lower) : null;
  return { topic, country: pick(COUNTRIES), line };
}

// This week starts on Monday, in this browser's time.
function weekOf(d = new Date()) {
  const m = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));
  return `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}-${String(m.getDate()).padStart(2, "0")}`;
}
function readCount(): number {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null") as { week?: string; count?: number } | null;
    return v && v.week === weekOf() && typeof v.count === "number" ? v.count : 0;
  } catch { return 0; }
}
function addOne(): number {
  const n = readCount() + 1;
  try { localStorage.setItem(KEY, JSON.stringify({ week: weekOf(), count: n })); } catch { /* storage blocked: the count just isn't kept */ }
  return n;
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export default function Practice() {
  const [kind, setKind] = useState<Kind>("opening");
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [phase, setPhase] = useState<Phase>("ready");
  const [left, setLeft] = useState(60); // seconds, shown
  const [lead, setLead] = useState(LEAD);
  const [count, setCount] = useState<number | null>(null);
  const [say, setSay] = useState(""); // what a screen reader hears: only the moments that matter, not every second
  const endAt = useRef(0);
  const remaining = useRef(60_000);
  const spoken = useRef(0); // the last whole second announced, so each warning is said once
  const counted = useRef(false); // this run has been added to the week's count
  const seconds = KINDS.find((k) => k.id === kind)!.seconds;

  // Chosen after the page loads, so the server and the browser draw the same first frame.
  useEffect(() => { setPrompt(newPrompt("opening")); setCount(readCount()); }, []);

  const reset = useCallback((k: Kind = kind) => {
    const s = KINDS.find((x) => x.id === k)!.seconds;
    setPhase("ready"); setLeft(s); setLead(LEAD); remaining.current = s * 1000; setSay("");
  }, [kind]);

  const choose = (k: Kind) => { setKind(k); setPrompt(newPrompt(k)); reset(k); };
  const another = () => { setPrompt(newPrompt(kind)); reset(); };

  const finish = useCallback(() => {
    setPhase("done"); setLeft(0); setSay("Time. Check your speech against the list.");
    if (!counted.current) { counted.current = true; setCount(addOne()); }
  }, []);

  // The lead-in: 3, 2, 1, then the speech starts.
  useEffect(() => {
    if (phase !== "lead") return;
    if (lead === 0) {
      endAt.current = Date.now() + remaining.current;
      setPhase("running"); setSay(`Go. ${seconds} seconds.`);
      return;
    }
    setSay(String(lead));
    const t = setTimeout(() => setLead((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, lead, seconds]);

  // The speech: worked out from the clock, so a slow tab never makes the timer drift.
  useEffect(() => {
    if (phase !== "running") return;
    const tick = () => {
      const ms = Math.max(0, endAt.current - Date.now());
      remaining.current = ms;
      const s = Math.ceil(ms / 1000);
      setLeft(s);
      if ((s === 30 || s === 10) && s < seconds && spoken.current !== s) { spoken.current = s; setSay(`${s} seconds left`); }
      if (ms <= 0) finish();
    };
    tick();
    const t = setInterval(tick, 200);
    return () => clearInterval(t);
  }, [phase, seconds, finish]);

  const start = () => { counted.current = false; spoken.current = 0; remaining.current = seconds * 1000; setLeft(seconds); setLead(LEAD); setPhase("lead"); };
  const pause = () => { remaining.current = Math.max(0, endAt.current - Date.now()); setPhase("paused"); setSay("Paused"); };
  const resume = () => { endAt.current = Date.now() + remaining.current; setPhase("running"); setSay("Resumed"); };

  const k = KINDS.find((x) => x.id === kind)!;
  const busy = phase === "lead" || phase === "running";
  const shownTime = phase === "lead" ? String(lead || "Go") : mmss(left);
  const used = seconds - left;
  const pct = phase === "ready" || phase === "lead" ? 0 : Math.min(100, (used / seconds) * 100);

  return (
    <div className={p.wrap}>
      <section className={`panel ${p.card}`} aria-labelledby="pr-kind">
        <h2 id="pr-kind" className={h.h2}>Kind of speech</h2>
        <div className={rs.chips} role="group" aria-label="Kind of speech">
          {KINDS.map((x) => (
            busy
              ? <span key={x.id} className="tip" data-tip="Pause or finish the timer first" data-tip-align="start"><button type="button" className={rs.chip} aria-pressed={kind === x.id} disabled>{x.label}</button></span>
              : <button key={x.id} type="button" className={rs.chip} aria-pressed={kind === x.id} onClick={() => choose(x.id)}>{x.label}</button>
          ))}
        </div>
      </section>

      <section className={`panel ${p.card}`} aria-labelledby="pr-prompt">
        <h2 id="pr-prompt" className={h.h2}>Your prompt</h2>
        <p className={p.how}>{k.how}</p>
        <dl className={p.prompt}>
          <div><dt>Country</dt><dd className={p.big}>{prompt ? <><Flag name={prompt.country} size={28} />{prompt.country}</> : " "}</dd></div>
          <div><dt>Topic</dt><dd className={p.big}>{prompt?.topic ?? " "}</dd></div>
          {prompt?.line && <div><dt>{kind === "poi" ? "The question" : "What was said"}</dt><dd className={p.line}>&ldquo;{prompt.line}&rdquo;</dd></div>}
        </dl>
        {busy
          ? <span className="tip" data-tip="Pause or finish the timer first" data-tip-align="start" style={{ display: "flex" }}><button type="button" className="button secondary block" disabled>Another Topic</button></span>
          : <button type="button" className="button secondary block" onClick={another}>Another Topic</button>}
      </section>

      <section className={`panel ${p.card}`} aria-labelledby="pr-timer">
        <h2 id="pr-timer" className={h.h2}>Timer</h2>
        <div className={p.clock} role="timer" aria-label={phase === "lead" ? `Starting in ${lead}` : `${left} seconds left`} data-phase={phase} data-low={phase === "running" && left <= 10 ? "" : undefined}>{shownTime}</div>
        <div className={p.bar} aria-hidden="true"><span style={{ width: `${pct}%` }} /></div>
        <p className="sr-only" aria-live="assertive">{say}</p>
        <div className={h.btnRow}>
          {phase === "ready" && <button type="button" className="button block" onClick={start} disabled={!prompt}>Start</button>}
          {phase === "lead" && <button type="button" className="button block" onClick={() => reset()}>Cancel</button>}
          {phase === "running" && <button type="button" className="button block" onClick={pause}>Pause</button>}
          {phase === "running" && <button type="button" className="button secondary block" onClick={finish}>Finish Early</button>}
          {phase === "paused" && <button type="button" className="button block" onClick={resume}>Resume</button>}
          {(phase === "paused" || phase === "done") && <button type="button" className="button secondary block" onClick={() => reset()}>Restart</button>}
        </div>
      </section>

      {phase === "done" && (
        <section className={`panel ${p.card}`} aria-labelledby="pr-check">
          <h2 id="pr-check" className={h.h2}>Check your speech</h2>
          <p className={p.how}>Tick what you did. Nothing is saved.</p>
          <div className={p.checks}>
            {CHECKS.map((c) => <label key={c} className="check"><input type="checkbox" /><span>{c}</span></label>)}
          </div>
          <button type="button" className="button block" onClick={another}>Another Topic</button>
        </section>
      )}

      <p className={p.count} role="status">
        {count === null ? " " : count === 0 ? "No practices finished this week yet." : `${count} ${count === 1 ? "practice" : "practices"} finished this week.`}
        {" "}Kept only in this browser. For help with the speech itself, read <Link href="/guides/public-speaking" className="link">Public speaking and your first speech</Link>.
      </p>
    </div>
  );
}
