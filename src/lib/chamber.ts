// The state of one committee in Chambers, and everything a chair can do to it. The debate follows UN Youth Australia's
// Evatt Security Council simulation in three parts: Opening (welcome, roll call, then the proposer, seconder and opposer
// speak), Debate (a caucus, then one amendment at a time) and Closing (a last speech from each of the three, then the
// vote). Every function takes the committee and returns the next one, so the console is just buttons calling these.
// The committee lives in this browser (localStorage) or, once shared, in Collex; nothing here touches the network.
//
// Two things hold throughout. A change may be replayed on a newer copy of the committee when two chairs act at once,
// so each function checks that the committee is still at the step, phase, speaker and question the click was made for
// and otherwise does nothing; and ids are made by the caller, never in here, so a replay doesn't invent new ones. The
// President's ruling is final, so the console steers by the rules and rarely refuses: the chair is never stuck.

export type Side = "for" | "against";
/** A state's answer at roll call. */
export type Attend = "present" | "voting" | "abstain";
export type Ballot = "for" | "against" | "abstain";
export type Delegate = { id: string; name: string };
/** A state on a speakers' list, or one that has spoken, with the side it spoke on. */
export type Slot = { id: string; side: Side };
export type Role = "proposer" | "seconder" | "opposer" | "speaker" | "amender" | "closer";
/** speech, then the speaker either takes a Point of Information (ask, then answer) or yields to the chair. */
export type Phase = "speech" | "after" | "ask" | "answer";
export type Speech = { who: string; side: Side; role: Role; phase: Phase; asker: string | null; pois: number };
/** The speeches on the amendment in hand. */
export type Debate = { list: Slot[]; run: Slot[] };
/** `backers` are the amendment's signatories. `at` is when it was handed in. */
export type Amendment = { id: string; by: string; clause: string; text: string; backers: string[]; at: number; status: "waiting" | "entertained" | "passed" | "failed" | "withdrawn" | "invalid" };
/** What a state did, for the analytics: a speech of each kind, a Point of Information asked or answered, an amendment handed in or signed. */
export type StatKind = "proposer" | "seconder" | "opposer" | "amender" | "speaker" | "closing" | "poi" | "reply" | "amendment" | "signatory";
export type Stat = { at: number; who: string; kind: StatKind; secs: number; with?: string; res: string };
export type AmendStage = "read" | "ask" | "debate" | "vote";
/** A vote by placard: counts only. */
export type Poll = { title: string; kind: "debate" | "amendment"; yes: number; no: number; abstain: number };
/** `kind` says which vote it was (whether to debate an amendment, or whether to adopt it) and `amendment` which one. */
export type Result = { title: string; kind: "debate" | "amendment"; amendment?: string; passed: boolean; yes: number; no: number; abstain: number };
export type Outcome = { passed: boolean; yes: number; no: number; abstain: number; needed: number };
export type Entry = { at: number; text: string };
export type Step = "welcome" | "roll" | "pick" | "proposer" | "seconder" | "opposer" | "caucus" | "floor" | "amend" | "closing" | "vote" | "closed" | "ended";

// Times are milliseconds. A running timer has `endsAt`; a paused one keeps what is left in `left`. The time on screen
// is always worked out from the clock, never counted down, so a throttled background tab can't drift.
export type Timer = { label: string; total: number; endsAt: number | null; left: number };

export type Chamber = {
  v: 1;
  rules: "evatt";
  /** Which shape of committee this is, so older saved ones can be brought up to date. */
  rev: 2;
  name: string;
  /** The resolution being debated. */
  topic: string;
  /** Default time for one speech, in seconds. */
  speakSecs: number;
  delegates: Delegate[];
  step: Step;
  /** Where the council goes when a caucus ends. */
  after: Step | null;
  roll: Record<string, Attend>;
  roles: { proposer: string | null; seconder: string | null; opposer: string | null };
  /** Who has given a closing speech. */
  closers: string[];
  debate: Debate;
  speech: Speech | null;
  amendments: Amendment[];
  amend: { id: string; stage: AmendStage } | null;
  poll: Poll | null;
  /** The last placard vote's outcome, kept until the next thing starts. */
  result: Result | null;
  timer: Timer | null;
  ballots: Record<string, Ballot>;
  outcome: Outcome | null;
  stats: Stat[];
  log: Entry[];
};

