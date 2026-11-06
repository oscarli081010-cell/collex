// The state of one committee in Chambers, and everything a chair can do to it. Every function takes the
// committee and returns the next one, so the console is just buttons calling these. The committee lives in this
// browser (localStorage); the display window reads the same copy, so nothing here touches the network.

export type Delegate = { id: string; name: string; present: boolean };
// Times are milliseconds. A running timer has `endsAt`; a paused one keeps what is left in `left`. The time on screen
// is always worked out from the clock, never counted down, so a throttled background tab can't drift.
export type Timer = { label: string; total: number; endsAt: number | null; left: number };
export type Majority = "simple" | "twoThirds";
export type Vote = { title: string; needs: Majority; secs: number | null; yes: number; no: number; abstain: number };
export type Result = { title: string; needs: Majority; yes: number; no: number; abstain: number; passed: boolean };
export type Entry = { at: number; text: string };

export type Chamber = {
  v: 1;
  name: string;
  topic: string;
  /** Default time for one speaker, in seconds. */
  speakSecs: number;
  delegates: Delegate[];
  /** Delegate ids waiting to speak, first in line first. */
  queue: string[];
  speaker: string | null;
  timer: Timer | null;
  vote: Vote | null;
  /** The last vote's outcome, kept so the display can show it until the next thing starts. */
  result: Result | null;
  log: Entry[];
};

export const KEY = "collex:chamber";
export const MAX_DELEGATES = 200;

// Devices sharing a committee may disagree about the time. Whenever one hears from the database it learns how far its
// clock is out, and every timestamp it writes or reads goes through now() so all of them count from the same moment.
let skew = 0;
export const setSkew = (ms: number) => { skew = ms; };
export const now = () => Date.now() + skew;

export const remaining = (t: Timer, now: number) => (t.endsAt === null ? t.left : Math.max(0, t.endsAt - now));
export const running = (t: Timer | null) => !!t && t.endsAt !== null;

export const clock = (ms: number) => {
  const secs = Math.ceil(ms / 1000);
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
};

const id = () => crypto.randomUUID();
const byName = (a: Delegate, b: Delegate) => a.name.localeCompare(b.name, "en-AU", { sensitivity: "base" });

// Names typed one per line or separated by commas; blanks and repeats dropped, in alphabetical order for the roll.
export function parseNames(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of text.split(/[\n,;]+/)) {
    const name = raw.trim().replace(/\s+/g, " ").slice(0, 60);
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    out.push(name);
  }
  return out.slice(0, MAX_DELEGATES);
}

export function create(name: string, topic: string, speakSecs: number, names: string[]): Chamber {
  const delegates = names.map((n) => ({ id: id(), name: n, present: false })).sort(byName);
  return { v: 1, name: name.trim(), topic: topic.trim(), speakSecs, delegates, queue: [], speaker: null, timer: null, vote: null, result: null, log: [{ at: now(), text: "Committee opened" }] };
}

const note = (c: Chamber, text: string): Chamber => ({ ...c, log: [...c.log, { at: now(), text }] });
export const nameOf = (c: Chamber, who: string | null) => c.delegates.find((d) => d.id === who)?.name ?? "";
export const presentCount = (c: Chamber) => c.delegates.filter((d) => d.present).length;

/* Roll call */
export function setPresent(c: Chamber, who: string, present: boolean): Chamber {
  const next = { ...c, delegates: c.delegates.map((d) => (d.id === who ? { ...d, present } : d)) };
  // Someone marked absent comes off the list; the speaker at the podium stays until they finish.
  return present ? next : { ...next, queue: next.queue.filter((q) => q !== who) };
}
export function setAllPresent(c: Chamber, present: boolean): Chamber {
  const next = { ...c, delegates: c.delegates.map((d) => ({ ...d, present })) };
  return note(present ? next : { ...next, queue: [] }, present ? "Roll call: everyone present" : "Roll call cleared");
}
export function addDelegate(c: Chamber, name: string): Chamber {
  const clean = name.trim().replace(/\s+/g, " ").slice(0, 60);
  if (!clean || c.delegates.length >= MAX_DELEGATES || c.delegates.some((d) => d.name.toLowerCase() === clean.toLowerCase())) return c;
  return { ...c, delegates: [...c.delegates, { id: id(), name: clean, present: true }].sort(byName) };
}
export function removeDelegate(c: Chamber, who: string): Chamber {
  return { ...c, delegates: c.delegates.filter((d) => d.id !== who), queue: c.queue.filter((q) => q !== who), speaker: c.speaker === who ? null : c.speaker };
}

/* Speakers list */
export function enqueue(c: Chamber, who: string): Chamber {
  if (c.queue.includes(who) || c.speaker === who) return c;
  return { ...c, queue: [...c.queue, who] };
}
export function unqueue(c: Chamber, who: string): Chamber {
  return { ...c, queue: c.queue.filter((q) => q !== who) };
}
export function shift(c: Chamber, who: string, by: -1 | 1): Chamber {
  const at = c.queue.indexOf(who);
  const to = at + by;
  if (at < 0 || to < 0 || to >= c.queue.length) return c;
  const queue = [...c.queue];
  [queue[at], queue[to]] = [queue[to], queue[at]];
  return { ...c, queue };
}

