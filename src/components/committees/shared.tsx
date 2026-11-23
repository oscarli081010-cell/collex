"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import * as ch from "@/lib/chamber";
import type { Chamber, Side } from "@/lib/chamber";
import { usePill } from "../usePill";
import IconButton, { ICONS } from "../IconButton";
import { Why } from "../RoomChair";
import s from "../Chambers.module.css";

const svg = (d: React.ReactNode) => <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>;
export const MONITOR = svg(<><rect x="1.8" y="2.5" width="12.4" height="8.5" rx="1.6" /><path d="M5.5 13.5h5M8 11v2.5" /></>);
export const SLIDERS = svg(<><path d="M2.5 4.5h6.5M12 4.5h1.5M2.5 11.5h1.5M7 11.5h6.5" /><circle cx="10.5" cy="4.5" r="1.6" /><circle cx="5.5" cy="11.5" r="1.6" /></>);
export const COPY = svg(<><rect x="5.5" y="5.5" width="8" height="8" rx="1.6" /><path d="M10.5 3.5V3a1 1 0 00-1-1H3.5a1 1 0 00-1 1v6a1 1 0 001 1H4" /></>);
const BACK = svg(<path d="M6.5 3L2.5 7l4 4M2.5 7H10a3.5 3.5 0 010 7H7" />);
export const LEFT = svg(<path d="M7 3.5L2.5 8 7 12.5M2.5 8h11" />);
export const STACK = svg(<><rect x="2.5" y="6" width="11" height="7.5" rx="1.6" /><path d="M4 3.8h8M5.5 1.8h5" /></>);
export const SWAP = svg(<path d="M3 5.5h9.5M10 3l2.5 2.5L10 8M13 10.5H3.5M6 8l-2.5 2.5L6 13" />);

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

export const uid = () => crypto.randomUUID();

// A short two-note chime when a speaker's time is up. It is this device's own setting, on unless the chair turns it off.
export const SOUND_KEY = "collex:chamber-sound";
export const soundOn = () => { try { return localStorage.getItem(SOUND_KEY) !== "off"; } catch { return true; } };
let audio: AudioContext | null = null;
export function chime(force = false) {
  if (!force && !soundOn()) return;
  try {
    audio ??= new AudioContext();
    const ctx = audio;
    if (ctx.state === "suspended") void ctx.resume();
    [[880, 0], [660, 0.22]].forEach(([hz, at]) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "sine"; o.frequency.value = hz;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + at);
      g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + at + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + 0.45);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + at); o.stop(ctx.currentTime + at + 0.5);
    });
  } catch { /* no sound on this device */ }
}
export const SIDE: Record<Side, string> = { for: "In Favour", against: "Against" };
export type Act = (fn: (x: Chamber) => Chamber, track?: boolean) => Promise<boolean> | void;
// Who this chair is, and the console's toast, for Back: a chair's Back only takes back their own step.
export const BackCtx = createContext<{ me: () => string | undefined; say: (t: string) => void }>({ me: () => undefined, say: () => {} });

// A length of time as minutes and seconds. `value` is the total in seconds; `onChange` hears the total (null when both
// boxes are empty) and whether it is allowed. The boxes only follow `value` when it changes from outside.
export function Duration({ id, label, value, onChange, min, max, optional }: {
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

/* One step back: the last thing the chair did is undone. It lives in the panel it acts on, as an arrow. */
export function Undo({ c, act }: { c: Chamber; act: Act }) {
  const { me, say } = useContext(BackCtx);
  const can = ch.canGoBack(c);
  const what = ch.backWhat(c);
  const others = can && ch.backIsOthers(c, me());
  const label = !can ? "Nothing to go back to yet" : others ? ch.BACK_OTHERS : what ? `Back: undo ${what}` : "Back one step";
  const back = async () => {
    // Another chair's step is never taken back (and if one arrives just before this click, goBack does nothing).
    if (ch.backIsOthers(c, me())) { say(ch.BACK_OTHERS); return; }
    await act((x) => ch.goBack(x, ch.now(), me()), false);
  };
  return (
    <span className={`tip ${s.undo}`} data-tip={`${label} (Ctrl or ⌘ Z)`} data-tip-align="start">
      <button type="button" className="button secondary iconbtn" aria-label={label} aria-keyshortcuts="Control+Z Meta+Z" disabled={!can} onClick={() => void back()}>{BACK}</button>
    </span>
  );
}

// Two or three choices in one pill, with a highlight that slides to the one picked like every other tab control on the site.
export function Seg<T extends string>({ items, value, onPick, label, className, disabled }: {
  items: { id: T; label: string; off?: boolean; why?: string }[]; value: T | null | undefined; onPick: (id: T) => void; label: string; className?: string; disabled?: boolean;
}) {
  const box = useRef<HTMLDivElement>(null);
  const pill = usePill(box, '[aria-pressed="true"]', value ?? "");
  return (
    <div ref={box} className={`${s.seg3} ${className ?? ""}`} role="group" aria-label={label}>
      <span ref={pill} className={`t-pill ${s.segPill}`} aria-hidden="true" />
      {items.map((i) => {
        const b = <button key={i.id} type="button" data-v={i.id} aria-pressed={value === i.id} disabled={disabled || i.off} onClick={() => onPick(i.id)}>{i.label}</button>;
        return i.off && i.why && !disabled ? <Why key={i.id} why={i.why}>{b}</Why> : b;
      })}
    </div>
  );
}

export function SideSwitch({ side, setSide }: { side: Side; setSide: (s: Side) => void }) {
  return <Seg label="Side" value={side} onPick={setSide} className={s.sideSeg} items={[{ id: "for", label: SIDE.for }, { id: "against", label: SIDE.against }]} />;
}

/* Figures, the same everywhere: a big number over its label, and a bar of how they split. */
type Stat = { label: string; value: number; tone?: "ok" | "bad" | "warn" | "accent" };
export function Stats({ items, bar, label }: { items: Stat[]; bar?: boolean; label: string }) {
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

/** The tag and the two arrows at the top right of a queued card, the same on an amendment and a motion. */
export function CardSide({ next, tag, first, last, label, move }: { next?: boolean; tag?: string; first: boolean; last: boolean; label: string; move: (by: -1 | 1) => void }) {
  return (
    <span className={s.cardSide}>
      {next && <span className={s.nextTag}>{tag ?? "Next"}</span>}
      <IconButton label={`Move ${label} up`} tip={first ? "Already first" : undefined} icon={ICONS.up} disabled={first} onClick={() => move(-1)} />
      <IconButton label={`Move ${label} down`} tip={last ? "Already last" : undefined} icon={ICONS.down} disabled={last} onClick={() => move(1)} />
    </span>
  );
}