export const KEY = "collex:chamber";
export const MAX_DELEGATES = 200;
/** Each Point of Information: this long to ask, and this long to reply. */
export const POI_SECS = 30;
export const CAUCUS_SECS = 180;

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
const emptyDebate = (): Debate => ({ list: [], run: [] });
const timerFor = (label: string, secs: number): Timer => ({ label, total: secs * 1000, endsAt: null, left: secs * 1000 });

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
export function create(name: string, resolution: string, speakSecs: number, names: string[], ids: string[]): Chamber {
  const delegates = names.map((n, i) => ({ id: ids[i], name: n })).sort(byName);
  return {
    v: 1, rules: "evatt", rev: 2, name: name.trim(), topic: resolution.trim(), speakSecs, delegates,
    step: "welcome", after: null, roll: {}, roles: { proposer: null, seconder: null, opposer: null }, closers: [],
    debate: emptyDebate(), speech: null, amendments: [], amend: null, poll: null, result: null,
    timer: null, ballots: {}, outcome: null, stats: [], log: [{ at: now(), text: "Committee opened" }],
  };
}

// Whatever comes in from storage or the database is checked once here. A committee saved before this shape existed keeps
// its name, resolution, states and minutes, and starts again at the welcome.
export function normalise(x: unknown): Chamber | null {
  if (!x || typeof x !== "object") return null;
  const o = x as Record<string, unknown> & Partial<Chamber> & { resolution?: { title?: string } };
  if (o.v !== 1 || !Array.isArray(o.delegates) || !Array.isArray(o.log)) return null;
  const ok = o.rules === "evatt" && o.rev === 2 && typeof o.step === "string" && o.debate && Array.isArray(o.debate.list) && Array.isArray(o.debate.run)
    && o.roll && typeof o.roll === "object" && o.roles && Array.isArray(o.closers) && Array.isArray(o.amendments) && o.ballots && typeof o.ballots === "object";
  if (ok) return { ...(o as Chamber), stats: Array.isArray(o.stats) ? o.stats : [], amendments: (o.amendments as Amendment[]).map((a, i) => ({ ...a, at: a.at ?? i })) };
  const old = o.delegates as { id: string; name: string }[];
  const resolution = String(o.topic ?? "").trim() || String(o.resolution?.title ?? "").trim();
  const fresh = create(String(o.name ?? "Committee"), resolution, Number(o.speakSecs) || 120, [], []);
  return { ...fresh, delegates: old.map((d) => ({ id: d.id, name: d.name })).sort(byName), log: (o.log as Entry[]).slice(-200) };
}

const note = (c: Chamber, text: string): Chamber => ({ ...c, log: [...c.log, { at: now(), text }] });
export const nameOf = (c: Chamber, who: string | null) => c.delegates.find((d) => d.id === who)?.name ?? "";
const has = (c: Chamber, who: string | null | undefined): who is string => !!who && c.delegates.some((d) => d.id === who);
const other = (s: Side): Side => (s === "for" ? "against" : "for");
const sideWord = (s: Side) => (s === "for" ? "in favour" : "against");

export const ROLE_LABEL: Record<Role, string> = { proposer: "Proposer", seconder: "Seconder", opposer: "Opposer", speaker: "Speaker", amender: "Amendment proposer", closer: "Closing speech" };
export const ATTEND_LABEL: Record<Attend, string> = { present: "Present", voting: "Present and Voting", abstain: "Abstain" };

/* People */
export function addDelegate(c: Chamber, id: string, name: string): Chamber {
  const clean = name.trim().replace(/\s+/g, " ").slice(0, 60);
  if (!clean || c.delegates.length >= MAX_DELEGATES || c.delegates.some((d) => d.id === id || d.name.toLowerCase() === clean.toLowerCase())) return c;
  return { ...c, delegates: [...c.delegates, { id, name: clean }].sort(byName) };
}
// Only before the debate starts or after the vote: taking a state out mid-debate would leave speeches and votes pointing at no one.
export function removeDelegate(c: Chamber, who: string): Chamber {
  if (c.step !== "welcome" && c.step !== "roll" && c.step !== "closed") return c;
  const roll = { ...c.roll }; delete roll[who];
  return { ...c, delegates: c.delegates.filter((d) => d.id !== who), roll };
}
export function setSpeakSecs(c: Chamber, secs: number): Chamber {
  return { ...c, speakSecs: secs };
}