/* Timer */
const timerFor = (label: string, secs: number): Timer => ({ label, total: secs * 1000, endsAt: null, left: secs * 1000 });

// The next speaker comes off the list with a fresh, paused timer, so the chair introduces them and then starts it.
export function nextSpeaker(c: Chamber): Chamber {
  const [who, ...rest] = c.queue;
  if (!who) return note({ ...c, speaker: null, timer: null }, "Speakers list finished");
  return note({ ...c, queue: rest, speaker: who, timer: timerFor(nameOf(c, who), c.speakSecs), result: null }, `${nameOf(c, who)} to speak`);
}
export function startTimer(c: Chamber, now: number): Chamber {
  if (!c.timer || running(c.timer) || c.timer.left <= 0) return c;
  return { ...c, timer: { ...c.timer, endsAt: now + c.timer.left } };
}
export function pauseTimer(c: Chamber, now: number): Chamber {
  if (!c.timer || !running(c.timer)) return c;
  return { ...c, timer: { ...c.timer, endsAt: null, left: remaining(c.timer, now) } };
}
export function resetTimer(c: Chamber): Chamber {
  return c.timer ? { ...c, timer: { ...c.timer, endsAt: null, left: c.timer.total } } : c;
}
export function nudgeTimer(c: Chamber, secs: number, now: number): Chamber {
  const t = c.timer;
  if (!t) return c;
  const left = Math.max(0, remaining(t, now) + secs * 1000);
  return { ...c, timer: { ...t, total: Math.max(1000, t.total + secs * 1000), left, endsAt: t.endsAt === null ? null : now + left } };
}
export function setTimer(c: Chamber, label: string, secs: number): Chamber {
  return note({ ...c, timer: timerFor(label, secs) }, `Timer set: ${label}, ${clock(secs * 1000)}`);
}
export function setSpeakSecs(c: Chamber, secs: number): Chamber {
  return { ...c, speakSecs: secs };
}
export function clearTimer(c: Chamber): Chamber {
  return { ...c, timer: null, speaker: null };
}

/* Motions and voting */
export function openVote(c: Chamber, title: string, needs: Majority, secs: number | null): Chamber {
  const t = title.trim().slice(0, 140);
  if (!t) return c;
  return note({ ...c, vote: { title: t, needs, secs, yes: 0, no: 0, abstain: 0 }, result: null }, `Motion: ${t}`);
}
export function tally(c: Chamber, which: "yes" | "no" | "abstain", by: 1 | -1): Chamber {
  if (!c.vote) return c;
  const max = presentCount(c) || MAX_DELEGATES;
  const cur = c.vote[which];
  const next = Math.min(max, Math.max(0, cur + by));
  return { ...c, vote: { ...c.vote, [which]: next } };
}
// Abstentions don't count towards the majority. A simple majority needs more yes than no; two-thirds needs at least
// two of every three yes-or-no votes.
export const passes = (v: Pick<Vote, "needs" | "yes" | "no">) => (v.needs === "simple" ? v.yes > v.no : v.yes > 0 && v.yes * 3 >= (v.yes + v.no) * 2);
export function decide(c: Chamber): Chamber {
  const v = c.vote;
  if (!v) return c;
  const passed = passes(v);
  const result: Result = { title: v.title, needs: v.needs, yes: v.yes, no: v.no, abstain: v.abstain, passed };
  let next: Chamber = { ...c, vote: null, result };
  if (passed && v.secs) next = { ...next, speaker: null, timer: timerFor(v.title, v.secs) };
  return note(next, `${v.title}: ${passed ? "passed" : "failed"} (${v.yes} for, ${v.no} against, ${v.abstain} abstaining)`);
}
export function dropVote(c: Chamber): Chamber {
  return c.vote ? note({ ...c, vote: null }, `Motion withdrawn: ${c.vote.title}`) : c;
}

/* Minutes, as plain text for pasting anywhere */
export function minutes(c: Chamber): string {
  const when = (t: number) => new Date(t).toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit", timeZone: "Australia/Sydney" });
  return [c.name, ...(c.topic ? [`Topic: ${c.topic}`] : []), "", ...c.log.map((e) => `${when(e.at)}  ${e.text}`)].join("\n");
}

/* Storage */
export function load(): Chamber | null {
  try {
    const c = JSON.parse(localStorage.getItem(KEY) ?? "null");
    return c && c.v === 1 && Array.isArray(c.delegates) && Array.isArray(c.queue) && Array.isArray(c.log) ? (c as Chamber) : null;
  } catch { return null; }
}
export function save(c: Chamber | null) {
  try { c ? localStorage.setItem(KEY, JSON.stringify(c)) : localStorage.removeItem(KEY); } catch { /* storage blocked: the console still works for this visit */ }
}
