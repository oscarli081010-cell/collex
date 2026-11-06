// The state of one committee in Chambers, and everything a chair can do to it, under UN Youth Australia's Evatt rules
// of procedure (the Security Council simulation). Every function takes the committee and returns the next one, so the
// console is just buttons calling these. The committee lives in this browser (localStorage) or, once shared, in
// Collex; nothing here touches the network.
//
// Two things hold throughout. A change may be replayed on a newer copy of the committee when two chairs act at once,
// so each function checks that the committee is still at the step, phase and speaker the click was made for and
// otherwise does nothing; and ids are made by the caller, never in here, so a replay doesn't invent new ones. The
// President's ruling is final under Evatt, so the rules are guidance the console steers by: only a yield that would
// let four states in a row speak on one side ("not in order", rule 19) is actually refused.

export type Side = "for" | "against";
export type Ballot = "for" | "against" | "abstain";
export type Delegate = { id: string; name: string; permanent: boolean };
/** A state on a speakers' list, or one that has spoken, with the side it spoke on. */
export type Slot = { id: string; side: Side };
export type Role = "proposer" | "seconder" | "opposer" | "speaker" | "amender" | "reply";
export type Phase = "speech" | "questions" | "yield";
export type Speech = { who: string; side: Side; role: Role; phase: Phase; pois: number };
/** One run of speeches: the resolution's, or an amendment's. */
export type Debate = { list: Slot[]; run: Slot[]; yielded: Slot | null };
export type Amendment = { id: string; by: string; clause: string; text: string; backers: string[]; status: "waiting" | "entertained" | "passed" | "failed" | "withdrawn" | "invalid" };
export type AmendStage = "read" | "ask" | "debate" | "vote";
/** A vote by placard: counts only. */
export type Poll = { title: string; kind: "debate" | "amendment"; yes: number; no: number; abstain: number };
export type Result = { title: string; passed: boolean; yes: number; no: number; abstain: number };
export type Outcome = { passed: boolean; yes: number; no: number; abstain: number; needed: number; vetoed: string[] };
export type Entry = { at: number; text: string };
export type Step = "open" | "proposer" | "seconder" | "opposer" | "caucus" | "floor" | "amend" | "reply" | "vote" | "closed";

// Times are milliseconds. A running timer has `endsAt`; a paused one keeps what is left in `left`. The time on screen
// is always worked out from the clock, never counted down, so a throttled background tab can't drift.
export type Timer = { label: string; total: number; endsAt: number | null; left: number };

export type Chamber = {
  v: 1;
  rules: "evatt";
  name: string;
  topic: string;
  /** Default time for one speech, in seconds (Evatt: two minutes unless the President says otherwise). */
  speakSecs: number;
  delegates: Delegate[];
  step: Step;
  /** Where the council goes when a caucus ends. */
  after: Step | null;
  /** Whether the first mandated caucus has happened: amendments are only entertained after it. */
  caucused: boolean;
  negotiation: boolean;
  resolution: { title: string; proposer: string | null; seconder: string | null; stance: Record<string, Side> };
  debate: Debate;
  /** The resolution's debate, put aside while an amendment is debated. */
  parked: Debate | null;
  speech: Speech | null;
  amendments: Amendment[];
  amend: { id: string; stage: AmendStage } | null;
  poll: Poll | null;
  /** The last placard vote's outcome, kept until the next thing starts. */
  result: Result | null;
  timer: Timer | null;
  ballots: Record<string, Ballot>;
  outcome: Outcome | null;
  log: Entry[];
};

export const KEY = "collex:chamber";
export const MAX_DELEGATES = 200;

/* Time */

// Devices sharing a committee may disagree about the time. Whenever one hears from the database it learns how far its
// clock is out, and every timestamp it writes or reads goes through now() so all of them count from the same moment.
let skew = 0;
export const setSkew = (ms: number) => { skew = ms; };
export const now = () => Date.now() + skew;