/* Opening: welcome, roll call, then the three speakers are chosen */

/** For a committee brought over from before the resolution was required. */
export function setResolution(c: Chamber, title: string): Chamber {
  const t = title.trim().slice(0, 160);
  return c.step === "welcome" && t ? { ...c, topic: t } : c;
}
export function startRoll(c: Chamber): Chamber {
  if (c.step !== "welcome" || !c.topic) return c;
  return note({ ...c, step: "roll" }, "Roll call started");
}
export function markRoll(c: Chamber, who: string, a: Attend | null): Chamber {
  if (c.step !== "roll" || !has(c, who)) return c;
  const roll = { ...c.roll };
  if (a) roll[who] = a; else delete roll[who];
  return { ...c, roll };
}
export function markAllRoll(c: Chamber, a: Attend): Chamber {
  if (c.step !== "roll") return c;
  return { ...c, roll: Object.fromEntries(c.delegates.map((d) => [d.id, a])) };
}
export function rollCount(c: Chamber) {
  const out = { present: 0, voting: 0, abstain: 0, unmarked: 0 };
  for (const d of c.delegates) { const a = c.roll[d.id]; if (a) out[a]++; else out.unmarked++; }
  return out;
}
export function beginDebate(c: Chamber): Chamber {
  if (c.step !== "roll") return c;
  const n = rollCount(c);
  return note({ ...c, step: "pick" }, `Roll call: ${n.present} present, ${n.voting} present and voting, ${n.abstain} abstaining${n.unmarked ? `, ${n.unmarked} not marked` : ""}`);
}
/** The chair picks each of the three as they go, so the display shows the choice at once. A state holds one role at a time. */
export function pickRole(c: Chamber, role: "proposer" | "seconder" | "opposer", who: string | null): Chamber {
  if (c.step !== "pick" || (who !== null && !has(c, who))) return c;
  const roles = { ...c.roles };
  if (who) for (const k of ["proposer", "seconder", "opposer"] as const) if (k !== role && roles[k] === who) roles[k] = null;
  roles[role] = who;
  return { ...c, roles };
}
export function startSpeeches(c: Chamber): Chamber {
  const { proposer, seconder, opposer } = c.roles;
  if (c.step !== "pick" || !has(c, proposer) || !has(c, seconder) || !has(c, opposer)) return c;
  if (proposer === seconder || proposer === opposer || seconder === opposer) return c;
  return note({ ...c, step: "proposer" }, `Proposer ${nameOf(c, proposer)}, seconder ${nameOf(c, seconder)}, opposer ${nameOf(c, opposer)}`);
}

/* Speeches */

// A state is called to speak: it comes off the list, goes on the run of speakers, and gets a fresh timer to start.
function start(c: Chamber, who: string, side: Side, role: Role, secs?: number): Chamber {
  const debate: Debate = { list: c.debate.list.filter((s) => s.id !== who), run: role === "closer" || role === "proposer" || role === "seconder" || role === "opposer" ? c.debate.run : [...c.debate.run, { id: who, side }] };
  const next: Chamber = { ...c, debate, result: null, speech: { who, side, role, phase: "speech", asker: null, pois: 0 }, timer: timerFor(nameOf(c, who), secs ?? c.speakSecs) };
  return note(next, `${nameOf(c, who)} speaks ${sideWord(side)}${role === "closer" ? " (closing)" : role === "amender" ? " on their amendment" : ""}`);
}
export function callProposer(c: Chamber): Chamber {
  const p = c.roles.proposer;
  return c.step === "proposer" && !c.speech && has(c, p) ? start(c, p, "for", "proposer") : c;
}
export function callSeconder(c: Chamber): Chamber {
  const s = c.roles.seconder;
  return c.step === "seconder" && !c.speech && has(c, s) ? start(c, s, "for", "seconder") : c;
}
export function callOpposer(c: Chamber): Chamber {
  const o = c.roles.opposer;
  return c.step === "opposer" && !c.speech && has(c, o) ? start(c, o, "against", "opposer") : c;
}
/** The amendment's proposer speaks first. `secs` is the time the chair allots. */
export function callAmender(c: Chamber, secs?: number): Chamber {
  const a = c.amendments.find((x) => x.id === c.amend?.id);
  if (c.step !== "amend" || c.amend?.stage !== "debate" || c.speech || c.debate.run.length || !a || !has(c, a.by)) return c;
  return start(c, a.by, "for", "amender", secs);
}
/** Anyone, on the side the chair names, for the time the chair allots. */
export function callSpeaker(c: Chamber, who: string, side: Side, secs?: number): Chamber {
  if (c.step !== "amend" || c.amend?.stage !== "debate" || c.speech || !has(c, who)) return c;
  return start(c, who, side, "speaker", secs);
}
export const closingRoles = (c: Chamber) => (["proposer", "seconder", "opposer"] as const).map((role) => ({ role, id: c.roles[role] })).filter((x): x is { role: "proposer" | "seconder" | "opposer"; id: string } => !!x.id);
export function callCloser(c: Chamber, who: string): Chamber {
  const r = closingRoles(c).find((x) => x.id === who);
  if (c.step !== "closing" || c.speech || !r || c.closers.includes(who)) return c;
  return start(c, who, r.role === "opposer" ? "against" : "for", "closer");
}

// The state yielded to speaks next; otherwise the next on the other side of the list.
export function nextCandidate(c: Chamber): Slot | null {
  const last = c.debate.run[c.debate.run.length - 1]?.side;
  const want: Side = last ? other(last) : "for";
  return c.debate.list.find((s) => s.side === want) ?? c.debate.list.find((s) => s.side !== want) ?? null;
}

export function endSpeech(c: Chamber, at: number, who: string): Chamber {
  const sp = c.speech;
  if (!sp || sp.who !== who || sp.phase !== "speech") return c;
  const logged = record(pauseTimer(c, at), sp.who, SPEECH_KIND[sp.role], used(c, at), at);
  if (sp.role === "closer") return finish(logged); // no Points of Information in the closing
  return { ...logged, speech: { ...sp, phase: "after" } };
}
// A Point of Information: the chair picks a state, which has 30 seconds to ask; then the speaker has 30 to reply.
export function askPoi(c: Chamber, asker: string, who: string, n: number): Chamber {
  const sp = c.speech;
  if (!sp || sp.who !== who || sp.phase !== "after" || sp.pois !== n || !has(c, asker) || asker === who) return c;
  return note({ ...c, speech: { ...sp, phase: "ask", asker }, timer: timerFor(`${nameOf(c, asker)} asks`, POI_SECS) }, `${nameOf(c, asker)} asks ${nameOf(c, who)} a Point of Information`);
}
export function answerPoi(c: Chamber, who: string, asker: string, n: number, at: number): Chamber {
  const sp = c.speech;
  if (!sp || sp.who !== who || sp.phase !== "ask" || sp.asker !== asker || sp.pois !== n) return c;
  return { ...record(c, asker, "poi", used(c, at), at, who), speech: { ...sp, phase: "answer" }, timer: timerFor(`${nameOf(c, who)} replies`, POI_SECS) };
}
export function donePoi(c: Chamber, who: string, asker: string, n: number, at: number): Chamber {
  const sp = c.speech;
  if (!sp || sp.who !== who || sp.phase !== "answer" || sp.asker !== asker || sp.pois !== n) return c;
  return { ...record(c, who, "reply", used(c, at), at, asker), speech: { ...sp, phase: "after", asker: null, pois: n + 1 }, timer: null };
}
export function yieldToChair(c: Chamber, who: string, n: number): Chamber {
  const sp = c.speech;
  if (!sp || sp.who !== who || sp.phase !== "after" || sp.pois !== n) return c;
  return finish(note(c, `${nameOf(c, who)} yields to the chair${n ? ` after ${n} Point${n === 1 ? "" : "s"} of Information` : ""}`));
}
// A step back, for a button pressed too soon during a live debate.
export function backPhase(c: Chamber, who: string, n: number): Chamber {
  const sp = c.speech;
  if (!sp || sp.who !== who || sp.pois !== n) return c;
  if (sp.phase === "after" && n === 0 && c.timer) return { ...c, speech: { ...sp, phase: "speech" } };
  if (sp.phase === "ask") return { ...c, speech: { ...sp, phase: "after", asker: null }, timer: null };
  if (sp.phase === "answer") return { ...c, speech: { ...sp, phase: "ask" }, timer: timerFor(`${nameOf(c, sp.asker)} asks`, POI_SECS) };
  return c;
}