export const remaining = (t: Timer, at: number) => (t.endsAt === null ? t.left : Math.max(0, t.endsAt - at));
export const running = (t: Timer | null) => !!t && t.endsAt !== null;
export const clock = (ms: number) => {
  const secs = Math.ceil(ms / 1000);
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
};

/* Setting up */

const byName = (a: Delegate, b: Delegate) => a.name.localeCompare(b.name, "en-AU", { sensitivity: "base" });
const emptyDebate = (): Debate => ({ list: [], run: [], yielded: null });

// The five permanent members of the Security Council, by the names they usually go by. The chair can change it.
const PERMANENT = new Set([
  "china", "peoples republic of china", "prc", "france", "russia", "russian federation",
  "uk", "united kingdom", "great britain", "britain", "usa", "us", "united states", "united states of america", "america",
]);
const plain = (s: string) => s.toLowerCase().replace(/[.'’]/g, "").replace(/\s+/g, " ").trim();
export const isPermanent = (name: string) => PERMANENT.has(plain(name));

// Names typed one per line or separated by commas; blanks and repeats dropped.
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

/** `ids` are made by the caller, one per name. */
export function create(name: string, topic: string, speakSecs: number, names: string[], ids: string[]): Chamber {
  const delegates = names.map((n, i) => ({ id: ids[i], name: n, permanent: isPermanent(n) })).sort(byName);
  return {
    v: 1, rules: "evatt", name: name.trim(), topic: topic.trim(), speakSecs, delegates,
    step: "open", after: null, caucused: false, negotiation: false,
    resolution: { title: "", proposer: null, seconder: null, stance: {} },
    debate: emptyDebate(), parked: null, speech: null, amendments: [], amend: null, poll: null, result: null,
    timer: null, ballots: {}, outcome: null, log: [{ at: now(), text: "Committee opened" }],
  };
}

// Whatever comes in from storage or the database is checked once here. A committee saved before the Evatt rules existed
// keeps its name, topic, delegations and minutes, and starts again at the opening.
export function normalise(x: unknown): Chamber | null {
  if (!x || typeof x !== "object") return null;
  const o = x as Record<string, unknown> & Partial<Chamber>;
  if (o.v !== 1 || !Array.isArray(o.delegates) || !Array.isArray(o.log)) return null;
  const ok = o.rules === "evatt" && typeof o.step === "string" && o.debate && Array.isArray(o.debate.list) && Array.isArray(o.debate.run)
    && o.resolution && o.resolution.stance && Array.isArray(o.amendments) && o.ballots && typeof o.ballots === "object";
  if (ok) return o as Chamber;
  const old = o.delegates as { id: string; name: string; permanent?: boolean }[];
  const fresh = create(String(o.name ?? "Committee"), String(o.topic ?? ""), Number(o.speakSecs) || 120, [], []);
  return {
    ...fresh,
    delegates: old.map((d) => ({ id: d.id, name: d.name, permanent: d.permanent ?? isPermanent(d.name) })).sort(byName),
    log: (o.log as Entry[]).slice(-200),
  };
}

const note = (c: Chamber, text: string): Chamber => ({ ...c, log: [...c.log, { at: now(), text }] });
export const nameOf = (c: Chamber, who: string | null) => c.delegates.find((d) => d.id === who)?.name ?? "";
const has = (c: Chamber, who: string | null | undefined): who is string => !!who && c.delegates.some((d) => d.id === who);
const other = (s: Side): Side => (s === "for" ? "against" : "for");
const sideWord = (s: Side) => (s === "for" ? "in favour" : "against");

export const ROLE_LABEL: Record<Role, string> = { proposer: "Proposer", seconder: "Seconder", opposer: "First against", speaker: "Speaker", amender: "Amendment proposer", reply: "Right of Reply" };

/* People */
export function setPermanent(c: Chamber, who: string, permanent: boolean): Chamber {
  return { ...c, delegates: c.delegates.map((d) => (d.id === who ? { ...d, permanent } : d)) };
}
export function addDelegate(c: Chamber, id: string, name: string): Chamber {
  const clean = name.trim().replace(/\s+/g, " ").slice(0, 60);
  if (!clean || c.delegates.length >= MAX_DELEGATES || c.delegates.some((d) => d.id === id || d.name.toLowerCase() === clean.toLowerCase())) return c;
  return { ...c, delegates: [...c.delegates, { id, name: clean, permanent: isPermanent(clean) }].sort(byName) };
}
// Only between resolutions: taking a state out mid-debate would leave speeches and votes pointing at no one.
export function removeDelegate(c: Chamber, who: string): Chamber {
  if (c.step !== "open" && c.step !== "closed") return c;
  return { ...c, delegates: c.delegates.filter((d) => d.id !== who) };
}
export function setSpeakSecs(c: Chamber, secs: number): Chamber {
  return { ...c, speakSecs: secs };
}

/* Opening */

export function announce(c: Chamber, title: string, proposer: string, seconder: string): Chamber {
  const t = title.trim().slice(0, 140);
  if (c.step !== "open" || !t || proposer === seconder || !has(c, proposer) || !has(c, seconder)) return c;
  const next: Chamber = {
    ...c, step: "proposer", after: null, caucused: false, negotiation: false,
    resolution: { title: t, proposer, seconder, stance: { [proposer]: "for", [seconder]: "for" } },
    debate: emptyDebate(), parked: null, speech: null, amendments: [], amend: null, poll: null, result: null, timer: null, ballots: {}, outcome: null,
  };
  return note(next, `Resolution: ${t}. Proposer ${nameOf(c, proposer)}, seconder ${nameOf(c, seconder)}`);
}

// Between resolutions the delegations and minutes stay; everything else starts again.
export function newResolution(c: Chamber): Chamber {
  if (c.step !== "closed") return c;
  return note({
    ...c, step: "open", after: null, caucused: false, negotiation: false,
    resolution: { title: "", proposer: null, seconder: null, stance: {} },
    debate: emptyDebate(), parked: null, speech: null, amendments: [], amend: null, poll: null, result: null, timer: null, ballots: {}, outcome: null,
  }, "Ready for the next resolution");
}

/* Speeches */

const timerFor = (label: string, secs: number): Timer => ({ label, total: secs * 1000, endsAt: null, left: secs * 1000 });
const inResolution = (c: Chamber) => c.step !== "amend";

// A state is called to speak: it comes off the list, goes on the run of speakers, and gets a fresh timer to start.
function start(c: Chamber, who: string, side: Side, role: Role): Chamber {
  const debate: Debate = {
    list: c.debate.list.filter((s) => s.id !== who),
    run: [...c.debate.run, { id: who, side }],
    yielded: c.debate.yielded?.id === who ? null : c.debate.yielded,
  };
  const stance = role !== "amender" && inResolution(c) ? { ...c.resolution.stance, [who]: side } : c.resolution.stance;
  const next: Chamber = {
    ...c, debate, resolution: { ...c.resolution, stance }, result: null,
    speech: { who, side, role, phase: "speech", pois: 0 }, timer: timerFor(nameOf(c, who), c.speakSecs),
  };
  return note(next, `${nameOf(c, who)} speaks ${sideWord(side)}${role === "reply" ? " (Right of Reply)" : role === "amender" ? " on their amendment" : ""}`);
}

export function callProposer(c: Chamber): Chamber {
  const p = c.resolution.proposer;
  return c.step === "proposer" && !c.speech && has(c, p) ? start(c, p, "for", "proposer") : c;
}
// When the seconder begins, the speakers' list is open.
export function callSeconder(c: Chamber): Chamber {
  const s = c.resolution.seconder;
  return c.step === "seconder" && !c.speech && has(c, s) ? note(start(c, s, "for", "seconder"), "Speakers' list opened") : c;
}
export function callOpposer(c: Chamber, who: string): Chamber {
  if (c.step !== "opposer" || c.speech || !has(c, who) || who === c.resolution.proposer || who === c.resolution.seconder) return c;
  return start(c, who, "against", "opposer");
}
// Any state, on the side the chair names: the chair is never stuck for want of someone on the list.
export function callSpeaker(c: Chamber, who: string, side: Side): Chamber {
  const live = c.step === "floor" || (c.step === "amend" && c.amend?.stage === "debate");
  if (!live || c.speech || !has(c, who)) return c;
  return start(c, who, side, "speaker");
}
export function callAmender(c: Chamber): Chamber {
  const a = c.amendments.find((x) => x.id === c.amend?.id);
  if (c.step !== "amend" || c.amend?.stage !== "debate" || c.speech || c.debate.run.length || !a || !has(c, a.by)) return c;
  return start(c, a.by, "for", "amender");
}
export function callReply(c: Chamber, who: string): Chamber {
  if (c.step !== "reply" || c.speech || !has(c, who)) return c;
  return start(c, who, "for", "reply");
}

// The state yielded to speaks next; otherwise the next on the other side of the list.
export function nextCandidate(c: Chamber): Slot | null {
  if (c.debate.yielded) return c.debate.yielded;
  const last = c.debate.run[c.debate.run.length - 1]?.side;
  const want: Side = last ? other(last) : "for";
  return c.debate.list.find((s) => s.side === want) ?? c.debate.list.find((s) => s.side !== want) ?? null;
}

export function endSpeech(c: Chamber, at: number): Chamber {
  const sp = c.speech;
  if (!sp || sp.phase !== "speech") return c;
  const paused = pauseTimer(c, at);
  if (sp.role === "reply") return finish(paused, null); // no points of information after a Right of Reply
  return note({ ...paused, speech: { ...sp, phase: "questions" } }, `${nameOf(c, sp.who)}: points of information`);
}
export function poi(c: Chamber, by: 1 | -1): Chamber {
  const sp = c.speech;
  if (!sp || sp.phase !== "questions") return c;
  return { ...c, speech: { ...sp, pois: Math.min(20, Math.max(0, sp.pois + by)) } };
}
export function endQuestions(c: Chamber): Chamber {
  const sp = c.speech;
  if (!sp || sp.phase !== "questions") return c;
  // The proposer and seconder cannot yield: the floor goes back to the chair.
  if (sp.role === "proposer" || sp.role === "seconder") return finish(c, null);
  return { ...c, speech: { ...sp, phase: "yield" } };
}
// A step back, for a button pressed too soon during a live debate.
export function backPhase(c: Chamber): Chamber {
  const sp = c.speech;
  if (!sp || sp.phase === "speech") return c;
  return { ...c, speech: { ...sp, phase: sp.phase === "yield" ? "questions" : "speech" } };
}

// Whether the speaker may yield to this state. It has to be on the speaker's side of the list, and the yield can't let
// four states in a row speak on one side.
export function canYield(c: Chamber, target: string): boolean {
  const sp = c.speech;
  if (!sp || sp.phase !== "yield" || sp.role === "proposer" || sp.role === "seconder" || sp.role === "reply") return false;
  if (!c.debate.list.some((s) => s.id === target && s.side === sp.side)) return false;
  let streak = 0;
  for (let i = c.debate.run.length - 1; i >= 0 && c.debate.run[i].side === sp.side; i--) streak++;
  return streak + 1 < 4;
}
export const yieldTargets = (c: Chamber) => (c.speech ? c.debate.list.filter((s) => canYield(c, s.id)) : []);

export function yieldTo(c: Chamber, target: string | null): Chamber {
  const sp = c.speech;
  if (!sp || sp.phase !== "yield") return c;
  if (target !== null && !canYield(c, target)) return c;
  return finish(c, target);
}

// The speech is over. What comes next depends on who spoke.
function finish(c: Chamber, target: string | null): Chamber {
  const sp = c.speech;
  if (!sp) return c;
  const to = target ? `, yielding to ${nameOf(c, target)}` : "";
  let next: Chamber = { ...c, speech: null, timer: null };
  if (target) next = { ...next, debate: { ...next.debate, list: next.debate.list.filter((s) => s.id !== target), yielded: { id: target, side: sp.side } } };
  switch (sp.role) {
    case "proposer": // the negotiation room opens before the seconder is called
      return note({ ...next, step: "seconder", negotiation: true }, `${nameOf(c, sp.who)} finished; negotiation room open`);
    case "seconder":
      return note({ ...next, step: "opposer" }, `${nameOf(c, sp.who)} finished`);
    case "opposer":
      return enterCaucus(note(next, `${nameOf(c, sp.who)} finished${to}`), 180, "floor", "First caucus");
    case "reply":
      return note({ ...next, step: "vote", negotiation: false, ballots: {} }, `${nameOf(c, sp.who)} finished; roll call vote`);
    default:
      return note(next, `${nameOf(c, sp.who)} finished${to}`);
  }
}

/* Caucus */

function enterCaucus(c: Chamber, secs: number, after: Step, label: string): Chamber {
  return note({ ...c, step: "caucus", after, negotiation: false, timer: timerFor(label, secs) }, `${label}: ${clock(secs * 1000)}`);
}
// A caucus may be called between speeches, in the debate or while an amendment is being dealt with.
export function callCaucus(c: Chamber, secs: number): Chamber {
  if (c.speech || (c.step !== "floor" && c.step !== "amend")) return c;
  return enterCaucus({ ...c, result: null }, secs, c.step, "Caucus");
}
export function endCaucus(c: Chamber): Chamber {
  if (c.step !== "caucus") return c;
  const to = c.after ?? "floor";
  const open = to === "floor" || (to === "amend" && c.amend?.stage === "debate");
  return note({ ...c, step: to, after: null, caucused: true, negotiation: open, timer: null }, "Caucus ended");
}

/* Closing */

// The chair closes debate: a final caucus (one to three minutes), then the Right of Reply.
export function closeDebate(c: Chamber): Chamber {
  if (c.step !== "floor" || c.speech) return c;
  return enterCaucus(note({ ...c, result: null }, "Debate closed"), 120, "reply", "Final caucus");
}
export const inFavour = (c: Chamber) => c.delegates.filter((d) => c.resolution.stance[d.id] === "for");
// The proposer, unless they now oppose it; then the earliest to speak who is still in favour.
export function replyBy(c: Chamber): string | null {
  const p = c.resolution.proposer;
  if (p && c.resolution.stance[p] === "for") return p;
  return c.debate.run.find((s) => c.resolution.stance[s.id] === "for")?.id ?? null;
}
export function skipReply(c: Chamber): Chamber {
  if (c.step !== "reply" || c.speech) return c;
  return note({ ...c, step: "vote", negotiation: false, ballots: {} }, "Right of Reply not used; roll call vote");
}

/* Speakers' lists */

// The list opens when the seconder begins.
export const listOpen = (c: Chamber) => c.step !== "open" && c.step !== "proposer" && c.step !== "closed" && c.step !== "vote";
export const spokeOn = (c: Chamber, who: string, side: Side) => c.debate.run.some((s) => s.id === who && s.side === side);
export function canAdd(c: Chamber, who: string, side: Side): boolean {
  return listOpen(c) && has(c, who) && !c.debate.list.some((s) => s.id === who) && c.speech?.who !== who && c.debate.yielded?.id !== who && !spokeOn(c, who, side);
}
export function addToList(c: Chamber, who: string, side: Side): Chamber {
  if (!canAdd(c, who, side)) return c;
  const stance = inResolution(c) ? { ...c.resolution.stance, [who]: side } : c.resolution.stance;
  return { ...c, debate: { ...c.debate, list: [...c.debate.list, { id: who, side }] }, resolution: { ...c.resolution, stance } };
}
export function removeFromList(c: Chamber, who: string): Chamber {
  return { ...c, debate: { ...c.debate, list: c.debate.list.filter((s) => s.id !== who) } };
}
// A state changes its stance by note; it may then speak once more on the new side.
export function switchSide(c: Chamber, who: string): Chamber {
  const slot = c.debate.list.find((s) => s.id === who);
  if (!slot) return c;
  const side = other(slot.side);
  const stance = inResolution(c) ? { ...c.resolution.stance, [who]: side } : c.resolution.stance;
  return { ...c, debate: { ...c.debate, list: c.debate.list.map((s) => (s.id === who ? { ...s, side } : s)) }, resolution: { ...c.resolution, stance } };
}
export function shiftList(c: Chamber, who: string, by: -1 | 1): Chamber {
  const list = [...c.debate.list];
  const at = list.findIndex((s) => s.id === who);
  if (at < 0) return c;
  let to = at + by;
  while (to >= 0 && to < list.length && list[to].side !== list[at].side) to += by;
  if (to < 0 || to >= list.length) return c;
  [list[at], list[to]] = [list[to], list[at]];
  return { ...c, debate: { ...c.debate, list } };
}

/* Amendments */

export function submitAmendment(c: Chamber, id: string, by: string, clause: string, text: string, backers: string[]): Chamber {
  // Notes are open from the proposer's speech on; the chair only entertains them once the first caucus is over.
  const open = c.step === "seconder" || c.step === "opposer" || c.step === "caucus" || c.step === "floor" || c.step === "amend";
  const body = text.trim().slice(0, 600);
  if (!open || !body || !has(c, by) || c.amendments.some((a) => a.id === id)) return c;
  const ids = [...new Set(backers)].filter((b) => b !== by && has(c, b));
  const a: Amendment = { id, by, clause: clause.trim().slice(0, 40), text: body, backers: ids, status: "waiting" };
  return note({ ...c, amendments: [...c.amendments, a] }, `Amendment from ${nameOf(c, by)}${a.clause ? ` (${a.clause})` : ""}, ${ids.length} co-sponsor${ids.length === 1 ? "" : "s"}`);
}
const setAmendment = (c: Chamber, id: string, status: Amendment["status"]): Chamber => ({ ...c, amendments: c.amendments.map((a) => (a.id === id ? { ...a, status } : a)) });
export function withdrawAmendment(c: Chamber, id: string): Chamber {
  const a = c.amendments.find((x) => x.id === id);
  return a?.status === "waiting" ? note(setAmendment(c, id, "withdrawn"), `Amendment from ${nameOf(c, a.by)} withdrawn`) : c;
}
export function invalidAmendment(c: Chamber, id: string): Chamber {
  const a = c.amendments.find((x) => x.id === id);
  return a?.status === "waiting" ? note(setAmendment(c, id, "invalid"), `Amendment from ${nameOf(c, a.by)} ruled invalid`) : c;
}
// More co-sponsors first, as the rules ask; the chair weighs how consequential each is.
export const waitingAmendments = (c: Chamber) => c.amendments.filter((a) => a.status === "waiting").sort((a, b) => b.backers.length - a.backers.length);

export function entertain(c: Chamber, id: string): Chamber {
  const a = c.amendments.find((x) => x.id === id);
  if (c.step !== "floor" || c.speech || c.amend || a?.status !== "waiting") return c;
  const next: Chamber = { ...setAmendment(c, id, "entertained"), step: "amend", amend: { id, stage: "read" }, negotiation: false, parked: c.debate, debate: emptyDebate(), result: null };
  return note(next, `Amendment from ${nameOf(c, a.by)} read to the council`);
}
// Think better of it before any ruling: the amendment goes back to waiting and the resolution's list returns.
export function backOutAmendment(c: Chamber): Chamber {
  if (c.step !== "amend" || c.amend?.stage !== "read" || !c.parked) return c;
  return note({ ...setAmendment(c, c.amend.id, "waiting"), step: "floor", amend: null, debate: c.parked, parked: null, negotiation: true }, "Amendment set aside for now");
}
const poll = (title: string, kind: Poll["kind"]): Poll => ({ title, kind, yes: 0, no: 0, abstain: 0 });
export function amendAsk(c: Chamber): Chamber {
  if (c.step !== "amend" || c.amend?.stage !== "read") return c;
  return note({ ...c, amend: { ...c.amend, stage: "ask" }, poll: poll("Debate this amendment?", "debate") }, "Vote on whether to debate the amendment");
}
export function amendDebate(c: Chamber): Chamber {
  if (c.step !== "amend" || c.amend?.stage !== "read") return c;
  return note({ ...c, amend: { ...c.amend, stage: "debate" }, negotiation: true, poll: null }, "Amendment to be debated");
}
export function amendVote(c: Chamber): Chamber {
  if (c.step !== "amend" || (c.amend?.stage !== "read" && c.amend?.stage !== "debate") || c.speech) return c;
  return note({ ...c, amend: { ...c.amend, stage: "vote" }, negotiation: false, poll: poll("Adopt this amendment?", "amendment") }, "Vote on the amendment");
}
export function tally(c: Chamber, which: "yes" | "no" | "abstain", by: 1 | -1): Chamber {
  if (!c.poll) return c;
  return { ...c, poll: { ...c.poll, [which]: Math.min(c.delegates.length, Math.max(0, c.poll[which] + by)) } };
}
// Rule 48: more in favour than against. The President may overrule the result (rule 31).
export const passes = (p: Pick<Poll, "yes" | "no">) => p.yes > p.no;

export function decideAsk(c: Chamber, overrule: boolean): Chamber {
  const p = c.poll;
  if (c.step !== "amend" || c.amend?.stage !== "ask" || p?.kind !== "debate") return c;
  const yes = overrule ? !passes(p) : passes(p);
  const result: Result = { title: p.title, passed: yes, yes: p.yes, no: p.no, abstain: p.abstain };
  const tail = `${p.yes} for, ${p.no} against, ${p.abstain} abstaining${overrule ? ", overruled" : ""}`;
  if (yes) return note({ ...c, amend: { ...c.amend, stage: "debate" }, negotiation: true, poll: null, result }, `Amendment to be debated (${tail})`);
  return note({ ...c, amend: { ...c.amend, stage: "vote" }, poll: poll("Adopt this amendment?", "amendment"), result }, `Not to be debated (${tail}); straight to the vote`);
}
export function decideAmendment(c: Chamber, overrule: boolean): Chamber {
  const p = c.poll;
  const a = c.amendments.find((x) => x.id === c.amend?.id);
  if (c.step !== "amend" || c.amend?.stage !== "vote" || p?.kind !== "amendment" || !a || !c.parked) return c;
  const yes = overrule ? !passes(p) : passes(p);
  const result: Result = { title: `Amendment from ${nameOf(c, a.by)}`, passed: yes, yes: p.yes, no: p.no, abstain: p.abstain };
  const tail = `${p.yes} for, ${p.no} against, ${p.abstain} abstaining${overrule ? ", overruled" : ""}`;
  // Whatever happens, the council goes back to the resolution with its list as it stood.
  const next: Chamber = { ...setAmendment(c, a.id, yes ? "passed" : "failed"), step: "floor", amend: null, poll: null, debate: c.parked, parked: null, negotiation: true, result, timer: null };
  return note(next, `Amendment from ${nameOf(c, a.by)} ${yes ? "passed" : "failed"} (${tail})`);
}

/* The vote on the resolution: a roll call */

export function cast(c: Chamber, who: string, ballot: Ballot | null): Chamber {
  if (c.step !== "vote" || !has(c, who)) return c;
  const ballots = { ...c.ballots };
  if (ballot) ballots[who] = ballot; else delete ballots[who];
  return { ...c, ballots };
}
export function count(c: Chamber) {
  const out = { yes: 0, no: 0, abstain: 0, left: 0, vetoed: [] as string[] };
  for (const d of c.delegates) {
    const b = c.ballots[d.id];
    if (b === "for") out.yes++;
    else if (b === "against") { out.no++; if (d.permanent) out.vetoed.push(d.name); }
    else if (b === "abstain") out.abstain++;
    else out.left++;
  }
  return out;
}
// Three-fifths of all the member states, and no vote against from a permanent member. An abstention is neither.
export const needed = (members: number) => Math.ceil((members * 3) / 5);
export function finishVote(c: Chamber): Chamber {
  if (c.step !== "vote") return c;
  const n = count(c);
  if (n.left) return c;
  const need = needed(c.delegates.length);
  const passed = n.yes >= need && n.vetoed.length === 0;
  const outcome: Outcome = { passed, yes: n.yes, no: n.no, abstain: n.abstain, needed: need, vetoed: n.vetoed };
  const why = n.vetoed.length ? `, vetoed by ${n.vetoed.join(", ")}` : !passed ? `, ${need} needed` : "";
  return note({ ...c, step: "closed", outcome, negotiation: false }, `Resolution ${passed ? "approved" : "not approved"}: ${n.yes} for, ${n.no} against, ${n.abstain} abstaining${why}`);
}
// Back to amending the ballots, if the result was recorded too soon.
export function reopenVote(c: Chamber): Chamber {
  if (c.step !== "closed" || !c.outcome) return c;
  return note({ ...c, step: "vote", outcome: null }, "Vote reopened");
}

/* Timer */

export function startTimer(c: Chamber, at: number): Chamber {
  if (!c.timer || running(c.timer) || c.timer.left <= 0) return c;
  return { ...c, timer: { ...c.timer, endsAt: at + c.timer.left } };
}
export function pauseTimer(c: Chamber, at: number): Chamber {
  if (!c.timer || !running(c.timer)) return c;
  return { ...c, timer: { ...c.timer, endsAt: null, left: remaining(c.timer, at) } };
}
export function resetTimer(c: Chamber): Chamber {
  return c.timer ? { ...c, timer: { ...c.timer, endsAt: null, left: c.timer.total } } : c;
}
export function nudgeTimer(c: Chamber, secs: number, at: number): Chamber {
  const t = c.timer;
  if (!t) return c;
  const left = Math.max(0, remaining(t, at) + secs * 1000);
  return { ...c, timer: { ...t, total: Math.max(1000, t.total + secs * 1000), left, endsAt: t.endsAt === null ? null : at + left } };
}
/** A timer for anything else (explaining an amendment, say). It never changes where the debate is. */
export function setTimer(c: Chamber, label: string, secs: number): Chamber {
  return note({ ...c, timer: timerFor(label, secs) }, `Timer set: ${label}, ${clock(secs * 1000)}`);
}

/* Minutes */

export function addNote(c: Chamber, text: string): Chamber {
  const t = text.trim().slice(0, 300);
  return t ? note(c, t) : c;
}
export function minutes(c: Chamber): string {
  const when = (t: number) => new Date(t).toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit", timeZone: "Australia/Sydney" });
  return [c.name, ...(c.topic ? [`Topic: ${c.topic}`] : []), "", ...c.log.map((e) => `${when(e.at)}  ${e.text}`)].join("\n");
}

/* Where the council is, for the progress bar */
export const STAGES = ["Opening", "Proposer", "Seconder", "First against", "Caucus", "Debate", "Closing", "Vote"] as const;
export function stageIndex(c: Chamber): number {
  switch (c.step) {
    case "open": return 0;
    case "proposer": return 1;
    case "seconder": return 2;
    case "opposer": return 3;
    case "caucus": return c.after === "reply" ? 6 : !c.caucused ? 4 : 5;
    case "floor": case "amend": return 5;
    case "reply": return 6;
    default: return 7;
  }
}

/* Storage */
export function load(): Chamber | null {
  try { return normalise(JSON.parse(localStorage.getItem(KEY) ?? "null")); } catch { return null; }
}
export function save(c: Chamber | null) {
  try { c ? localStorage.setItem(KEY, JSON.stringify(c)) : localStorage.removeItem(KEY); } catch { /* storage blocked: the console still works for this visit */ }
}