// The speech is over. What comes next depends on who spoke.
function finish(c: Chamber): Chamber {
  const sp = c.speech;
  if (!sp) return c;
  const next: Chamber = { ...c, speech: null, timer: null };
  switch (sp.role) {
    case "proposer": return { ...next, step: "seconder" };
    case "seconder": return { ...next, step: "opposer" };
    case "opposer": return enterCaucus(next, CAUCUS_SECS, "floor", "Caucus"); // the debate starts with a caucus
    case "closer": return { ...next, closers: [...next.closers, sp.who] };
    default: return next;
  }
}

/* Caucus */

function enterCaucus(c: Chamber, secs: number, after: Step, label: string): Chamber {
  return note({ ...c, step: "caucus", after, timer: timerFor(label, secs) }, `${label}: ${clock(secs * 1000)}`);
}
/** The chair sets how long the caucus is before it starts. */
export function setCaucusSecs(c: Chamber, secs: number): Chamber {
  if (c.step !== "caucus" || running(c.timer) || secs < 5 || secs > 10800) return c;
  return { ...c, timer: timerFor(c.timer?.label ?? "Caucus", secs) };
}
// A caucus may be called between amendments, or while one is being dealt with.
export function callCaucus(c: Chamber, secs: number): Chamber {
  if (c.speech || (c.step !== "floor" && c.step !== "amend")) return c;
  return enterCaucus({ ...c, result: null }, secs, c.step, "Caucus");
}
export function endCaucus(c: Chamber): Chamber {
  if (c.step !== "caucus") return c;
  return note({ ...c, step: c.after ?? "floor", after: null, timer: null }, "Caucus ended");
}

/* Amendments */

// Notes come in from the caucus on, and are taken one at a time once it is over. Signatories are the states that sign it.
export function submitAmendment(c: Chamber, id: string, by: string, clause: string, text: string, backers: string[]): Chamber {
  const open = c.step === "caucus" || c.step === "floor" || c.step === "amend";
  const body = text.trim().slice(0, 600);
  if (!open || !body || !has(c, by) || c.amendments.some((a) => a.id === id)) return c;
  const ids = [...new Set(backers)].filter((b) => b !== by && has(c, b));
  // Each one is handed in after the last, even within the same millisecond, so "oldest first" is always well defined.
  const at = Math.max(now(), ...c.amendments.map((x) => x.at + 1));
  const a: Amendment = { id, by, clause: clause.trim().slice(0, 40), text: body, backers: ids, at, status: "waiting" };
  let next: Chamber = record({ ...c, amendments: [...c.amendments, a] }, by, "amendment", 0, at);
  for (const b of ids) next = record(next, b, "signatory", 0, at, by);
  return note(next, `Amendment from ${nameOf(c, by)}${a.clause ? ` (${a.clause})` : ""}, ${ids.length} signator${ids.length === 1 ? "y" : "ies"}`);
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
// The waiting ones in the order the chair will take them: as handed in, until the chair sorts or moves them.
export const waitingAmendments = (c: Chamber) => c.amendments.filter((a) => a.status === "waiting");
// Put the waiting amendments back into the places the waiting ones held, in a new order.
const reorder = (c: Chamber, waiting: Amendment[]): Chamber => {
  let i = 0;
  return { ...c, amendments: c.amendments.map((a) => (a.status === "waiting" ? waiting[i++] : a)) };
};
/** Most signatories first (oldest first among equals), or oldest first. */
export function sortAmendments(c: Chamber, how: "signatories" | "oldest"): Chamber {
  const sorted = [...waitingAmendments(c)].sort((a, b) => (how === "signatories" ? b.backers.length - a.backers.length || a.at - b.at : a.at - b.at));
  return reorder(c, sorted);
}
export function moveAmendment(c: Chamber, id: string, by: -1 | 1): Chamber {
  const w = [...waitingAmendments(c)];
  const at = w.findIndex((a) => a.id === id);
  const to = at + by;
  if (at < 0 || to < 0 || to >= w.length) return c;
  [w[at], w[to]] = [w[to], w[at]];
  return reorder(c, w);
}

export function entertain(c: Chamber, id: string): Chamber {
  const a = c.amendments.find((x) => x.id === id);
  if (c.step !== "floor" || c.speech || c.amend || a?.status !== "waiting") return c;
  return note({ ...setAmendment(c, id, "entertained"), step: "amend", amend: { id, stage: "read" }, debate: emptyDebate(), result: null }, `Amendment from ${nameOf(c, a.by)} read to the council`);
}
// Think better of it before any ruling: the amendment goes back to waiting.
export function backOutAmendment(c: Chamber, id: string): Chamber {
  if (c.step !== "amend" || c.amend?.id !== id || c.amend.stage !== "read") return c;
  return note({ ...setAmendment(c, id, "waiting"), step: "floor", amend: null, debate: emptyDebate() }, "Amendment set aside for now");
}
const poll = (title: string, kind: Poll["kind"]): Poll => ({ title, kind, yes: 0, no: 0, abstain: 0 });
export function amendAsk(c: Chamber, id: string): Chamber {
  if (c.step !== "amend" || c.amend?.id !== id || c.amend.stage !== "read") return c;
  return note({ ...c, amend: { ...c.amend, stage: "ask" }, poll: poll("Debate this amendment?", "debate") }, "Vote on whether to debate the amendment");
}
export function amendDebate(c: Chamber, id: string): Chamber {
  if (c.step !== "amend" || c.amend?.id !== id || c.amend.stage !== "read") return c;
  return note({ ...c, amend: { ...c.amend, stage: "debate" }, poll: null }, "Amendment to be debated");
}
export function amendVote(c: Chamber, id: string): Chamber {
  if (c.step !== "amend" || c.amend?.id !== id || (c.amend.stage !== "read" && c.amend.stage !== "debate") || c.speech) return c;
  return note({ ...c, amend: { ...c.amend, stage: "vote" }, poll: poll("Adopt this amendment?", "amendment") }, "Vote on the amendment");
}
export function tally(c: Chamber, which: "yes" | "no" | "abstain", by: 1 | -1): Chamber {
  if (!c.poll) return c;
  return { ...c, poll: { ...c.poll, [which]: Math.min(c.delegates.length, Math.max(0, c.poll[which] + by)) } };
}
// More in favour than against passes. The President may overrule the result.
export const passes = (p: Pick<Poll, "yes" | "no">) => p.yes > p.no;

export function decideAsk(c: Chamber, overrule: boolean, id: string): Chamber {
  const p = c.poll;
  if (c.step !== "amend" || c.amend?.id !== id || c.amend.stage !== "ask" || p?.kind !== "debate") return c;
  const yes = overrule ? !passes(p) : passes(p);
  const result: Result = { title: p.title, kind: "debate", amendment: id, passed: yes, yes: p.yes, no: p.no, abstain: p.abstain };
  const tail = `${p.yes} for, ${p.no} against, ${p.abstain} abstaining${overrule ? ", overruled" : ""}`;
  if (yes) return note({ ...c, amend: { ...c.amend, stage: "debate" }, poll: null, result }, `Amendment to be debated (${tail})`);
  return note({ ...c, amend: { ...c.amend, stage: "vote" }, poll: poll("Adopt this amendment?", "amendment"), result }, `Not to be debated (${tail}); straight to the vote`);
}
export function decideAmendment(c: Chamber, overrule: boolean, id: string): Chamber {
  const p = c.poll;
  const a = c.amendments.find((x) => x.id === c.amend?.id);
  if (c.step !== "amend" || c.amend?.id !== id || c.amend.stage !== "vote" || p?.kind !== "amendment" || !a) return c;
  const yes = overrule ? !passes(p) : passes(p);
  const result: Result = { title: `Amendment from ${nameOf(c, a.by)}`, kind: "amendment", amendment: a.id, passed: yes, yes: p.yes, no: p.no, abstain: p.abstain };
  const tail = `${p.yes} for, ${p.no} against, ${p.abstain} abstaining${overrule ? ", overruled" : ""}`;
  // On to the next amendment.
  const next: Chamber = { ...setAmendment(c, a.id, yes ? "passed" : "failed"), step: "floor", amend: null, poll: null, debate: emptyDebate(), result, timer: null };
  return note(next, `Amendment from ${nameOf(c, a.by)} ${yes ? "passed" : "failed"} (${tail})`);
}

/* The speakers' list for the amendment in hand */

export const listOpen = (c: Chamber) => c.step === "amend" && c.amend?.stage === "debate";
export const spokeOn = (c: Chamber, who: string, side: Side) => c.debate.run.some((s) => s.id === who && s.side === side);
export function canAdd(c: Chamber, who: string, side: Side): boolean {
  return listOpen(c) && has(c, who) && !c.debate.list.some((s) => s.id === who) && c.speech?.who !== who && !spokeOn(c, who, side);
}
export function addToList(c: Chamber, who: string, side: Side): Chamber {
  return canAdd(c, who, side) ? { ...c, debate: { ...c.debate, list: [...c.debate.list, { id: who, side }] } } : c;
}
export function removeFromList(c: Chamber, who: string): Chamber {
  return { ...c, debate: { ...c.debate, list: c.debate.list.filter((s) => s.id !== who) } };
}
// A state changes its side by note; it may not go back to a side it has already spoken on.
export function switchSide(c: Chamber, who: string): Chamber {
  const slot = c.debate.list.find((s) => s.id === who);
  if (!slot || spokeOn(c, who, other(slot.side))) return c;
  return { ...c, debate: { ...c.debate, list: c.debate.list.map((s) => (s.id === who ? { ...s, side: other(slot.side) } : s)) } };
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

/* Closing */

export function closeDebate(c: Chamber): Chamber {
  if (c.step !== "floor" || c.speech || c.amend) return c;
  return note({ ...c, step: "closing", closers: [], result: null }, "Debate closed");
}
export function startVote(c: Chamber): Chamber {
  if (c.step !== "closing" || c.speech) return c;
  return note({ ...c, step: "vote", ballots: {} }, "Roll call vote");
}

/* The vote on the resolution: a roll call */

export function cast(c: Chamber, who: string, ballot: Ballot | null): Chamber {
  if (c.step !== "vote" || !has(c, who)) return c;
  const ballots = { ...c.ballots };
  if (ballot) ballots[who] = ballot; else delete ballots[who];
  return { ...c, ballots };
}
export function count(c: Chamber) {
  const out = { yes: 0, no: 0, abstain: 0, left: 0 };
  for (const d of c.delegates) {
    const b = c.ballots[d.id];
    if (b === "for") out.yes++;
    else if (b === "against") out.no++;
    else if (b === "abstain") out.abstain++;
    else out.left++;
  }
  return out;
}
// Three-fifths of all the member states. An abstention counts as neither for nor against, but the total stays the same.
export const needed = (members: number) => Math.ceil((members * 3) / 5);
export function finishVote(c: Chamber): Chamber {
  if (c.step !== "vote") return c;
  const n = count(c);
  if (n.left) return c;
  const need = needed(c.delegates.length);
  const passed = n.yes >= need;
  const outcome: Outcome = { passed, yes: n.yes, no: n.no, abstain: n.abstain, needed: need };
  return note({ ...c, step: "closed", outcome }, `Resolution ${passed ? "approved" : "not approved"}: ${n.yes} for, ${n.no} against, ${n.abstain} abstaining${passed ? "" : `, ${need} needed`}`);
}
// Back to amending the ballots, if the result was recorded too soon.
export function reopenVote(c: Chamber): Chamber {
  if (c.step !== "closed" || !c.outcome) return c;
  return note({ ...c, step: "vote", outcome: null }, "Vote reopened");
}
/** The chair closes the committee after the last resolution. Everything stays, so the analytics can still be read and it can be reopened. */
export function endCommittee(c: Chamber): Chamber {
  return c.step === "closed" ? note({ ...c, step: "ended", timer: null, speech: null }, "Committee ended") : c;
}
export function reopenCommittee(c: Chamber): Chamber {
  return c.step === "ended" ? note({ ...c, step: "closed" }, "Committee reopened") : c;
}
// The states and minutes stay; the next resolution starts at the welcome.
export function newResolution(c: Chamber, title: string): Chamber {
  const t = title.trim().slice(0, 160);
  if (c.step !== "closed" || !t) return c;
  return note({
    ...c, topic: t, step: "welcome", after: null, roll: {}, roles: { proposer: null, seconder: null, opposer: null }, closers: [],
    debate: emptyDebate(), speech: null, amendments: [], amend: null, poll: null, result: null, timer: null, ballots: {}, outcome: null,
  }, `Next resolution: ${t}`);
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

/* Analytics: what each state did, and for how long */

const used = (c: Chamber, at: number) => (c.timer ? Math.max(0, Math.round((c.timer.total - remaining(c.timer, at)) / 1000)) : 0);
const record = (c: Chamber, who: string, kind: StatKind, secs: number, at: number, withWho?: string): Chamber =>
  ({ ...c, stats: [...c.stats, { at, who, kind, secs, res: c.topic, ...(withWho ? { with: withWho } : {}) }] });
const SPEECH_KIND: Record<Role, StatKind> = { proposer: "proposer", seconder: "seconder", opposer: "opposer", speaker: "speaker", amender: "amender", closer: "closing" };
export const STAT_LABEL: Record<StatKind, string> = {
  proposer: "Proposer", seconder: "Seconder", opposer: "Opposer", amender: "Amendment speech", speaker: "Speaker", closing: "Closing speech",
  poi: "Point of Information asked", reply: "Point of Information answered", amendment: "Amendment submitted", signatory: "Amendment signed",
};
/** A speech, as opposed to a Point of Information or a note handed in. */
export const isSpeech = (k: StatKind) => k === "proposer" || k === "seconder" || k === "opposer" || k === "amender" || k === "speaker" || k === "closing";
export function summary(c: Chamber) {
  return c.delegates.map((d) => {
    const mine = c.stats.filter((s) => s.who === d.id);
    const n = (k: StatKind) => mine.filter((s) => s.kind === k).length;
    return {
      id: d.id, name: d.name,
      secs: mine.reduce((sum, s) => sum + s.secs, 0),
      speeches: mine.filter((s) => isSpeech(s.kind)).length,
      asked: n("poi"), answered: n("reply"), amendments: n("amendment"), signed: n("signatory"),
    };
  });
}

/* What is open right now, for the display: the negotiation chamber (Evatt rule 40 opens it before the seconder is called; rule 42 closes it
   during a caucus and while an amendment is read, explained and voted on; it stays closed from the closing speeches on), notes with amendments
   (from the first caucus of the debate until the closing), and the speakers' list (once the council has voted to debate an amendment). */
export function rooms(c: Chamber) {
  const speakers = c.amend?.stage === "debate" && (c.step === "amend" || (c.step === "caucus" && c.after === "amend"));
  return {
    negotiation: c.step === "seconder" || c.step === "opposer" || c.step === "floor" || (c.step === "amend" && c.amend?.stage === "debate"),
    amendments: c.step === "caucus" || c.step === "floor" || c.step === "amend",
    speakers,
  };
}

/* Where the council is: three parts, each with a step inside it */
export const STAGES = ["Opening", "Debate", "Closing"] as const;
export function stageIndex(c: Chamber): number {
  switch (c.step) {
    case "welcome": case "roll": case "pick": case "proposer": case "seconder": case "opposer": return 0;
    case "caucus": case "floor": case "amend": return 1;
    default: return 2;
  }
}
export function substep(c: Chamber): string {
  switch (c.step) {
    case "welcome": return "Welcome";
    case "roll": return "Roll call";
    case "pick": return "Choose the speakers";
    case "proposer": return "Proposer";
    case "seconder": return "Seconder";
    case "opposer": return "Opposer";
    case "caucus": return "Caucus";
    case "floor": return "Amendments";
    case "amend": return c.amend?.stage === "read" ? "Amendment read" : c.amend?.stage === "ask" ? "Vote on whether to debate" : c.amend?.stage === "debate" ? "Amendment debate" : "Vote on the amendment";
    case "closing": return "Closing speeches";
    case "vote": return "Roll call vote";
    case "ended": return "Ended";
    default: return "Result";
  }
}

/* Storage */
export function load(): Chamber | null {
  try { return normalise(JSON.parse(localStorage.getItem(KEY) ?? "null")); } catch { return null; }
}
export function save(c: Chamber | null) {
  try { c ? localStorage.setItem(KEY, JSON.stringify(c)) : localStorage.removeItem(KEY); } catch { /* storage blocked: the console still works for this visit */ }
}
