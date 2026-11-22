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
/** The roll call: absent, present (may abstain on the resolution), or present and voting (must vote For or Against). */
export type Attend = "absent" | "present" | "voting";
export type Ballot = "for" | "against" | "abstain";
export type Delegate = { id: string; name: string };
/** A state on a speakers' list, or one that has spoken, with the side it spoke on. */
/** `stance`: the state said it speaks For or Against (the Trinity general list and moderated caucus), so the side is shown. */
export type Slot = { id: string; side: Side; stance?: boolean };
export type Role = "proposer" | "seconder" | "opposer" | "speaker" | "amender" | "closer" | "statement";
/** speech, then the speaker says how they yield (after): to the chair, which ends their turn, or to Points of Information,
    which are then taken one at a time (ask, then answer, then after again) until the chair ends them. */
export type Phase = "speech" | "after" | "ask" | "answer";
/** `left` is the time the speaker had unused when the speech ended, in seconds: what a yield to another country passes on.
    `points` is set once the speaker has yielded to Points of Information. */
export type Speech = { who: string; side: Side; role: Role; phase: Phase; asker: string | null; pois: number; left?: number; stance?: boolean; points?: boolean };
/** The speaker has yielded to Points of Information, and they are being taken. Before that, the speech is over and the
    chair is asking how they yield. */
export const takingPoints = (sp: Speech) => sp.phase === "ask" || sp.phase === "answer" || (sp.phase === "after" && (!!sp.points || sp.pois > 0));
/** The speeches on the amendment in hand. */
export type Debate = { list: Slot[]; run: Slot[] };
/** `backers` are the amendment's signatories. `at` is when it was handed in. */
/** Strike a clause, amend it, or add one. */
export type AmendHow = "strike" | "amend" | "add";
export type Amendment = { id: string; by: string; how?: AmendHow; /** Trinity: the second signatory. */ seconder?: string | null; clause: string; text: string; backers: string[]; at: number; status: "waiting" | "entertained" | "passed" | "failed" | "withdrawn" | "invalid";
  /** Standard and Custom: an amendment to this amendment (second degree) has `to`, the amendment it changes. Its text is the amendment's new wording. */
  to?: string;
  /** The amendment's wording before an amendment to it passed. */
  was?: string };
/** Standard and Custom: an amendment to the amendment being debated, debated and voted on first. `held` is the amendment's own speakers' list, set aside meanwhile. */
export type SubAmend = { id: string; stage: "debate" | "vote"; held: Debate };
/** What a state did, for the analytics: a speech of each kind, a Point of Information asked or answered, an amendment handed in or signed. */
export type StatKind = "proposer" | "seconder" | "opposer" | "amender" | "speaker" | "closing" | "poi" | "reply" | "amendment" | "signatory" | "statement";
/** `wk` is the week of a Trinity committee the entry was made in. */
export type Stat = { at: number; who: string; kind: StatKind; secs: number; with?: string; res: string; wk?: 1 | 2 };
export type AmendStage = "read" | "ask" | "debate" | "vote";
/** A vote by placard: counts only. */
/** `motion` is the Trinity motion being voted on. */
/** `ballots`: when the chair takes the vote by roll call, each state's answer; the three counts are then worked out from it. */
export type Poll = { title: string; kind: "debate" | "amendment" | "motion"; yes: number; no: number; abstain: number; motion?: string; ballots?: Record<string, Ballot> };
/** `kind` says which vote it was (whether to debate an amendment, or whether to adopt it) and `amendment` which one. */
export type Result = { title: string; kind: "debate" | "amendment" | "motion"; amendment?: string; /** The Trinity motion a result is for. */ motion?: string; passed: boolean; yes: number; no: number; abstain: number; ballots?: Record<string, Ballot> };
/** `struck`: the parts of a divided question that failed, so are not in the resolution. */
export type Outcome = { passed: boolean; yes: number; no: number; abstain: number; needed: number; struck?: string[] };
/** Standard and Custom: a divided question. Each part is voted on in turn (`at`), then what remains as a whole (`at` equal to the number of parts). */
export type Part = { label: string; result: "passed" | "failed" | null; yes?: number; no?: number; abstain?: number };
export type Division = { parts: Part[]; at: number };
/** An answer in the roll-call vote on a resolution. Standard and Custom also take Pass, and For or Against with Rights. */
export type Answer = Ballot | "pass" | "forRights" | "againstRights";
/** States that voted with rights, waiting to explain their vote, and the one explaining now. */
export type Explain = { queue: { id: string; side: Side }[]; who: { id: string; side: Side } | null };
export type Entry = { at: number; text: string };
export type Step = "welcome" | "roll" | "pick" | "proposer" | "seconder" | "opposer" | "caucus" | "floor" | "amend" | "closing" | "vote" | "closed" | "ended"
  | "statements" | "general";

/* Trinity Grammar MUN: what a committee under its rules keeps besides what Evatt does. */
export type Doc = {
  id: string; kind: "draft"; title: string; week: 1 | 2; seen: boolean; proposer: string | null; seconder: string | null;
  sponsors: string[]; status: "submitted" | "approved" | "sent"; link: string; clauses: string; at: number; from: string[]; result: "passed" | "failed" | null;
};
export type MotionKind = "mod" | "unmod" | "extend" | "closemod" | "close" | "amend" | "open" | "resume" | "suspend";
export type Motion = { id: string; kind: MotionKind; by: string | null; topic: string; total: number; per: number; ref: string | null; at: number; status: "waiting" | "passed" | "failed" | "withdrawn" };
export type PointKind = "order" | "privilege" | "inquiry" | "clarification";
/** A caucus in progress. A moderated one (and an amendment's debate) keeps its own clock for the whole caucus while the committee's timer times each speaker. */
export type Caucus = { kind: "mod" | "unmod" | "amend" | "final"; /** The 5 minutes that open the debate on a resolution. */ intro?: boolean; topic: string; per: number; total: number; ext: number; clock: Timer | null };
export type Trin = {
  week: 1 | 2; docs: Doc[]; motions: Motion[]; opened: string[]; cauc: Caucus | null;
  /** The speakers' list kept aside while a caucus or an amendment uses the committee's own. */
  saved: Debate | null;
  /** The resolution being debated. */
  current: string | null;
  /** Time a state was passed by a yield to another country, to add to its own. */
  bonus: { id: string; secs: number } | null;
  points: { at: number; kind: PointKind; wk: 1 | 2 }[];
  replies: { at: number; by: string; to: string | null; outcome: "apologised" | "withdrew" | "refused" | null; wk: 1 | 2 }[];
  /** A state under the honorary observer sanction, and when it ends. */
  observers: Record<string, number>;
  /** The roll call of each week once it is over. */
  rolls: Record<string, Record<string, Attend>>;
  /** A speech's own timer, kept while a right of reply is heard. */
  stash: Timer | null;
  reply: { by: string; to: string | null } | null;
  /** Whether the final unmoderated caucus before the closing speeches has been held. */
  finalDone: boolean;
  /** The roll is being taken again at the start of a new session: once it is done, the committee goes back to the general debate. */
  retake?: boolean;
};

// Times are milliseconds. A running timer has `endsAt`; a paused one keeps what is left in `left`. The time on screen
// is always worked out from the clock, never counted down, so a throttled background tab can't drift.
/** A chair's marks for one state: points out of 10 for each of the four things chairs look for, and a private note. */
export type Score = { speaking: number; diplomacy: number; knowledge: number; procedure: number; note: string };
export const SCORE_KEYS = ["speaking", "diplomacy", "knowledge", "procedure"] as const;
export const SCORE_LABEL: Record<(typeof SCORE_KEYS)[number], string> = { speaking: "Speaking", diplomacy: "Diplomacy", knowledge: "Knowledge", procedure: "Procedure" };
/** `over`: how far past zero a timer was when it was paused in overtime. */
export type Timer = { label: string; total: number; endsAt: number | null; left: number; over?: number };

export type Chamber = {
  v: 1;
  rules: "evatt" | "trinity";
  /** A committee on the general rules of procedure runs on the same engine as Trinity Grammar MUN; this says which it is, for its name and its own few rules. */
  style?: "standard" | "custom";
  /** Custom only: what a resolution needs to pass. Without it, more For than Against. */
  pass?: "simple" | "twothirds";
  /** The chairs' marks for each state. */
  scores?: Record<string, Score>;
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
  /** Evatt: the speakers' list for the resolution, set aside while an amendment is debated. */
  held?: Debate | null;
  speech: Speech | null;
  amendments: Amendment[];
  amend: { id: string; stage: AmendStage; /** Standard and Custom: an amendment to this amendment, in hand. */ sub?: SubAmend | null } | null;
  poll: Poll | null;
  /** The last placard vote's outcome, kept until the next thing starts. */
  result: Result | null;
  timer: Timer | null;
  ballots: Record<string, Ballot>;
  outcome: Outcome | null;
  stats: Stat[];
  /** A photo behind the display: the address of a file in the photos bucket, or (for a committee not yet shared) the picture itself. */
  background: string | null;
  /** How much of the photo shows through, 20 to 100. */
  backgroundStrength: number;
  /** Where the photo is framed on the display, as percentages across and down. Missing means the middle. */
  backgroundAt?: [number, number];
  log: Entry[];
  /** Only a Trinity Grammar MUN committee has this. */
  tr: Trin | null;
  /** The committee as it stood before each of the chair's last few actions, newest last: what Back returns to. */
  hist?: Chamber[];
  /** The times the chair has set for each kind of speech, in seconds; any not set keep the procedure's own. */
  times?: Partial<Record<TimeKey, number>>;
  /** Delegates' requests already acted on, by id (see asked()). */
  asked?: string[];
  /** On a step kept for Back only: who made the change that came after it (a chair's user id), and what it was. A step
      saved before this was kept has neither, and any chair can take it back. */
  by?: string;
  what?: string;
  /** The display shows the delegates' join code and a QR code to the join page. The chair's own setting, like the photo. */
  showJoin?: boolean;
  /** The display's sounds, the chair's own setting (both off unless turned on): a soft tone when a speech reaches 0:00
      and again 10 seconds over (`end`), and one 10 seconds before the end (`warn`). */
  chime?: { end?: boolean; warn?: boolean };
  /** Standard and Custom, in the roll-call vote on a resolution: the states that passed (asked again at the end, and then
      must vote For or Against), and the states voting with rights (counted as For or Against, then explain their vote). */
  passed?: string[];
  rights?: string[];
  /** Standard and Custom: explanations of vote still to be given after a roll-call vote with rights. */
  explain?: Explain;
  /** Standard and Custom: the question on the resolution divided into parts. */
  divide?: Division;
};

/** The times a committee can set for itself, in the order the settings show them. */
export type TimeKey = "speaker" | "statement" | "proposer" | "seconder" | "opposer" | "closer" | "amender" | "poi" | "amendPer" | "amendTotal";
/** What each time is when the chair has not set it: Evatt gives every speech the committee's one time; Trinity fixes most of them. */
export function defaultTime(c: Chamber, k: TimeKey): number {
  if (k === "poi") return POI_SECS;
  if (c.tr) {
    switch (k) {
      case "statement": return TR.statement;
      case "proposer": case "seconder": return TR.speech;
      case "opposer": return TR.introOppose;
      case "closer": return TR.oppose;
      case "amendPer": case "amender": return TR.amendPer;
      case "amendTotal": return TR.amend;
    }
  }
  return c.speakSecs;
}
export const timeOf = (c: Chamber, k: TimeKey): number => (k === "speaker" ? c.speakSecs : c.times?.[k] ?? defaultTime(c, k));
/** Set one time for the whole committee (null: back to the default). It applies to speeches not yet begun. */
export function setTime(c: Chamber, k: TimeKey, secs: number | null): Chamber {
  if (k === "speaker") return secs === null ? c : { ...c, speakSecs: secs };
  const times = { ...c.times };
  if (secs === null) delete times[k]; else times[k] = secs;
  return { ...c, times };
}
/** One time for every speech at once: the speakers, the roles and (Trinity) the statements and each speaker in an amendment's debate. Points of Information and the amendment debate's total keep their own. */
export function setAllSpeeches(c: Chamber, secs: number): Chamber {
  const keys: TimeKey[] = c.tr ? ["statement", "proposer", "seconder", "opposer", "closer", "amendPer"] : ["proposer", "seconder", "opposer", "closer", "amender"];
  const times = { ...c.times };
  for (const k of keys) times[k] = secs;
  return { ...c, speakSecs: secs, times };
}
export const resetTimes = (c: Chamber): Chamber => ({ ...c, times: {} });

export const KEY = "collex:chamber";
export const MAX_DELEGATES = 200;
/** Each Point of Information: this long to ask, and this long to reply. */
export const POI_SECS = 30;
export const CAUCUS_SECS = 180;
/** Trinity's fixed times, in seconds. */
// 2026: opening statements, the proposer's and co-proposer's speeches and the first opposing speech are 90 seconds; the closing speeches are 2 minutes.
export const TR = { statement: 90, speech: 90, introOppose: 90, intro: 300, final: 240, amend: 600, maxCaucus: 1200, oppose: 120, close: 120, amendPer: 60 };
/** A state under the honorary observer sanction can only write notes and join unmoderated caucuses. */
export const OBSERVER_SECS = 300;
export const observing = (c: Chamber, who: string, at = now()) => !!c.tr && (c.tr.observers[who] ?? 0) > at;

/* Time */

// Devices sharing a committee may disagree about the time. Whenever one hears from the database it learns how far its
// clock is out, and every timestamp it writes or reads goes through now() so all of them count from the same moment.
let skew = 0;
export const setSkew = (ms: number) => { skew = ms; };
export const now = () => Date.now() + skew;

// What is left on a timer, below zero once it has run over: a timer keeps running past 0:00 and shows the overtime.
// `over` only counts on a paused timer with nothing left: a console still on the last build resets or nudges a timer
// paused in overtime without knowing about `over`, and the time it gives back must show as it is.
const signedLeft = (t: Timer, at: number) => (t.endsAt === null ? (t.left > 0 ? t.left : -(t.over ?? 0)) : t.endsAt - at);
export const remaining = (t: Timer, at: number) => Math.max(0, signedLeft(t, at));
/** How far past zero a timer has run, in milliseconds (0 while there is time left). */
export const overtime = (t: Timer, at: number) => Math.max(0, -signedLeft(t, at));
export const running = (t: Timer | null) => !!t && t.endsAt !== null;
export const clock = (ms: number) => {
  const secs = Math.ceil(ms / 1000);
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
};
/** The time on a timer as shown: what is left, or "+0:12" once it has run over. */
export const timerText = (t: Timer, at: number) => {
  const over = overtime(t, at);
  if (!over) return clock(remaining(t, at));
  const secs = Math.floor(over / 1000);
  return `+${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
};

/* Setting up */

const byName = (a: Delegate, b: Delegate) => a.name.localeCompare(b.name, "en-AU", { sensitivity: "base" });
export const emptyDebate = (): Debate => ({ list: [], run: [] });
export const timerFor = (label: string, secs: number): Timer => ({ label, total: secs * 1000, endsAt: null, left: secs * 1000 });

// A state's name is kept in full. Where space is tight (the display's tiles, say) a well-known long name is shown by its
// usual short form; any other long name is cut off with an ellipsis by the page, never turned into bare initials.
const SHORT: Record<string, string> = {
  "united states of america": "USA", "united states": "USA", "united kingdom": "UK", "united arab emirates": "UAE",
  "democratic republic of the congo": "DRC", "democratic republic of congo": "DRC", "central african republic": "CAR",
  "russian federation": "Russia", "peoples republic of china": "China", "republic of korea": "South Korea",
  "democratic peoples republic of korea": "North Korea", "great britain": "UK",
};
/** A state's name for a tight space: its usual short form if it has one ("USA"), otherwise the name as it is. */
export function shortName(name: string): string {
  const clean = name.trim().replace(/\s+/g, " ");
  return SHORT[clean.toLowerCase().replace(/[.'’]/g, "")] ?? clean;
}
/** A state's name as it is kept: spaces tidied and at most 60 characters, counted so an emoji or flag is never cut in half. */
export const cleanName = (raw: string) => Array.from(raw.trim().replace(/\s+/g, " ")).slice(0, 60).join("").trim();
/** Names compare without regard to case or spacing, and a well-known name matches its short form ("USA" and "United
    States of America"): a committee saved before names were kept in full holds the short form, and both would show as
    "USA" on the display. */
const nameKey = (n: string) => cleanName(n).toLocaleLowerCase("en-AU");
export const sameName = (a: string, b: string) => nameKey(a) === nameKey(b) || nameKey(shortName(a)) === nameKey(shortName(b));

// Names typed one per line or separated by commas; blanks and repeats dropped. Each is kept in full.
export function parseNames(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of text.split(/[\n,;]+/)) {
    const name = cleanName(raw);
    if (!name || seen.has(nameKey(name)) || seen.has(nameKey(shortName(name)))) continue;
    seen.add(nameKey(name)); seen.add(nameKey(shortName(name)));
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
    timer: null, ballots: {}, outcome: null, stats: [], background: null, backgroundStrength: 55, log: [{ at: now(), text: "Committee opened" }], tr: null,
  };
}

/** The committee's two given resolutions: the seen one, then the unseen one. Each keeps its slot, so it can be renamed. */
export const SLOTS: readonly { week: 1 | 2; seen: boolean }[] = [{ week: 1, seen: true }, { week: 1, seen: false }];
const agendaDoc = (slot: number, title: string, week: 1 | 2, seen: boolean): Doc => ({
  id: `agenda${slot}`, kind: "draft", title: title.trim().slice(0, 160), week, seen, proposer: null, seconder: null, sponsors: [], status: "approved", link: "", clauses: "", at: slot, from: [], result: null,
});
/** A Trinity Grammar MUN committee. `topic` is the committee's topic; . */
export function createTrinity(name: string, topic: string, speakSecs: number, names: string[], ids: string[], agenda: { title: string; week: 1 | 2; seen: boolean }[] = []): Chamber {
  // The committee is given its resolutions: they wait, approved, for the chair to introduce, and the proposer and seconder are chosen then.
  const docs: Doc[] = agenda.map((a, i) => agendaDoc(i, a.title, a.week, a.seen)).filter((d) => d.title);
  return {
    ...create(name, topic, speakSecs, names, ids), rules: "trinity",
    tr: { week: 1, docs, motions: [], opened: [], cauc: null, saved: null, current: null, bonus: null, points: [], replies: [], observers: {}, rolls: {}, stash: null, reply: null, finalDone: false },
  };
}

/** A committee on the general rules of procedure: roll call, a general speakers' list, motions for moderated and unmoderated
    caucuses, draft resolutions the chair adds as they are handed in, amendments, and a vote. `custom` lets the chair choose what a resolution needs to pass. */
export function createStandard(name: string, topic: string, speakSecs: number, names: string[], ids: string[], resolutions: string[] = [], custom?: { pass: "simple" | "twothirds" }): Chamber {
  const base = createTrinity(name, topic, speakSecs, names, ids);
  const docs = resolutions.map((r) => r.trim()).filter(Boolean).map((title, i) => ({ ...agendaDoc(i, title, 1, true), id: `res${i}` }));
  return { ...base, style: custom ? "custom" : "standard", ...(custom ? { pass: custom.pass } : {}), tr: { ...base.tr!, docs } };
}
/** What the committee's procedure is called. */
export const procedureName = (c: Pick<Chamber, "rules" | "style">) => (c.style === "custom" ? "Custom" : c.style === "standard" ? "Standard" : c.rules === "trinity" ? "Trinity Grammar MUN" : "Evatt");

const isTrin = (t: unknown): t is Trin => {
  const o = t as Partial<Trin> | null;
  return !!o && typeof o === "object" && (o.week === 1 || o.week === 2) && Array.isArray(o.docs) && Array.isArray(o.motions) && Array.isArray(o.opened)
    && Array.isArray(o.points) && Array.isArray(o.replies) && !!o.observers && typeof o.observers === "object" && !!o.rolls && typeof o.rolls === "object";
};

// Whatever comes in from storage or the database is checked once here. A committee saved before this shape existed keeps
// its name, resolution, states and minutes, and starts again at the welcome.
const untagged = ({ by: _b, what: _w, ...x }: Chamber): Chamber => x;
export function normalise(x: unknown): Chamber | null {
  if (!x || typeof x !== "object") return null;
  const o = x as Record<string, unknown> & Partial<Chamber> & { resolution?: { title?: string } };
  if (o.v !== 1 || !Array.isArray(o.delegates) || !Array.isArray(o.log)) return null;
  const ok = (o.rules === "evatt" || (o.rules === "trinity" && isTrin(o.tr))) && o.rev === 2 && typeof o.step === "string" && o.debate && Array.isArray(o.debate.list) && Array.isArray(o.debate.run)
    && o.roll && typeof o.roll === "object" && o.roles && Array.isArray(o.closers) && Array.isArray(o.amendments) && o.ballots && typeof o.ballots === "object";
  const fixRoll = (r: Record<string, string>) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v === "abstain" ? "present" : v])) as Record<string, Attend>;
  // `by` and `what` belong only on the steps kept for Back (see remember): never on the committee itself.
  if (ok) return { ...untagged(o as Chamber), roll: fixRoll(o.roll as Record<string, string>), tr: o.rules === "trinity" ? { ...(o.tr as Trin), cauc: (o.tr as Trin).cauc ?? null, saved: (o.tr as Trin).saved ?? null, current: (o.tr as Trin).current ?? null, bonus: (o.tr as Trin).bonus ?? null, stash: (o.tr as Trin).stash ?? null, reply: (o.tr as Trin).reply ?? null, finalDone: !!(o.tr as Trin).finalDone } : null, stats: Array.isArray(o.stats) ? o.stats : [], background: validBackground(o.background) ? o.background : null, backgroundStrength: typeof o.backgroundStrength === "number" ? Math.min(100, Math.max(20, o.backgroundStrength)) : 55, ...("backgroundAt" in o ? { backgroundAt: Array.isArray(o.backgroundAt) && o.backgroundAt.length === 2 && o.backgroundAt.every((n) => typeof n === "number" && n >= 0 && n <= 100) ? [o.backgroundAt[0] as number, o.backgroundAt[1] as number] as [number, number] : undefined } : {}), amendments: (o.amendments as Amendment[]).map((a, i) => ({ ...a, at: a.at ?? i })) };
  const old = o.delegates as { id: string; name: string }[];
  const resolution = String(o.topic ?? "").trim() || String(o.resolution?.title ?? "").trim();
  const fresh = create(String(o.name ?? "Committee"), resolution, Number(o.speakSecs) || 120, [], []);
  return { ...fresh, delegates: old.map((d) => ({ id: d.id, name: d.name })).sort(byName), log: (o.log as Entry[]).slice(-200) };
}

/* Back: every action the chair takes keeps the committee as it was, so the last few can be taken back. The photo and its strength
   are the chair's own setting, not part of the debate, so they are neither kept nor taken back. */
export const HISTORY = 12;
/* A shared committee is saved whole, and the database takes at most 256 KB. Two things grow without end, so both are
   kept in check here: the minutes keep their most recent LOG_MAX lines, and if the steps kept for Back are too big
   together, the oldest go first. Each step is a whole copy, as it has always been, so every console (an older one left
   open included) restores it the same way. */
export const LOG_MAX = 400;
/** The most the committee and its steps for Back may come to, in characters of JSON: well under the database's 256 KB. */
export const SIZE_BUDGET = 200_000;
const size = (x: unknown) => JSON.stringify(x).length;
// A step kept for Back never changes, and the same one is carried from action to action, so its size is worked out once.
const stepSizes = new WeakMap<Chamber, number>();
const stepSize = (x: Chamber) => { let n = stepSizes.get(x); if (n === undefined) { n = size(x); stepSizes.set(x, n); } return n; };
// Within the budget: the oldest steps go until it fits. The background photo isn't counted: a committee kept only in
// this browser holds the photo itself, and that never goes to the database.
function within(c: Chamber, kept: Chamber[]): Chamber[] {
  let total = size({ ...c, hist: undefined, background: null });
  const sizes = kept.map(stepSize);
  for (const n of sizes) total += n;
  let drop = 0;
  while (drop < kept.length && total > SIZE_BUDGET) total -= sizes[drop++];
  return drop ? kept.slice(drop) : kept;
}
/** The committee after `fn`, with the one before it kept for Back. A change that does nothing keeps nothing. `by` is the
    chair who made the change (their user id), so another chair's Back can't take it away; the step also keeps what the
    change was, in the words the minutes used, so Back can say what it will undo. */
export function remember(before: Chamber, after: Chamber, by?: string): Chamber {
  if (after === before) return after;
  const { hist, by: _by, what: _what, ...rest } = before;
  const last = after.log[after.log.length - 1];
  const what = last && last !== before.log[before.log.length - 1] ? last.text.slice(0, 120) : undefined;
  const kept = [...(hist ?? []).slice(-(HISTORY - 1)), { ...rest, background: null, ...(by ? { by } : {}), ...(what ? { what } : {}) }];
  // `by` and `what` belong on kept steps only. A console still on the last build copies them onto the committee when it
  // goes back; left there they would tag the next step with the wrong chair.
  const { by: _b, what: _w, ...live } = after;
  return { ...live, hist: within(live, kept) };
}
/** The committee small enough to save: a committee saved before the limits above (or grown by changes that keep no step,
    such as the clock) lets go of its oldest minutes and steps for Back. The same committee if nothing had to go. */
export function fit(c: Chamber): Chamber {
  const cut = c.log.length - LOG_MAX;
  const x = cut > 0 ? { ...c, log: c.log.slice(cut) } : c;
  if (!x.hist?.length) return x;
  const kept = within(x, x.hist);
  return kept === x.hist ? x : { ...x, hist: kept };
}
export const canGoBack = (c: Chamber) => !!c.hist?.length;
/** Whether the last step kept for Back was made by another chair: `by` is the chair asking. Untagged steps belong to anyone. */
export const backIsOthers = (c: Chamber, by?: string) => { const top = c.hist?.[c.hist.length - 1]; return !!top?.by && !!by && top.by !== by; };
/** What Back would undo, in a few words ("Call Brazil"), or null when the step doesn't say. */
export const backWhat = (c: Chamber): string | null => c.hist?.[c.hist.length - 1]?.what ?? null;
export const BACK_OTHERS = "The last change was another chair's, so it wasn't undone.";
/** Take back the last action. A clock that was running is stopped where it stands, so the chair starts it again. `by` is
    the chair going back: a step another chair made is left alone (two chairs at once: the newer copy's last step may be
    theirs). The chairs' marks, the photo and the join code on the display are settings, not part of the debate, so the
    ones in place now are kept. */
export function goBack(c: Chamber, at: number, by?: string): Chamber {
  const hist = c.hist ?? [];
  const top = hist[hist.length - 1];
  if (!top || backIsOthers(c, by)) return c;
  const { by: _by, what: _what, ...prev } = top;
  const stop = (t: Timer | null) => (t && t.endsAt !== null ? { ...t, endsAt: null, left: remaining(t, at), ...(overtime(t, at) ? { over: overtime(t, at) } : {}) } : t);
  const tr = prev.tr ? { ...prev.tr, cauc: prev.tr.cauc ? { ...prev.tr.cauc, clock: stop(prev.tr.cauc.clock) } : prev.tr.cauc } : prev.tr;
  const { scores: _scores, showJoin: _showJoin, chime: _chime, ...base } = prev;
  return note({
    ...base, tr, timer: stop(prev.timer), background: c.background, backgroundStrength: c.backgroundStrength, ...(c.backgroundAt ? { backgroundAt: c.backgroundAt } : {}),
    ...(c.scores ? { scores: c.scores } : {}), ...(c.showJoin ? { showJoin: true } : {}), ...(c.chime ? { chime: c.chime } : {}), hist: hist.slice(0, -1),
  }, "Went back one step");
}

/** Whether a save the database refused will never succeed however often it is sent: the committee broke a rule of the
    database (too big, a bad shape) rather than the network or the login failing. A lost connection, a server that is
    busy or down, or a login that has run out (401, PGRST301) are worth trying again; so is a clash with another save. */
export function savePermanent(code: string | undefined, status: number | undefined): boolean {
  if (status === 401 || status === 408 || status === 429 || (status !== undefined && (status === 0 || status >= 500))) return false;
  const k = code ?? "";
  if (!k || k.startsWith("PGRST3") || /^PGRST00[0-3]$/.test(k)) return false;
  // Postgres: no connection (08), a clash with another transaction (40), out of resources (53) or cancelled (57).
  if (/^(08|40|53|57)/.test(k)) return false;
  // Postgres: data that breaks a rule (22, 23), too big (54), a statement the database won't run (42, 0A) or an error raised on purpose (P0).
  return /^(22|23|42|54|0A|P0)/.test(k) || (status !== undefined && status >= 400 && status < 500);
}

/** Whether the committee already holds a motion or amendment made with this id: a delegate's request accepted by
    one chair carries the request's id, so a second chair accepting the same request adds nothing. */
export const holds = (c: Chamber, id: string) => c.amendments.some((a) => a.id === id) || !!c.tr?.motions.some((m) => m.id === id) || !!c.asked?.includes(id);
/** Mark a delegate's request as acted on. Requests that leave nothing with their id behind (a point, a place on the
    speakers' list) are remembered here, so a second chair accepting the same one adds nothing. The latest 80 are kept. */
export const asked = (c: Chamber, id: string): Chamber => (c.asked?.includes(id) ? c : { ...c, asked: [...(c.asked ?? []).slice(-79), id] });

/** Add a line to the minutes. Past LOG_MAX lines the oldest are let go, so the committee can always be saved. */
export const note = (c: Chamber, text: string): Chamber => {
  const log = [...c.log, { at: now(), text }];
  const cut = log.length - LOG_MAX;
  return cut > 0 ? { ...c, log: log.slice(cut) } : { ...c, log };
};
export const nameOf = (c: Chamber, who: string | null) => c.delegates.find((d) => d.id === who)?.name ?? "";
export const has = (c: Chamber, who: string | null | undefined): who is string => !!who && c.delegates.some((d) => d.id === who);
export const other = (s: Side): Side => (s === "for" ? "against" : "for");
const sideWord = (s: Side) => (s === "for" ? "in favour" : "against");

export const ROLE_LABEL: Record<Role, string> = { proposer: "Proposer", seconder: "Seconder", opposer: "Opposer", speaker: "Speaker", amender: "Amendment Proposer", closer: "Closing Speech", statement: "Opening Statement" };
/** A Trinity committee calls the seconder a co-sponsor. */
export const roleName = (c: Chamber, r: Role) => (c.tr && r === "seconder" ? "Co-sponsor" : ROLE_LABEL[r]);
/** What the document being debated is called. */
export const resNoun = (_c: Chamber) => "Resolution";
export const ATTEND_LABEL: Record<Attend, string> = { absent: "Absent", present: "Present", voting: "Present & Voting" };
/** A state that is there: marked present or present and voting, or not marked at all. Only a state marked Absent is away.
    This one rule is used everywhere: the speakers' list, the votes, and "X of N present". */
export const isHere = (c: Chamber, who: string) => c.roll[who] !== "absent";

/* The display's background photo */
const BG_URL = /^https:\/\/npdaczdwmhbtgitmplxc\.supabase\.co\/storage\/v1\/object\/public\/photos\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp)$/;
const BG_DATA = /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/;
/** Only a file in our own photos bucket or a small JPEG carried in the committee: it ends up inside a CSS url(), so nothing else gets through. */
export const validBackground = (v: unknown): v is string => typeof v === "string" && ((v.length <= 600 && BG_URL.test(v)) || (v.length <= 700_000 && BG_DATA.test(v)));
export function setBackground(c: Chamber, bg: string | null): Chamber {
  return bg === null || validBackground(bg) ? { ...c, background: bg, backgroundAt: undefined } : c;
}
export function setBackgroundAt(c: Chamber, x: number, y: number): Chamber {
  const k = (n: number) => Math.min(100, Math.max(0, Math.round(n)));
  return Number.isFinite(x) && Number.isFinite(y) ? { ...c, backgroundAt: [k(x), k(y)] } : c;
}
/** Show the delegates' join code on the display, or hide it. */
export const setShowJoin = (c: Chamber, on: boolean): Chamber => (!!c.showJoin === on ? c : { ...c, showJoin: on });
/** Turn one of the display's sounds on or off. With both off the setting goes, as on a committee that never had it. */
export function setChime(c: Chamber, which: "end" | "warn", on: boolean): Chamber {
  if (!!c.chime?.[which] === on) return c;
  const chime = { ...c.chime, [which]: on || undefined };
  if (!chime.end) delete chime.end;
  if (!chime.warn) delete chime.warn;
  if (chime.end || chime.warn) return { ...c, chime };
  const { chime: _c, ...rest } = c;
  return rest;
}
export function setBackgroundStrength(c: Chamber, n: number): Chamber {
  return Number.isFinite(n) ? { ...c, backgroundStrength: Math.min(100, Math.max(20, Math.round(n))) } : c;
}

/* People */
export function addDelegate(c: Chamber, id: string, name: string): Chamber {
  const clean = cleanName(name);
  if (!clean || c.delegates.length >= MAX_DELEGATES || c.delegates.some((d) => d.id === id || sameName(d.name, clean))) return c;
  return { ...c, delegates: [...c.delegates, { id, name: clean }].sort(byName) };
}
/** Why a state can't be renamed to this, or null. */
export function renameError(c: Chamber, who: string, name: string): string | null {
  const clean = cleanName(name);
  if (!has(c, who)) return "That state is no longer in the committee.";
  if (!clean) return "Type the state's name.";
  if (c.delegates.some((d) => d.id !== who && sameName(d.name, clean))) return "Another state already has that name.";
  return null;
}
/** Fix a state's name at any point (a typo, a short form typed in error). Everything is kept by the state's id, so its
    speeches, roll, ballots, marks and seats on delegates' devices all stay with it. */
export function renameDelegate(c: Chamber, who: string, name: string): Chamber {
  const clean = cleanName(name);
  const old = nameOf(c, who);
  if (renameError(c, who, name) || old === clean) return c;
  return note({ ...c, delegates: c.delegates.map((d) => (d.id === who ? { ...d, name: clean } : d)).sort(byName) }, `${old} renamed ${clean}`);
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
/** Whether the roll can be changed now: at any point except while a vote is being taken. */
export const rollOpen = (c: Chamber) => c.step !== "vote" && !c.poll;
// A state marked absent comes off the speakers' list: it can't be called while it isn't there. That goes for the lists
// set aside meanwhile too (the resolution's, during an amendment or a moderated caucus; the amendment's, during an
// amendment to it), so it isn't back on the list when they return.
const dropAbsent = (c: Chamber): Chamber => {
  const off = (d: Debate): Debate => (d.list.every((x) => isHere(c, x.id)) ? d : { ...d, list: d.list.filter((x) => isHere(c, x.id)) });
  let next = c;
  const debate = off(c.debate);
  if (debate !== c.debate) next = { ...next, debate };
  if (c.held) { const held = off(c.held); if (held !== c.held) next = { ...next, held }; }
  if (c.tr?.saved) { const saved = off(c.tr.saved); if (saved !== c.tr.saved) next = { ...next, tr: { ...c.tr, saved } }; }
  const sub = c.amend?.sub;
  if (sub) { const held = off(sub.held); if (held !== sub.held) next = { ...next, amend: { ...c.amend!, sub: { ...sub, held } } }; }
  return next;
};
/** Mark a state at roll call, or change its mark later (a late arrival, a state that left). Outside the roll call itself the change goes in the minutes. */
export function markRoll(c: Chamber, who: string, a: Attend | null): Chamber {
  if (!rollOpen(c) || !has(c, who) || (c.roll[who] ?? null) === a) return c;
  const roll = { ...c.roll };
  if (a) roll[who] = a; else delete roll[who];
  const next = dropAbsent({ ...c, roll });
  return c.step === "roll" ? next : note(next, `${nameOf(c, who)} marked ${a ? ATTEND_LABEL[a].toLowerCase() : "not marked"}`);
}
export function markAllRoll(c: Chamber, a: Attend): Chamber {
  if (!rollOpen(c)) return c;
  const next = dropAbsent({ ...c, roll: Object.fromEntries(c.delegates.map((d) => [d.id, a])) });
  return c.step === "roll" ? next : note(next, `Every state marked ${ATTEND_LABEL[a].toLowerCase()}`);
}
/** Trinity and Standard: the roll is taken again at the start of a new session, from the general debate between resolutions. The last roll is kept. */
export const canRetakeRoll = (c: Chamber) => !!c.tr && c.step === "general" && !c.speech && !c.poll && !c.tr.reply;
export function retakeRoll(c: Chamber, at = now()): Chamber {
  if (!canRetakeRoll(c)) return c;
  const t = c.tr!;
  return note({ ...c, step: "roll", roll: {}, result: null, tr: { ...t, retake: true, rolls: { ...t.rolls, [String(at)]: c.roll } } }, "Roll call taken again");
}
export function rollCount(c: Chamber) {
  const out = { absent: 0, present: 0, voting: 0, unmarked: 0 };
  for (const d of c.delegates) { const a = c.roll[d.id]; if (a) out[a]++; else out.unmarked++; }
  return out;
}
/* Quorum (Standard and Custom): a third of the member states present to open debate, and a majority of them present
   for a vote on a resolution. It informs and warns; the chair may carry on without it. */
export const quorumToDebate = (members: number) => Math.ceil(members / 3);
export const quorumToVote = (members: number) => Math.floor(members / 2) + 1;
export type Quorum = { present: number; members: number; needed: number; met: boolean };
/** At roll call only the states marked present count (an unmarked one hasn't answered yet); after it, every state not marked Absent. */
export function quorum(c: Chamber, kind: "debate" | "vote"): Quorum {
  const members = c.delegates.length;
  const n = rollCount(c);
  const here = c.step === "roll" ? n.present + n.voting : present(c);
  const needed = kind === "debate" ? quorumToDebate(members) : quorumToVote(members);
  return { present: here, members, needed, met: here >= needed };
}
export const quorumText = (q: Quorum, kind: "debate" | "vote") => `Quorum: ${q.present} of ${q.members} present, ${q.needed} needed to ${kind === "debate" ? "open debate" : "vote on a resolution"}`;
export function beginDebate(c: Chamber): Chamber {
  if (c.step !== "roll") return c;
  const n = rollCount(c);
  // A roll taken again at the start of a new session goes back to the general debate; the first one goes on to the statements.
  const step: Step = c.tr ? (c.tr.retake ? "general" : "statements") : "pick";
  return note({ ...c, step, ...(c.tr?.retake ? { tr: { ...c.tr, retake: false } } : {}) }, `Roll call: ${n.voting} present and voting, ${n.present} present, ${n.absent} absent${n.unmarked ? `, ${n.unmarked} not marked` : ""}`);
}
/** The chair picks each of the three as they go, so the display shows the choice at once. A state holds one role at a time. */
export function pickRole(c: Chamber, role: "proposer" | "seconder" | "opposer", who: string | null): Chamber {
  if (c.step !== "pick" || (who !== null && (!has(c, who) || observing(c, who)))) return c;
  const roles = { ...c.roles };
  if (who) for (const k of ["proposer", "seconder", "opposer"] as const) if (k !== role && roles[k] === who) roles[k] = null;
  roles[role] = who;
  return { ...c, roles };
}
// The proposer and seconder are needed. Nobody has to oppose: sometimes no one wants to, and the debate goes on without.
export function startSpeeches(c: Chamber): Chamber {
  const { proposer, seconder, opposer } = c.roles;
  if (c.step !== "pick" || !has(c, proposer) || !has(c, seconder) || proposer === seconder) return c;
  if (opposer !== null && (!has(c, opposer) || opposer === proposer || opposer === seconder)) return c;
  const cur = c.tr?.current ? c.tr.docs.find((d) => d.id === c.tr!.current) : undefined;
  const tr = c.tr && cur && !cur.proposer ? { ...c.tr, docs: c.tr.docs.map((d) => (d === cur ? { ...d, proposer, seconder } : d)) } : c.tr;
  return note({ ...c, tr, step: "proposer" }, `Proposer ${nameOf(c, proposer)}, ${c.tr ? roleName(c, "seconder").toLowerCase() : "seconder"} ${nameOf(c, seconder)}${opposer ? `, opposer ${nameOf(c, opposer)}` : ", no opposer"}`);
}

/* Speeches */

// How long each kind of speech is. A Trinity committee fixes the introduction, opposing, closing and opening statements; the rest is the chair's setting.
const roleSecs = (c: Chamber, role: Role) => timeOf(c, role);
// A state is called to speak: it comes off the list, goes on the run of speakers, and gets a fresh timer to start.
function start(c: Chamber, who: string, side: Side, role: Role, secs?: number, stance?: boolean): Chamber {
  const debate: Debate = { list: c.debate.list.filter((s) => s.id !== who), run: role === "closer" || role === "proposer" || role === "seconder" || role === "opposer" || role === "statement" ? c.debate.run : [...c.debate.run, { id: who, side }] };
  const next: Chamber = { ...c, debate, result: null, speech: { who, side, role, phase: "speech", asker: null, pois: 0, ...(stance ? { stance: true } : {}) }, timer: timerFor(nameOf(c, who), secs ?? roleSecs(c, role)) };
  return note(next, role === "statement" ? `${nameOf(c, who)} gives their opening statement` : `${nameOf(c, who)} speaks ${sideWord(side)}${role === "closer" ? " (closing)" : role === "amender" ? " on their amendment" : ""}`);
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
  // An amendment to the amendment: its mover speaks first.
  const a = c.amendments.find((x) => x.id === (c.amend?.sub?.id ?? c.amend?.id));
  if (c.step !== "amend" || c.amend?.stage !== "debate" || c.speech || c.debate.run.length || !a || !has(c, a.by) || !isHere(c, a.by)) return c;
  return start(c, a.by, "for", "amender", secs ?? (c.tr?.cauc?.kind === "amend" ? c.tr.cauc.per : timeOf(c, "amender")));
}
/** Anyone, on the side the chair names, for the time the chair allots. */
export function callSpeaker(c: Chamber, who: string, side: Side, secs?: number): Chamber {
  if (c.speech || !has(c, who) || observing(c, who)) return c;
  const t = c.tr;
  if (t) {
    if (!listOpen(c)) return c;
    const per = c.step === "caucus" || c.step === "amend" ? t.cauc?.per ?? 0 : 0;
    const bonus = t.bonus?.id === who ? t.bonus.secs : 0;
    const next = start(c, who, side, "speaker", (secs ?? (per || c.speakSecs)) + bonus, c.debate.list.find((s) => s.id === who)?.stance);
    return bonus || t.bonus?.id === who ? { ...next, tr: { ...next.tr!, bonus: null } } : next;
  }
  if (c.step !== "floor" && (c.step !== "amend" || c.amend?.stage !== "debate")) return c;
  return start(c, who, side, "speaker", secs);
}
// Evatt: the proposer, seconder and opposer in any order. Trinity: the opposer, then the co-proposer, then the proposer.
export const closingRoles = (c: Chamber) => ((c.tr ? ["opposer", "seconder", "proposer"] : ["proposer", "seconder", "opposer"]) as ("proposer" | "seconder" | "opposer")[]).map((role) => ({ role, id: c.roles[role] })).filter((x): x is { role: "proposer" | "seconder" | "opposer"; id: string } => !!x.id);
export function callCloser(c: Chamber, who: string): Chamber {
  const r = closingRoles(c).find((x) => x.id === who);
  if (c.step !== "closing" || c.speech || !r || c.closers.includes(who)) return c;
  if (c.tr && closingRoles(c).find((x) => !c.closers.includes(x.id))?.id !== who) return c; // in order
  return start(c, who, r.role === "opposer" ? "against" : "for", "closer");
}

// The state yielded to speaks next; otherwise the next on the other side of the list.
export function nextCandidate(c: Chamber): Slot | null {
  const bonus = c.tr?.bonus && c.debate.list.find((x) => x.id === c.tr!.bonus!.id);
  if (bonus) return bonus; // the state a speaker yielded to speaks next
  if (!sided(c)) return c.debate.list[0] ?? null;
  const last = c.debate.run[c.debate.run.length - 1]?.side;
  const want: Side = last ? other(last) : "for";
  return c.debate.list.find((s) => s.side === want) ?? c.debate.list.find((s) => s.side !== want) ?? null;
}

/** What the N key does: the next state due its opening statement, the proposer, co-sponsor or opposer at their step, the amendment's proposer first, then the next on the list. */
export function callNextSpeaker(c: Chamber): Chamber {
  if (c.speech) return c;
  if (c.step === "statements") { const n = nextStatement(c); return n ? callStatement(c, n) : c; }
  if (c.step === "proposer") return callProposer(c);
  if (c.step === "seconder") return callSeconder(c);
  if (c.step === "opposer") return callOpposer(c);
  if (c.tr ? !listOpen(c) : c.step !== "floor" && (c.step !== "amend" || c.amend?.stage !== "debate")) return c;
  if (c.step === "amend" && !c.debate.run.length) return callAmender(c);
  const n = nextCandidate(c);
  return n ? callSpeaker(c, n.id, n.side) : c;
}

export function endSpeech(c: Chamber, at: number, who: string): Chamber {
  const sp = c.speech;
  if (!sp || sp.who !== who || sp.phase !== "speech") return c;
  const logged = record(pauseTimer(c, at), sp.who, SPEECH_KIND[sp.role], used(c, at), at);
  if (sp.role === "closer") return finish(logged); // no Points of Information in the closing
  return { ...logged, speech: { ...sp, phase: "after", left: Math.floor((logged.timer?.left ?? 0) / 1000) } };
}
// The speaker yields to Points of Information: from here they are taken one at a time until the chair ends them.
export function yieldToPoints(c: Chamber, who: string): Chamber {
  const sp = c.speech;
  if (!sp || sp.who !== who || sp.phase !== "after" || takingPoints(sp)) return c;
  return note({ ...c, speech: { ...sp, points: true } }, `${nameOf(c, who)} yields to Points of Information`);
}
// A Point of Information: the chair picks a state, which has 30 seconds to ask; then the speaker has 30 to reply.
export function askPoi(c: Chamber, asker: string, who: string, n: number): Chamber {
  const sp = c.speech;
  if (!sp || sp.who !== who || sp.phase !== "after" || sp.pois !== n || !has(c, asker) || asker === who) return c;
  return note({ ...c, speech: { ...sp, phase: "ask", asker, points: true }, timer: timerFor(`${nameOf(c, asker)} asks`, timeOf(c, "poi")) }, `${nameOf(c, asker)} asks ${nameOf(c, who)} a Point of Information`);
}
export function answerPoi(c: Chamber, who: string, asker: string, n: number, at: number): Chamber {
  const sp = c.speech;
  if (!sp || sp.who !== who || sp.phase !== "ask" || sp.asker !== asker || sp.pois !== n) return c;
  return { ...record(c, asker, "poi", used(c, at), at, who), speech: { ...sp, phase: "answer" }, timer: timerFor(`${nameOf(c, who)} replies`, timeOf(c, "poi")) };
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
  if (sp.phase === "after" && n === 0 && sp.points) return { ...c, speech: { ...sp, points: false } }; // back to choosing how to yield
  if (sp.phase === "after" && n === 0 && c.timer) return { ...c, speech: { ...sp, phase: "speech" } };
  if (sp.phase === "ask") return { ...c, speech: { ...sp, phase: "after", asker: null }, timer: null };
  if (sp.phase === "answer") return { ...c, speech: { ...sp, phase: "ask" }, timer: timerFor(`${nameOf(c, sp.asker)} asks`, timeOf(c, "poi")) };
  return c;
}

// The speech is over. What comes next depends on who spoke.
function finish(c: Chamber): Chamber {
  const sp = c.speech;
  if (!sp) return c;
  const next: Chamber = { ...c, speech: null, timer: null };
  switch (sp.role) {
    case "proposer": return { ...next, step: "seconder" };
    case "seconder": return has(next, next.roles.opposer) ? { ...next, step: "opposer" } : openingCaucus(next); // no opposer: straight to the debate
    case "opposer": return openingCaucus(next); // the debate starts with a caucus
    case "closer": return { ...next, closers: [...next.closers, sp.who] };
    case "statement": return next.tr ? { ...next, tr: { ...next.tr, opened: next.tr.opened.includes(sp.who) ? next.tr.opened : [...next.tr.opened, sp.who] } } : next;
    default: return next;
  }
}

/* Caucus */

function enterCaucus(c: Chamber, secs: number, after: Step, label: string, kind: Caucus["kind"] = "unmod"): Chamber {
  const tr = c.tr ? { ...c.tr, cauc: { kind, topic: label, per: 0, total: secs, ext: 0, clock: null } } : c.tr;
  return note({ ...c, tr, step: "caucus", after, timer: timerFor(label, secs) }, `${label}: ${clock(secs * 1000)}`);
}
// The debate on a resolution starts with a caucus: Evatt's is the chair's to set; Trinity's is 5 minutes.
const openingCaucus = (c: Chamber) => {
  if (!c.tr) return enterCaucus(c, CAUCUS_SECS, "floor", "Caucus");
  const next = enterCaucus(c, TR.intro, "floor", "Unmoderated caucus");
  return next.tr?.cauc ? { ...next, tr: { ...next.tr, cauc: { ...next.tr.cauc, intro: true } } } : next;
};
/** The chair sets how long the caucus is before it starts. */
export function setCaucusSecs(c: Chamber, secs: number): Chamber {
  if (c.step !== "caucus" || running(c.timer) || secs < 5 || secs > 10800) return c;
  if (c.tr) { // an unmoderated caucus is at most 20 minutes; the others are fixed
    const k = c.tr.cauc;
    if (!k || k.kind !== "unmod" || (k.kind === "unmod" && secs > TR.maxCaucus)) return c;
    return { ...c, timer: timerFor(c.timer?.label ?? "Unmoderated caucus", secs), tr: { ...c.tr, cauc: { ...k, total: secs } } };
  }
  return { ...c, timer: timerFor(c.timer?.label ?? "Caucus", secs) };
}
// A caucus may be called between amendments, or while one is being dealt with.
export function callCaucus(c: Chamber, secs: number): Chamber {
  if (c.speech) return c;
  if (c.tr) {
    const final = c.step === "closing";
    const ok = c.step === "floor" || c.step === "amend" || c.step === "general" || (final && !c.closers.length && !c.tr.finalDone);
    if (!ok || (c.step === "amend" && c.amend?.stage === "debate") || !Number.isInteger(secs) || secs < 5 || secs > TR.maxCaucus) return c; // an amendment's debate is already a moderated caucus
    return enterCaucus({ ...c, result: null, tr: final ? { ...c.tr, finalDone: true } : c.tr }, secs, c.step, final ? "Final unmoderated caucus" : "Unmoderated caucus", final ? "final" : "unmod");
  }
  if (c.step !== "floor" && c.step !== "amend") return c;
  return enterCaucus({ ...c, result: null }, secs, c.step, "Caucus");
}
export function endCaucus(c: Chamber): Chamber {
  if (c.step !== "caucus" || c.speech) return c;
  const t = c.tr;
  // Only a moderated caucus sets the committee's list aside (callMod). Any other caucus leaves `saved` alone: during an
  // amendment it holds the resolution's own speakers' list, which must come back when the amendment is done.
  const mod = t?.cauc?.kind === "mod";
  return note({ ...c, step: c.after ?? "floor", after: null, timer: null, ...(t ? (mod ? { debate: t.saved ?? c.debate, tr: { ...t, cauc: null, saved: null } } : { tr: { ...t, cauc: null } }) : {}) }, "Caucus ended");
}

/* Amendments */

// Notes come in from the caucus on, and are taken one at a time once it is over. Signatories are the states that sign it.
// Trinity: a quarter of the states present must sign (the proposer and seconder among them), and a clause already amended needs full consensus to be amended again.
/** How many states are present: every state not marked Absent (one not marked yet counts as present, as it does for the vote). */
export const present = (c: Chamber) => c.delegates.filter((d) => isHere(c, d.id)).length;
const clauseKey = (t: string) => t.trim().toLowerCase().replace(/\s+/g, " ");
export const amendedClause = (c: Chamber, clause: string) => !!clauseKey(clause) && c.amendments.some((a) => a.status === "passed" && clauseKey(a.clause) === clauseKey(clause));
/** Whether amendments can be handed in: Trinity, from the debate on a resolution until the closing, the first caucus included; Evatt, from the first caucus of the debate. */
export const amendmentsOpen = (c: Chamber) => c.tr
  ? !!c.tr.current && (c.step === "floor" || c.step === "amend" || (c.step === "caucus" && (c.after === "floor" || c.after === "amend")))
  : c.step === "caucus" || c.step === "floor" || c.step === "amend";
export function submitAmendment(c: Chamber, id: string, by: string, clause: string, text: string, backers: string[], seconder: string | null = null, consensus = false, how: AmendHow = "amend"): Chamber {
  const open = amendmentsOpen(c);
  const body = text.trim().slice(0, 600);
  if (!open || !body || !has(c, by) || c.amendments.some((a) => a.id === id)) return c;
  const second = c.tr && has(c, seconder) && seconder !== by ? seconder : null;
  if (c.tr) {
    if (!second || observing(c, by) || observing(c, second)) return c;
    if (amendedClause(c, clause) && !consensus) return c;
  }
  const ids = [...new Set([...(second ? [second] : []), ...backers])].filter((b) => b !== by && has(c, b) && !observing(c, b));
  // Each one is handed in after the last, even within the same millisecond, so "oldest first" is always well defined.
  const at = Math.max(now(), ...c.amendments.map((x) => x.at + 1));
  const a: Amendment = { id, by, how, ...(c.tr ? { seconder: second } : {}), clause: clause.trim().slice(0, 40), text: body, backers: ids, at, status: "waiting" };
  let next: Chamber = record({ ...c, amendments: [...c.amendments, a] }, by, "amendment", 0, at);
  for (const b of ids) next = record(next, b, "signatory", 0, at, by);
  return note(next, `Amendment from ${nameOf(c, by)}${a.clause ? ` (${a.clause})` : ""}, ${ids.length} signator${ids.length === 1 ? "y" : "ies"}`);
}
/** A state signs an amendment that is still waiting (a delegate asked to from their own device, and the chair agreed). */
export function signAmendment(c: Chamber, id: string, who: string): Chamber {
  const a = c.amendments.find((x) => x.id === id);
  if (!a || a.status !== "waiting" || !has(c, who) || a.by === who || a.seconder === who || a.backers.includes(who) || observing(c, who)) return c;
  const next = { ...c, amendments: c.amendments.map((x) => (x.id === id ? { ...x, backers: [...x.backers, who] } : x)) };
  return note(record(next, who, "signatory", 0, now(), a.by), `${nameOf(c, who)} signed the amendment from ${nameOf(c, a.by)}`);
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
  return note({ ...setAmendment(c, id, "entertained"), step: "amend", amend: { id, stage: "read" }, debate: emptyDebate(), result: null, ...(c.tr ? { tr: { ...c.tr, saved: c.debate } } : { held: c.debate }) }, `Amendment from ${nameOf(c, a.by)} read to the council`);
}
// Think better of it before any ruling: the amendment goes back to waiting.
export function backOutAmendment(c: Chamber, id: string): Chamber {
  if (c.step !== "amend" || c.amend?.id !== id || c.amend.stage !== "read") return c;
  return note({ ...setAmendment(c, id, "waiting"), step: "floor", amend: null, debate: c.tr ? c.tr.saved ?? emptyDebate() : c.held ?? emptyDebate(), held: null, ...(c.tr ? { tr: { ...c.tr, saved: null } } : {}) }, "Amendment set aside for now");
}
// Trinity: an amendment is debated in a 10-minute moderated caucus, the chair setting the time per speaker.
const toDebate = (c: Chamber, a: Amendment | undefined): Chamber => (!c.tr || !c.amend ? { ...c, amend: c.amend && { ...c.amend, stage: "debate" } } : {
  ...c, amend: { ...c.amend, stage: "debate" },
  tr: { ...c.tr, cauc: { kind: "amend", topic: a?.text ?? "Amendment", per: timeOf(c, "amendPer"), total: timeOf(c, "amendTotal"), ext: 0, clock: timerFor("Amendment debate", timeOf(c, "amendTotal")) } },
});
const poll = (title: string, kind: Poll["kind"]): Poll => ({ title, kind, yes: 0, no: 0, abstain: 0 });
export function amendAsk(c: Chamber, id: string): Chamber {
  if (c.step !== "amend" || c.amend?.id !== id || c.amend.stage !== "read") return c;
  return note({ ...c, amend: { ...c.amend, stage: "ask" }, poll: poll("Debate this amendment?", "debate") }, "Vote on whether to debate the amendment");
}
export function amendDebate(c: Chamber, id: string): Chamber {
  if (c.step !== "amend" || c.amend?.id !== id || c.amend.stage !== "read") return c;
  return note({ ...toDebate(c, c.amendments.find((x) => x.id === id)), poll: null }, "Amendment to be debated");
}
export function amendVote(c: Chamber, id: string): Chamber {
  if (c.step !== "amend" || c.amend?.id !== id || (c.amend.stage !== "read" && c.amend.stage !== "debate") || c.speech || c.amend.sub) return c;
  return note({ ...c, amend: { ...c.amend, stage: "vote" }, poll: poll("Adopt this amendment?", "amendment"), ...(c.tr ? { tr: { ...c.tr, cauc: null } } : {}) }, "Vote on the amendment");
}
export function tally(c: Chamber, which: "yes" | "no" | "abstain", by: 1 | -1): Chamber {
  if (!c.poll) return c;
  return { ...c, poll: { ...c.poll, [which]: Math.min(c.delegates.length, Math.max(0, c.poll[which] + by)) } };
}
/** Take the vote in hand by roll call (or go back to counting placards). The counts follow the answers. */
export function pollByRoll(c: Chamber, on: boolean): Chamber {
  if (!c.poll) return c;
  if (!on) { const { ballots: _b, ...rest } = c.poll; return { ...c, poll: rest }; }
  return { ...c, poll: { ...c.poll, ballots: {}, yes: 0, no: 0, abstain: 0 } };
}
export function pollCast(c: Chamber, who: string, ballot: Ballot | null): Chamber {
  const p = c.poll;
  if (!p?.ballots || !has(c, who) || !isHere(c, who)) return c;
  const ballots = { ...p.ballots };
  if (ballot) ballots[who] = ballot; else delete ballots[who];
  const n = (b: Ballot) => Object.entries(ballots).filter(([id, v]) => v === b && has(c, id) && isHere(c, id)).length;
  return { ...c, poll: { ...p, ballots, yes: n("for"), no: n("against"), abstain: n("abstain") } };
}
/** Who voted which way, for the minutes, when the vote was by roll call. */
const rollTail = (c: Chamber, p: Poll) => {
  if (!p.ballots) return "";
  const names = (b: Ballot) => Object.entries(p.ballots!).filter(([id, v]) => v === b && has(c, id)).map(([id]) => nameOf(c, id)).sort().join(", ");
  return `. By roll call. For: ${names("for") || "none"}. Against: ${names("against") || "none"}. Abstaining: ${names("abstain") || "none"}`;
};
// More in favour than against passes. The President may overrule the result.
export const passes = (p: Pick<Poll, "yes" | "no">) => p.yes > p.no;

/** `ruling` is the President's overrule, For or Against; with none, the count decides. */
export type Ruling = "for" | "against" | null;
export function decideAsk(c: Chamber, ruling: Ruling, id: string): Chamber {
  const p = c.poll;
  if (c.step !== "amend" || c.amend?.id !== id || c.amend.stage !== "ask" || p?.kind !== "debate") return c;
  const yes = ruling ? ruling === "for" : passes(p);
  const overrule = ruling !== null && yes !== passes(p);
  const result: Result = { title: p.title, kind: "debate", amendment: id, passed: yes, yes: p.yes, no: p.no, abstain: p.abstain, ...(p.ballots ? { ballots: p.ballots } : {}) };
  const tail = `${p.yes} for, ${p.no} against, ${p.abstain} abstaining${overrule ? ", overruled" : ""}${rollTail(c, p)}`;
  if (yes) return note({ ...toDebate(c, c.amendments.find((x) => x.id === id)), poll: null, result }, `Amendment to be debated (${tail})`);
  return note({ ...c, amend: { ...c.amend, stage: "vote" }, poll: poll("Adopt this amendment?", "amendment"), result }, `Not to be debated (${tail}); straight to the vote`);
}
export function decideAmendment(c: Chamber, ruling: Ruling, id: string): Chamber {
  if (c.amend?.sub) return decideSub(c, ruling, id);
  const p = c.poll;
  const a = c.amendments.find((x) => x.id === c.amend?.id);
  if (c.step !== "amend" || c.amend?.id !== id || c.amend.stage !== "vote" || p?.kind !== "amendment" || !a) return c;
  const yes = ruling ? ruling === "for" : passes(p);
  const overrule = ruling !== null && yes !== passes(p);
  const result: Result = { title: `Amendment from ${nameOf(c, a.by)}`, kind: "amendment", amendment: a.id, passed: yes, yes: p.yes, no: p.no, abstain: p.abstain, ...(p.ballots ? { ballots: p.ballots } : {}) };
  const tail = `${p.yes} for, ${p.no} against, ${p.abstain} abstaining${overrule ? ", overruled" : ""}${rollTail(c, p)}`;
  // On to the next amendment.
  const next: Chamber = { ...setAmendment(c, a.id, yes ? "passed" : "failed"), step: "floor", amend: null, poll: null, debate: c.tr ? c.tr.saved ?? emptyDebate() : c.held ?? emptyDebate(), held: null, result, timer: null, ...(c.tr ? { tr: { ...c.tr, saved: null, cauc: null } } : {}) };
  return note(next, `Amendment from ${nameOf(c, a.by)} ${yes ? "passed" : "failed"} (${tail})`);
}

/* Standard and Custom: amendments to the amendment. While an amendment is debated, one amendment to it at a time can be
   moved (no third degree). It is debated with its own speakers' list (the amendment's waits) within the amendment's
   time, then voted on. If it passes, the amendment's wording changes to the new wording before the amendment is voted on. */
export const subOpen = (c: Chamber) => !!c.style && c.step === "amend" && c.amend?.stage === "debate" && !c.amend.sub && !c.speech && !c.poll;
export function moveSubAmendment(c: Chamber, id: string, by: string, text: string): Chamber {
  const a = c.amendments.find((x) => x.id === c.amend?.id);
  const body = text.trim().slice(0, 600);
  if (!subOpen(c) || !a || a.to || !has(c, by) || observing(c, by) || !body || body === a.text || c.amendments.some((x) => x.id === id)) return c;
  const at = Math.max(now(), ...c.amendments.map((x) => x.at + 1));
  // No clause of its own: it changes the amendment, not the resolution.
  const sub: Amendment = { id, by, how: "amend", clause: "", text: body, backers: [], at, status: "entertained", to: a.id };
  const next = record({ ...c, amendments: [...c.amendments, sub], amend: { ...c.amend!, sub: { id, stage: "debate", held: c.debate } }, debate: emptyDebate(), result: null }, by, "amendment", 0, at);
  return note(next, `Amendment to the amendment from ${nameOf(c, by)}: ${body}`);
}
export function subVote(c: Chamber): Chamber {
  const sub = c.amend?.sub;
  if (!sub || sub.stage !== "debate" || c.speech || c.poll) return c;
  return note({ ...c, amend: { ...c.amend!, sub: { ...sub, stage: "vote" } }, poll: poll("Adopt this amendment to the amendment?", "amendment") }, "Vote on the amendment to the amendment");
}
/** Withdraw the amendment to the amendment before its vote: the amendment's own debate carries on. */
export function withdrawSub(c: Chamber): Chamber {
  const sub = c.amend?.sub;
  if (!sub || sub.stage !== "debate" || c.speech) return c;
  const { sub: _s, ...amend } = c.amend!;
  return note({ ...setAmendment(c, sub.id, "withdrawn"), amend, debate: sub.held }, "Amendment to the amendment withdrawn");
}
function decideSub(c: Chamber, ruling: Ruling, id: string): Chamber {
  const sub = c.amend?.sub;
  const p = c.poll;
  const s = c.amendments.find((x) => x.id === sub?.id);
  const a = c.amendments.find((x) => x.id === c.amend?.id);
  if (c.step !== "amend" || c.amend?.id !== id || !sub || sub.stage !== "vote" || p?.kind !== "amendment" || !s || !a) return c;
  const yes = ruling ? ruling === "for" : passes(p);
  const overrule = ruling !== null && yes !== passes(p);
  const result: Result = { title: `Amendment to the amendment from ${nameOf(c, s.by)}`, kind: "amendment", amendment: s.id, passed: yes, yes: p.yes, no: p.no, abstain: p.abstain, ...(p.ballots ? { ballots: p.ballots } : {}) };
  const tail = `${p.yes} for, ${p.no} against, ${p.abstain} abstaining${overrule ? ", overruled" : ""}${rollTail(c, p)}`;
  const amendments = c.amendments.map((x) => (x.id === s.id ? { ...x, status: (yes ? "passed" : "failed") as Amendment["status"] } : x.id === a.id && yes ? { ...x, text: s.text, was: x.was ?? x.text } : x));
  const { sub: _s, ...amend } = c.amend!;
  const next: Chamber = { ...c, amendments, amend: { ...amend, stage: "debate" }, debate: sub.held, poll: null, result };
  return note(next, yes ? `Amendment to the amendment from ${nameOf(c, s.by)} passed (${tail}). The amendment now reads: ${s.text}` : `Amendment to the amendment from ${nameOf(c, s.by)} failed (${tail})`);
}

/* The speakers' list for the amendment in hand */

// Evatt: the opening caucus, the debate on the resolution as a whole, and an amendment's debate. Trinity: the general speakers' list, a moderated caucus, the draft resolution's own list, an amendment's debate.
export const listOpen = (c: Chamber) => c.tr
  ? (c.step === "general" && !!c.style) || c.step === "proposer" || c.step === "seconder" || c.step === "opposer" || c.step === "floor" || (c.step === "amend" && c.amend?.stage === "debate") || (c.step === "caucus" && c.tr.cauc?.kind === "mod")
  : c.step === "floor" || c.step === "caucus" || (c.step === "amend" && c.amend?.stage === "debate");
/** Whether the list has For and Against columns. The general list and a moderated caucus are one list of states. */
export const sided = (c: Chamber) => !c.tr || c.step === "floor" || c.step === "amend" || c.step === "proposer" || c.step === "seconder" || c.step === "opposer";
export const spokeOn = (c: Chamber, who: string, side: Side) => c.debate.run.some((s) => s.id === who && s.side === side);
export function canAdd(c: Chamber, who: string, side: Side): boolean {
  return listOpen(c) && has(c, who) && isHere(c, who) && !observing(c, who) && !c.debate.list.some((s) => s.id === who) && c.speech?.who !== who && (!!c.tr || !spokeOn(c, who, side));
}
export function addToList(c: Chamber, who: string, side: Side, stance = false): Chamber {
  return canAdd(c, who, side) ? { ...c, debate: { ...c.debate, list: [...c.debate.list, { id: who, side, ...(stance && !sided(c) && c.tr ? { stance: true } : {}) }] } } : c;
}
export function removeFromList(c: Chamber, who: string): Chamber {
  return { ...c, debate: { ...c.debate, list: c.debate.list.filter((s) => s.id !== who) } };
}
// A state changes its side by note; it may not go back to a side it has already spoken on.
export function switchSide(c: Chamber, who: string): Chamber {
  const slot = c.debate.list.find((s) => s.id === who);
  if (!slot || !sided(c) || (!c.tr && spokeOn(c, who, other(slot.side)))) return c;
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
  return note({ ...c, step: "closing", closers: [], result: null, ...(c.tr ? { tr: { ...c.tr, finalDone: false } } : {}) }, "Debate closed");
}
/** Why the vote on the resolution can't be taken now, or null: a vote needs at least one state present. */
export const voteBlock = (c: Chamber): string | null => (present(c) ? null : "No state is present. Mark the roll first: a vote needs at least one state present.");
export function startVote(c: Chamber): Chamber {
  if (c.step !== "closing" || c.speech || voteBlock(c)) return c;
  return note({ ...plainVote(c), step: "vote", ballots: {} }, "Roll call vote");
}
/** The committee without what a Standard or Custom vote keeps besides the ballots (passes, rights, explanations, a division). */
function plainVote(c: Chamber): Chamber {
  if (!c.passed && !c.rights && !c.explain && !c.divide) return c;
  const { passed: _p, rights: _r, explain: _e, divide: _d, ...rest } = c;
  return rest;
}

/* The vote on the resolution: a roll call */

export function cast(c: Chamber, who: string, ballot: Ballot | null): Chamber {
  if (c.step !== "vote" || !has(c, who)) return c;
  if (!isHere(c, who)) return c; // an absent state has no vote
  if (ballot === "abstain" && c.roll[who] === "voting") return c; // Present and Voting must vote For or Against
  if (ballot === "abstain" && c.passed?.includes(who)) return c; // a state that passed must then vote For or Against
  const ballots = { ...c.ballots };
  if (ballot) ballots[who] = ballot; else delete ballots[who];
  return { ...c, ballots };
}
export function count(c: Chamber) {
  const out = { yes: 0, no: 0, abstain: 0, left: 0 };
  for (const d of c.delegates) {
    if (!isHere(c, d.id)) continue;
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
  if (n.left || voteBlock(c)) return c;
  if (c.style) return finishStandardVote(c, n);
  if (c.tr) return finishTrinityVote(c, n);
  const need = needed(c.delegates.length);
  const passed = n.yes >= need;
  const outcome: Outcome = { passed, yes: n.yes, no: n.no, abstain: n.abstain, needed: need };
  return note({ ...c, step: "closed", outcome }, `Resolution ${passed ? "approved" : "not approved"}: ${n.yes} for, ${n.no} against, ${n.abstain} abstaining${passed ? "" : `, ${need} needed`}`);
}
// Back to amending the ballots, if the result was recorded too soon.
export function reopenVote(c: Chamber): Chamber {
  if (c.step !== "closed" || !c.outcome) return c;
  const { explain: _e, ...open } = c;
  return note({ ...(c.explain ? open : c), step: "vote", outcome: null, ...(c.tr ? { tr: { ...c.tr, docs: c.tr.docs.map((d) => (d.id === c.tr!.current ? { ...d, result: null } : d)) } } : {}) }, "Vote reopened");
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
  if (c.step !== "closed" || !t || c.tr) return c;
  return note({
    ...c, topic: t, step: "welcome", after: null, roll: {}, roles: { proposer: null, seconder: null, opposer: null }, closers: [],
    debate: emptyDebate(), speech: null, amendments: [], amend: null, poll: null, result: null, timer: null, ballots: {}, outcome: null,
  }, `Next resolution: ${t}`);
}

/* The chairs' marks */
const clampScore = (n: number) => Math.min(10, Math.max(0, Math.round(n)));
export const emptyScore = (): Score => ({ speaking: 0, diplomacy: 0, knowledge: 0, procedure: 0, note: "" });
export const scoreOf = (c: Chamber, who: string): Score => c.scores?.[who] ?? emptyScore();
export const scoreTotal = (sc: Score) => SCORE_KEYS.reduce((n, k) => n + sc[k], 0);
export function setScore(c: Chamber, who: string, patch: Partial<Score>): Chamber {
  if (!has(c, who)) return c;
  const cur = scoreOf(c, who);
  const next: Score = { ...cur, ...patch, note: (patch.note ?? cur.note).slice(0, 400) };
  for (const k of SCORE_KEYS) next[k] = clampScore(next[k]);
  return { ...c, scores: { ...(c.scores ?? {}), [who]: next } };
}

/* Timer */

/** In a moderated caucus (and an amendment's debate) every speech is taken out of the whole caucus's time: its clock runs when a speaker's does. */
const drains = (c: Chamber) => !!c.speech && !c.tr?.reply && !!c.tr?.cauc?.clock && (c.tr.cauc.kind === "mod" || c.tr.cauc.kind === "amend") && (c.step === "caucus" || c.step === "amend");
export function startTimer(c: Chamber, at: number): Chamber {
  if (!c.timer || running(c.timer) || (c.timer.left <= 0 && !c.timer.over)) return c;
  const { over: _over, ...t } = c.timer; // a timer paused in overtime carries on counting up from where it was
  const next = { ...c, timer: { ...t, endsAt: at + signedLeft(c.timer, at) } };
  // A speaker carrying on past 0:00 no longer takes time from the caucus: only a speech with time left starts its clock.
  return drains(c) && signedLeft(c.timer, at) > 0 ? startCauc(next, at) : next;
}
/** A speaker's clock has just passed 0:00 and keeps running: the whole caucus's clock stops where the speech's time ran
    out, so the overtime isn't taken from the caucus (and can't run the caucus out early). The console calls this once
    the speaker's time is up. */
export function overrun(c: Chamber, at: number): Chamber {
  if (!c.timer || !running(c.timer) || !drains(c) || signedLeft(c.timer, at) > 0) return c;
  return pauseCauc(c, Math.min(at, c.timer.endsAt!));
}
export function pauseTimer(c: Chamber, at: number): Chamber {
  if (!c.timer || !running(c.timer)) return c;
  const next = { ...c, timer: { ...c.timer, endsAt: null, left: remaining(c.timer, at), ...(overtime(c.timer, at) ? { over: overtime(c.timer, at) } : {}) } };
  // The caucus stops with the speaker, or when the speaker's time ran out if the chair was slow to stop it.
  return drains(c) ? pauseCauc(next, Math.min(at, c.timer.endsAt ?? at)) : next;
}
export function resetTimer(c: Chamber): Chamber {
  if (!c.timer) return c;
  const { over: _over, ...t } = c.timer;
  return { ...c, timer: { ...t, endsAt: null, left: t.total } };
}
export function nudgeTimer(c: Chamber, secs: number, at: number): Chamber {
  const t = c.timer;
  if (!t) return c;
  // Overtime counts as time below zero, so adding 15 seconds to a speech 10 seconds over leaves 5.
  const signed = signedLeft(t, at) + secs * 1000;
  const left = Math.max(0, signed);
  const { over: _over, ...rest } = t;
  return { ...c, timer: { ...rest, total: Math.max(1000, t.total + secs * 1000), left, endsAt: t.endsAt === null ? null : at + signed, ...(t.endsAt === null && signed < 0 ? { over: -signed } : {}) } };
}
/** A timer for anything else (explaining an amendment, say). It never changes where the debate is. */
export function setTimer(c: Chamber, label: string, secs: number): Chamber {
  return note({ ...c, timer: timerFor(label, secs) }, `Timer set: ${label}, ${clock(secs * 1000)}`);
}

/* Analytics: what each state did, and for how long */

// Overtime counts: a speech that ran 12 seconds over is recorded as the time it really took.
export const used = (c: Chamber, at: number) => (c.timer ? Math.max(0, Math.round((c.timer.total - remaining(c.timer, at) + overtime(c.timer, at)) / 1000)) : 0);
const resTitle = (c: Chamber) => (c.tr?.current ? c.tr.docs.find((d) => d.id === c.tr!.current)?.title : null) || c.topic;
export const record = (c: Chamber, who: string, kind: StatKind, secs: number, at: number, withWho?: string): Chamber =>
  ({ ...c, stats: [...c.stats, { at, who, kind, secs, res: resTitle(c), ...(withWho ? { with: withWho } : {}), ...(c.tr ? { wk: c.tr.week } : {}) }] });
const SPEECH_KIND: Record<Role, StatKind> = { proposer: "proposer", seconder: "seconder", opposer: "opposer", speaker: "speaker", amender: "amender", closer: "closing", statement: "statement" };
export const STAT_LABEL: Record<StatKind, string> = {
  proposer: "Proposer", seconder: "Seconder", opposer: "Opposer", amender: "Amendment Speech", speaker: "Speaker", closing: "Closing Speech",
  poi: "Point of Information Asked", reply: "Point of Information Answered", amendment: "Amendment Submitted", signatory: "Amendment Signed", statement: "Opening Statement",
};
/** What a state did, in the committee's own words: a Trinity committee has a co-proposer or co-sponsor, not a seconder. */
export const statLabel = (c: Chamber, k: StatKind) => (k === "seconder" && c.tr ? roleName(c, "seconder") : STAT_LABEL[k]);
/** A speech, as opposed to a Point of Information or a note handed in. */
export const isSpeech = (k: StatKind) => k === "statement" || k === "proposer" || k === "seconder" || k === "opposer" || k === "amender" || k === "speaker" || k === "closing";
/** How many speeches each state has given in the whole committee, for the list of states to add. */
export function spokeCount(c: Chamber): Record<string, number> {
  const out: Record<string, number> = {};
  for (const x of c.stats) if (isSpeech(x.kind)) out[x.who] = (out[x.who] ?? 0) + 1;
  return out;
}
export function summary(c: Chamber, wk?: 1 | 2) {
  return c.delegates.map((d) => {
    const mine = c.stats.filter((s) => s.who === d.id && (!wk || s.wk === wk));
    const n = (k: StatKind) => mine.filter((s) => s.kind === k).length;
    return {
      id: d.id, name: d.name,
      secs: mine.reduce((sum, s) => sum + s.secs, 0),
      speeches: mine.filter((s) => isSpeech(s.kind)).length,
      asked: n("poi"), answered: n("reply"), amendments: n("amendment"), signed: n("signatory"),
    };
  });
}

/* What is open right now, for the display. In an Evatt council the negotiation chamber and note-passing open as the
   Seconder starts to speak. The negotiation chamber is then open through the rest of the opening, between amendments
   and while one is debated; it is shut during a caucus (the council is on its feet), while an amendment is read or
   voted on, and from the closing speeches on. Notes can be passed from the Seconder's speech until the closing.
   Amendments are taken from the first caucus of the debate until the closing, and the speakers' list opens once the
   council has voted to debate an amendment. */
export function rooms(c: Chamber): { negotiation: boolean; notes: boolean; amendments: boolean; speakers: boolean; labels?: string[] } {
  if (c.tr) {
    // The pill says what delegates can do now, and it is exactly what the console has open: the speakers' list, amendments and motions. A caucus is not named.
    const list = listOpen(c);
    const labels = [list && "Speakers\u2019 List Open", amendmentsOpen(c) && "Amendments Open", motionsOpen(c) && "Motions Open"].filter((x): x is string => !!x);
    return { negotiation: false, notes: false, amendments: amendmentsOpen(c), speakers: list, labels };
  }
  const speakers = listOpen(c);
  // From the moment the Seconder is called until the debate begins.
  const opening = (c.step === "seconder" && c.speech?.role === "seconder") || c.step === "opposer";
  const debate = c.step === "caucus" || c.step === "floor" || c.step === "amend";
  return {
    negotiation: opening || c.step === "floor" || (c.step === "amend" && c.amend?.stage === "debate"),
    notes: opening || debate,
    amendments: debate,
    speakers,
  };
}

/* Where the council is: three parts, each with a step inside it (Trinity has four) */
export const STAGES = ["Opening", "Debate", "Closing"] as const;
export const TRINITY_STAGES = ["Opening", "Resolutions", "Debate", "Closing"] as const;
export const STANDARD_STAGES = ["Opening", "General Debate", "Resolution", "Closing"] as const;
export const stagesOf = (c: Chamber): readonly string[] => (c.style ? STANDARD_STAGES : c.tr ? TRINITY_STAGES : STAGES);
export function stageIndex(c: Chamber): number {
  if (c.tr) {
    switch (c.step) {
      case "welcome": case "roll": return 0;
      case "statements": case "general": return 1;
      case "pick": case "proposer": case "seconder": case "opposer": case "floor": case "amend": return 2;
      case "caucus": return c.after === "general" || c.after === "statements" ? 1 : c.after === "closing" ? 3 : 2;
      default: return 3;
    }
  }
  switch (c.step) {
    case "welcome": case "roll": case "pick": case "proposer": case "seconder": case "opposer": return 0;
    case "caucus": case "floor": case "amend": return 1;
    default: return 2;
  }
}
export function substep(c: Chamber): string {
  const res = "Resolution";
  switch (c.step) {
    case "welcome": return "Welcome";
    case "roll": return "Roll Call";
    case "pick": return c.tr ? `Introduce the ${res}` : "Choose the Speakers";
    case "proposer": return "Proposer";
    case "seconder": return c.tr ? roleName(c, "seconder") : "Seconder";
    case "opposer": return "Opposer";
    case "caucus": return c.tr?.cauc?.kind === "mod" ? "Moderated Caucus" : c.tr?.cauc?.kind === "final" ? "Final Unmoderated Caucus" : c.tr ? "Unmoderated Caucus" : "Caucus";
    case "floor": return c.tr ? `${res} Debate` : c.debate.list.length || !c.amendments.some((a) => a.status === "waiting") ? "Speakers\u2019 List" : "Amendments";
    case "amend": return c.amend?.stage === "read" ? "Amendment Read" : c.amend?.stage === "ask" ? "Vote on Whether to Debate" : c.amend?.stage === "debate" ? (c.tr ? "Amendment Moderated Caucus" : "Amendment Debate") : "Vote on the Amendment";
    case "closing": return c.tr ? "Closing" : "Closing Speeches";
    case "vote": return "Roll Call Vote";
    case "statements": return "Opening Statements";
    case "general": return c.style ? "General Speakers\u2019 List" : "Choosing a Resolution";
    case "ended": return "Ended";
    default: return "Result";
  }
}

/* Standard and Custom: the roll-call vote on a resolution */

/** What a state has answered: its ballot (with rights or not), Pass, or nothing yet. */
export function answerOf(c: Chamber, who: string): Answer | null {
  const b = c.ballots[who];
  if (b && b !== "abstain" && c.rights?.includes(who)) return b === "for" ? "forRights" : "againstRights";
  if (b) return b;
  return c.passed?.includes(who) ? "pass" : null;
}
/** Standard and Custom: answer for a state in the roll-call vote. Pass leaves it to be asked again at the end, when it
    must vote For or Against; For or Against with Rights counts as For or Against, and the state explains its vote after
    the result. Null takes the answer back (or, for a state that has only passed, the pass). */
export function answer(c: Chamber, who: string, a: Answer | null): Chamber {
  if (!c.style || c.step !== "vote" || !has(c, who) || !isHere(c, who)) return c;
  const passed = c.passed ?? [];
  const was = passed.includes(who);
  const rights = (c.rights ?? []).filter((x) => x !== who);
  if (a === null) {
    if (c.ballots[who]) { const ballots = { ...c.ballots }; delete ballots[who]; return { ...c, ballots, rights }; }
    return was ? { ...c, passed: passed.filter((x) => x !== who), rights } : c;
  }
  if (a === "pass") {
    if (was) return c; // a state passes once
    const ballots = { ...c.ballots }; delete ballots[who];
    return { ...c, ballots, passed: [...passed, who], rights };
  }
  const ballot: Ballot = a === "forRights" ? "for" : a === "againstRights" ? "against" : a;
  const next = cast(c, who, ballot);
  if (next === c) return c;
  return { ...next, rights: a === "forRights" || a === "againstRights" ? [...rights, who] : rights };
}
/** The states that passed and have still to vote: asked again once everyone else has answered. */
export const secondRound = (c: Chamber) => (c.passed ?? []).filter((id) => has(c, id) && isHere(c, id) && !c.ballots[id]);
/** The resolution's rule under Standard or Custom: more For than Against, or (Custom) two-thirds of the votes cast. */
export function standardNeed(c: Chamber, n: { yes: number; no: number }): { need: number; passed: boolean } {
  const cast = n.yes + n.no;
  const two = c.pass === "twothirds";
  const need = two ? Math.max(1, Math.ceil((cast * 2) / 3)) : Math.floor(cast / 2) + 1;
  return { need, passed: two ? n.yes >= need : n.yes > n.no };
}
// The states that voted with rights, in the order they appear, to explain their vote once the result is in.
const explainers = (c: Chamber): Explain | undefined => {
  const queue = c.delegates.filter((d) => c.rights?.includes(d.id) && (c.ballots[d.id] === "for" || c.ballots[d.id] === "against"))
    .map((d) => ({ id: d.id, side: c.ballots[d.id] as Side }));
  return queue.length ? { queue, who: null } : undefined;
};
// Explanations still owed from an earlier part of a divided question stay in the queue, ahead of this vote's.
const moreExplain = (was: Explain | undefined, add: Explain | undefined): Explain | undefined => {
  if (!was) return add;
  if (!add) return was;
  return { who: was.who, queue: [...was.queue, ...add.queue.filter((x) => !was.queue.some((y) => y.id === x.id && y.side === x.side))] };
};
function finishStandardVote(c: Chamber, n: { yes: number; no: number; abstain: number }): Chamber {
  const ex = moreExplain(c.explain, explainers(c));
  const part = divisionPart(c);
  if (part && c.divide) { // a part of a divided question: kept or struck, then on to the next part
    const { passed, need } = standardNeed(c, n);
    const d = c.divide;
    const parts = d.parts.map((x, i) => (i === d.at ? { ...x, result: (passed ? "passed" : "failed") as Part["result"], yes: n.yes, no: n.no, abstain: n.abstain } : x));
    const { passed: _p, rights: _r, explain: _e, ...rest } = c;
    return note({ ...rest, ballots: {}, divide: { parts, at: d.at + 1 }, ...(ex ? { explain: ex } : {}) },
      `Part ${d.at + 1} of the resolution (${part.label}) ${passed ? "kept" : "struck"}: ${n.yes} for, ${n.no} against, ${n.abstain} abstaining${passed ? "" : `, ${need} needed`}`);
  }
  const done = finishTrinityVote(c, n);
  const struck = c.divide?.parts.filter((x) => x.result === "failed").map((x) => x.label) ?? [];
  const withStruck = struck.length && done.outcome ? note({ ...done, outcome: { ...done.outcome, struck } }, `Struck from the resolution: ${struck.join("; ")}`) : done;
  return ex ? { ...withStruck, explain: ex } : withStruck;
}

/* Explanations of vote: after the result, each state that voted with rights gets a short timed explanation, or is skipped. */
export const EXPLAIN_SECS = 30;
export function callExplain(c: Chamber, who: string, secs = EXPLAIN_SECS): Chamber {
  const e = c.explain;
  const slot = e?.queue.find((x) => x.id === who);
  if (!e || !slot || e.who || c.speech || c.poll) return c;
  return note({ ...c, explain: { queue: e.queue.filter((x) => x.id !== who), who: slot }, timer: timerFor(`${nameOf(c, who)} explains their vote`, secs) }, `${nameOf(c, who)} explains their vote`);
}
export function endExplain(c: Chamber, who: string): Chamber {
  const e = c.explain;
  if (!e?.who || e.who.id !== who) return c;
  const { explain: _e, ...rest } = c;
  return { ...(e.queue.length ? { ...c, explain: { ...e, who: null } } : rest), timer: null };
}
export function skipExplain(c: Chamber, who: string): Chamber {
  const e = c.explain;
  if (!e || e.who || !e.queue.some((x) => x.id === who)) return c;
  const queue = e.queue.filter((x) => x.id !== who);
  const { explain: _e, ...rest } = c;
  return note(queue.length ? { ...c, explain: { ...e, queue } } : rest, `${nameOf(c, who)} did not explain their vote`);
}

/* Standard and Custom: dividing the question. Before anyone votes, the chair names parts of the resolution (operative
   clauses) to vote on one at a time; a part that fails is struck. Then what remains is voted on as a whole. */
/** The part being voted on now, or null when the vote is on the resolution as a whole (or the question isn't divided). */
export const divisionPart = (c: Chamber): Part | null => (c.divide && c.divide.at < c.divide.parts.length ? c.divide.parts[c.divide.at] : null);
/** In words for the minutes, the display and the console: "Part 2 of 3: Clause 4". */
export const partText = (c: Chamber): string | null => {
  const p = divisionPart(c);
  if (p && c.divide) return `Part ${c.divide.at + 1} of ${c.divide.parts.length}: ${p.label}`;
  return c.divide ? "The rest of the resolution, as a whole" : null;
};
export const canDivide = (c: Chamber) => !!c.style && c.step === "vote" && !c.divide && !Object.keys(c.ballots).length && !c.passed?.length && !c.explain;
export function divideQuestion(c: Chamber, labels: string[]): Chamber {
  if (!canDivide(c)) return c;
  const parts = labels.map((l) => Array.from(l.trim().replace(/\s+/g, " ")).slice(0, 80).join("")).filter(Boolean).slice(0, 20);
  if (!parts.length) return c;
  return note({ ...c, divide: { parts: parts.map((label) => ({ label, result: null })), at: 0 } }, `Question divided: ${parts.join("; ")}. Each part is voted on first, then the rest as a whole`);
}
/** Undo the division before the first part's vote has started. */
export function undivide(c: Chamber): Chamber {
  if (!c.divide || c.step !== "vote" || c.divide.at !== 0 || Object.keys(c.ballots).length || c.passed?.length) return c;
  const { divide: _d, ...rest } = c;
  return note(rest, "Question no longer divided");
}

/* A practice committee: a sample topic and 12 member states, in any procedure, run like any other. */
export const PRACTICE = {
  name: "Practice Committee",
  topic: "Access to clean water",
  resolutions: ["Clean water for every school", "Sharing rivers across borders"],
  states: ["Australia", "Brazil", "Canada", "China", "Egypt", "France", "Germany", "India", "Japan", "Kenya", "Mexico", "New Zealand"],
};
export function createPractice(proc: "evatt" | "trinity" | "standard" | "custom", ids: string[], pass: "simple" | "twothirds" = "simple"): Chamber {
  const { name, topic, resolutions, states } = PRACTICE;
  if (proc === "trinity") return createTrinity(name, topic, TR.speech, states, ids, resolutions.map((title, i) => ({ title, week: 1 as const, seen: i === 0 })));
  if (proc === "standard") return createStandard(name, topic, 60, states, ids, resolutions);
  if (proc === "custom") return createStandard(name, topic, 60, states, ids, resolutions, { pass });
  return create(name, `That the committee ensures ${topic.toLowerCase()} for all`, 120, states, ids);
}

/* Trinity Grammar MUN */

// A resolution needs more For than Against. Abstentions count for neither. A draft's result is kept on the draft.
function finishTrinityVote(c: Chamber, n: { yes: number; no: number; abstain: number }): Chamber {
  const t = c.tr!;
  const cast = n.yes + n.no;
  const two = c.pass === "twothirds";
  const need = two ? Math.max(1, Math.ceil((cast * 2) / 3)) : Math.floor(cast / 2) + 1;
  const passed = two ? n.yes >= need : n.yes > n.no;
  const outcome: Outcome = { passed, yes: n.yes, no: n.no, abstain: n.abstain, needed: need };
  const docs = t.docs.map((d) => (d.id === t.current ? { ...d, result: (passed ? "passed" : "failed") as Doc["result"] } : d));
    return note({ ...c, step: "closed", outcome, tr: { ...t, docs } }, `${resNoun(c)} ${passed ? "approved" : "not approved"}: ${n.yes} for, ${n.no} against, ${n.abstain} abstaining${two && !passed ? `, ${need} needed` : ""}`);
}
/** Standard and Custom: the chair adds a draft resolution as it is handed in, and takes away one not yet debated. */
export function addDraft(c: Chamber, id: string, title: string): Chamber {
  const name = title.trim().slice(0, 160);
  if (!c.tr || !c.style || !name || c.tr.docs.length >= 30 || c.tr.docs.some((d) => d.id === id)) return c;
  return note({ ...c, tr: { ...c.tr, docs: [...c.tr.docs, { ...agendaDoc(c.tr.docs.length, name, 1, true), id, at: now() }] } }, `Resolution added: ${name}`);
}
export function removeDraft(c: Chamber, id: string): Chamber {
  const d = docOf(c, id);
  if (!c.tr || !c.style || !d || d.result || c.tr.current === id) return c;
  return note({ ...c, tr: { ...c.tr, docs: c.tr.docs.filter((x) => x.id !== id) } }, `Resolution removed: ${d.title}`);
}

/* Documents */

const setDoc = (c: Chamber, id: string, f: (d: Doc) => Doc): Chamber => (c.tr ? { ...c, tr: { ...c.tr, docs: c.tr.docs.map((d) => (d.id === id ? f(d) : d)) } } : c);
const docOf = (c: Chamber, id: string) => c.tr?.docs.find((d) => d.id === id);
export const drafts = (c: Chamber) => c.tr?.docs.filter((d) => d.kind === "draft") ?? [];
export const currentDoc = (c: Chamber) => (c.tr?.current ? docOf(c, c.tr.current) : undefined);

/** The chair introduces an approved draft: its proposer and seconder are set, the opposer is chosen next. */
export function introduceDraft(c: Chamber, id: string): Chamber {
  const d = docOf(c, id);
  if (!c.tr || c.step !== "general" || c.speech || c.poll || !d || d.kind !== "draft" || d.status !== "approved" || d.result || (d.proposer !== null && (!has(c, d.proposer) || observing(c, d.proposer))) || (d.seconder !== null && (!has(c, d.seconder) || observing(c, d.seconder)))) return c;
  return note({
    ...plainVote(c), step: "pick", roles: { proposer: d.proposer, seconder: d.seconder, opposer: null }, closers: [], debate: emptyDebate(), amendments: [], amend: null, result: null, ballots: {}, outcome: null,
    tr: { ...c.tr, current: id, saved: null, finalDone: false },
  }, `${resNoun(c)} introduced: ${d.title}`);
}
/** Back to the general debate before the speeches begin. */
export function cancelIntroduction(c: Chamber): Chamber {
  if (!c.tr || c.step !== "pick") return c;
  return note({ ...c, step: "general", roles: { proposer: null, seconder: null, opposer: null }, tr: { ...c.tr, current: null } }, "Introduction cancelled");
}
/** The committee's given resolutions can be set or renamed one slot at a time, until a slot has been debated. A blank title takes it away. */
export function setAgenda(c: Chamber, slot: number, title: string): Chamber {
  const t = c.tr;
  if (!t || !Number.isInteger(slot) || slot < 0 || slot >= SLOTS.length) return c;
  const id = `agenda${slot}`;
  const d = t.docs.find((x) => x.id === id);
  const name = title.trim().slice(0, 160);
  if (d) {
    if (d.result || t.current === id) return c;
    return name ? setDoc(c, id, (x) => ({ ...x, title: name })) : { ...c, tr: { ...t, docs: t.docs.filter((x) => x.id !== id) } };
  }
  if (!name) return c;
  const s = SLOTS[slot];
  return { ...c, tr: { ...t, docs: [...t.docs, agendaDoc(slot, name, s.week, s.seen)].sort((x, y) => x.at - y.at) } };
}
/** After the vote: back to the general debate, ready for the next draft. */
export function backToGeneral(c: Chamber): Chamber {
  if (!c.tr || c.step !== "closed") return c;
  return note({
    ...plainVote(c), step: "general", after: null, roles: { proposer: null, seconder: null, opposer: null }, closers: [], debate: emptyDebate(), speech: null, amendments: [], amend: null, poll: null,
    result: null, timer: null, ballots: {}, outcome: null, tr: { ...c.tr, current: null, saved: null, cauc: null, finalDone: false },
  }, "Back to the resolutions");
}
/* Opening statements: every state in turn, alphabetically */
export function startStatements(c: Chamber): Chamber {
  return c.tr && c.step === "general" && !c.speech && !c.poll ? note({ ...c, step: "statements" }, "Opening statements") : c;
}
/** The next state to give its statement: those present, in alphabetical order. */
export function upcomingStatements(c: Chamber, n = 3): string[] {
  if (!c.tr) return [];
  return c.delegates.filter((d) => isHere(c, d.id) && !c.tr!.opened.includes(d.id) && !observing(c, d.id)).slice(0, n).map((d) => d.id);
}
export const nextStatement = (c: Chamber): string | null => upcomingStatements(c, 1)[0] ?? null;
export function callStatement(c: Chamber, who: string): Chamber {
  if (!c.tr || c.step !== "statements" || c.speech || !has(c, who) || c.tr.opened.includes(who) || observing(c, who)) return c;
  return start(c, who, "for", "statement");
}
export function endStatements(c: Chamber): Chamber {
  return c.tr && c.step === "statements" && !c.speech ? note({ ...c, step: "general" }, "Opening statements finished") : c;
}

/* Yielding to another country: it speaks next, with the time left on the speaker's clock added to its own. */
export function yieldToCountry(c: Chamber, who: string, n: number, target: string): Chamber {
  const sp = c.speech;
  if (!c.tr || !sp || sp.who !== who || sp.phase !== "after" || sp.pois !== n || !has(c, target) || target === who || observing(c, target) || (sp.role !== "speaker" && sp.role !== "amender")) return c;
  const slot: Slot = { id: target, side: sp.side };
  const done = finish(note(c, `${nameOf(c, who)} yields to ${nameOf(c, target)}${n ? ` after ${n} Point${n === 1 ? "" : "s"} of Information` : ""}`));
  const list = [slot, ...done.debate.list.filter((x) => x.id !== target)];
  return { ...done, debate: { ...done.debate, list }, tr: { ...done.tr!, bonus: { id: target, secs: sp.left ?? 0 } } };
}

/* Caucuses */

/** Why a moderated caucus can't be run, or null. At most 20 minutes; each speech shorter than the caucus and fitting into it evenly. */
export function modError(total: number, per: number): string | null {
  if (!Number.isInteger(total) || total < 10 || total > TR.maxCaucus) return "A moderated caucus is at most 20 minutes.";
  if (!Number.isInteger(per) || per < 5) return "Give each speaker at least 5 seconds.";
  if (per >= total) return "The time per speaker must be less than the caucus.";
  if (total % per !== 0) return "The time per speaker must fit into the caucus evenly.";
  return null;
}
export function callMod(c: Chamber, topic: string, total: number, per: number): Chamber {
  const t = c.tr;
  const name = topic.trim().slice(0, 120);
  if (!t || c.speech || c.poll || (c.step !== "general" && c.step !== "floor") || !name || modError(total, per)) return c;
  return note({ ...c, step: "caucus", after: c.step, timer: null, result: null, debate: emptyDebate(), tr: { ...t, saved: c.debate, cauc: { kind: "mod", topic: name, per, total, ext: 0, clock: timerFor(name, total) } } },
    `Moderated caucus on ${name}: ${clock(total * 1000)}, ${per}s each`);
}
const clockOf = (c: Chamber) => c.tr?.cauc?.clock ?? null;
const withClock = (c: Chamber, f: (t: Timer) => Timer): Chamber => (c.tr?.cauc?.clock ? { ...c, tr: { ...c.tr, cauc: { ...c.tr.cauc, clock: f(c.tr.cauc.clock) } } } : c);
/** The whole caucus's clock (a moderated caucus, an amendment's debate), apart from each speaker's. */
export function startCauc(c: Chamber, at: number): Chamber {
  const k = clockOf(c);
  return k && !running(k) && k.left > 0 ? withClock(c, (t) => ({ ...t, endsAt: at + t.left })) : c;
}
export function pauseCauc(c: Chamber, at: number): Chamber {
  const k = clockOf(c);
  return k && running(k) ? withClock(c, (t) => ({ ...t, endsAt: null, left: remaining(t, at) })) : c;
}
export function setPer(c: Chamber, per: number): Chamber {
  const k = c.tr?.cauc;
  return k && (k.kind === "mod" || k.kind === "amend") && !c.speech && !modError(k.total, per) ? { ...c, tr: { ...c.tr!, cauc: { ...k, per } } } : c;
}
/** At most two extensions, each no longer than the caucus first was, and only once its time has run out. */
export function extendCaucus(c: Chamber, secs: number, at: number): Chamber {
  const k = c.tr?.cauc;
  if (!k || !Number.isInteger(secs) || secs < 10 || secs > k.total || k.ext >= 2 || c.speech) return c;
  const inCaucus = c.step === "caucus" || (c.step === "amend" && c.amend?.stage === "debate");
  if (!inCaucus || k.kind === "final") return c;
  const t = k.clock ?? c.timer;
  if (!t || remaining(t, at) > 0) return c;
  const fresh: Timer = { label: t.label, total: secs * 1000, endsAt: null, left: secs * 1000 };
  return note({ ...c, timer: k.clock ? c.timer : fresh, tr: { ...c.tr!, cauc: { ...k, ext: k.ext + 1, clock: k.clock ? fresh : null } } }, `Caucus extended by ${clock(secs * 1000)}`);
}
/** A moderated caucus can be closed once its last three speakers have finished. */
export function canCloseMod(c: Chamber): boolean {
  return c.step === "caucus" && c.tr?.cauc?.kind === "mod" && !c.speech && c.debate.run.length >= 3;
}
export function closeMod(c: Chamber): Chamber {
  return canCloseMod(c) ? endCaucus(c) : c;
}

/* Motions: raised, put in the order the chair chooses, then voted on by placard. */

export const MOTION_LABEL: Record<MotionKind, string> = {
  mod: "Moderated Caucus", unmod: "Unmoderated Caucus", extend: "Extend the Caucus", closemod: "Close the Moderated Caucus", close: "Close Debate",
  amend: "Introduce an Amendment", open: "Open Debate", resume: "Resume Debate", suspend: "Suspend Debate",
};
/** What a motion is about, without who raised it or what kind it is. */
export const motionDetail = (c: Chamber, m: Motion): string => {
  switch (m.kind) {
    case "mod": return `${clock(m.total * 1000)} on ${m.topic}, ${m.per}s each`;
    case "unmod": return clock(m.total * 1000);
    case "extend": return `by ${clock(m.total * 1000)}`;
    case "amend": { const a = c.amendments.find((x) => x.id === m.ref); return a ? `the amendment from ${nameOf(c, a.by)}` : ""; }
    default: return "";
  }
};
/** The words above a motion on the display: who raised it, then what kind it is. */
export const motionPill = (c: Chamber, m: Motion): string[] => [m.by ? `${nameOf(c, m.by)} proposes` : "", MOTION_LABEL[m.kind]].filter(Boolean);
export const motionText = (c: Chamber, m: Motion) => {
  const detail = motionDetail(c, m);
  return [m.by ? `${nameOf(c, m.by)} proposes` : "", MOTION_LABEL[m.kind], detail].filter(Boolean).join(" \u00B7 ");
};
/**
 * The motions that make sense now (2026 handbook): caucuses and closing the debate while a resolution is debated, none otherwise (the chair picks the resolution from the hub).
 * there is no motion to introduce an amendment, because the chairs select the amendments themselves.
 */
export const motionKinds = (c: Chamber): MotionKind[] => {
  const t = c.tr;
  if (!t) return [];
  return ["mod", "unmod", "extend", "closemod", "close"];
};
/** Whether delegates can raise motions now. */
export const motionsOpen = (c: Chamber) => !!c.tr && ((c.step === "general" && !!c.style) || c.step === "floor" || (c.step === "caucus" && c.tr.cauc?.kind !== "final") || (c.step === "amend" && c.amend?.stage === "debate"));

export type MotionInput = { kind: MotionKind; by: string | null; topic?: string; total?: number; per?: number; ref?: string | null };
export function motionError(c: Chamber, m: MotionInput): string | null {
  const t = c.tr;
  if (!t) return "Not a Trinity committee.";
  if (m.by && !has(c, m.by)) return "Choose a state.";
  const total = m.total ?? 0;
  if (!motionKinds(c).includes(m.kind)) return "That motion is not used at this point.";
  switch (m.kind) {
    case "mod": return !(m.topic ?? "").trim() ? "A moderated caucus needs a topic." : modError(total, m.per ?? 0);
    case "unmod": return !Number.isInteger(total) || total < 30 || total > TR.maxCaucus ? "An unmoderated caucus is 30 seconds to 20 minutes." : null;
    case "extend": {
      const k = t.cauc;
      if (!k || k.kind === "final") return "There is no caucus to extend.";
      if (k.ext >= 2) return "A caucus can only be extended twice.";
      return !Number.isInteger(total) || total < 10 || total > k.total ? "An extension is no longer than the caucus was." : null;
    }
    case "closemod": return canCloseMod(c) ? null : "A moderated caucus closes after its last three speakers have finished.";
    case "close": return c.step === "floor" ? null : "Debate closes during the resolution debate.";
    case "amend": return c.step === "floor" && c.amendments.some((a) => a.id === m.ref && a.status === "waiting") ? null : "Choose an amendment waiting to be introduced.";
    default: return null;
  }
}
export function addMotion(c: Chamber, id: string, m: MotionInput): Chamber {
  const t = c.tr;
  if (!t || t.motions.some((x) => x.id === id) || motionError(c, m)) return c;
  const at = Math.max(now(), ...t.motions.map((x) => x.at + 1));
  const motion: Motion = { id, kind: m.kind, by: m.by, topic: (m.topic ?? "").trim().slice(0, 120), total: m.total ?? 0, per: m.per ?? 0, ref: m.ref ?? null, at, status: "waiting" };
  const added: Chamber = { ...c, tr: { ...t, motions: [...t.motions, motion] } };
  return note(c.style ? precedenceMotions(added) : added, `Motion: ${motionText(c, motion)}`);
}
export const waitingMotions = (c: Chamber) => c.tr?.motions.filter((m) => m.status === "waiting") ?? [];

/* Standard and Custom: motions are taken in order of precedence, the most disruptive first (as at THIMUN and Harvard):
   suspending the meeting, then an unmoderated caucus, extending the caucus, a moderated caucus, closing a moderated
   caucus, then closing the debate. Among motions of the same kind, the longest caucus goes first, then the oldest.
   Closing the debate needs two-thirds of the states present; every other motion a simple majority of them. Trinity
   keeps its own way: the chair puts motions in the order they choose and more For than Against carries one. */
export const PRECEDENCE: MotionKind[] = ["suspend", "unmod", "extend", "mod", "closemod", "close", "amend", "open", "resume"];
export const byPrecedence = (a: Motion, b: Motion) => PRECEDENCE.indexOf(a.kind) - PRECEDENCE.indexOf(b.kind) || b.total - a.total || a.at - b.at;
/** The votes For a motion needs to pass under the general rules, or null where more For than Against carries it (Trinity). */
export function motionNeeds(c: Chamber, kind: MotionKind): number | null {
  if (!c.style) return null;
  const n = present(c);
  return kind === "close" ? Math.max(1, Math.ceil((n * 2) / 3)) : Math.floor(n / 2) + 1;
}
/** What a motion needs, in words: "Needs 7 (two-thirds)". Null where more For than Against carries it. */
export const motionNeedsText = (c: Chamber, kind: MotionKind): string | null => {
  const n = motionNeeds(c, kind);
  return n === null ? null : `Needs ${n} For (${kind === "close" ? "two-thirds" : "a majority"} of ${present(c)} present)`;
};
/** Whether a motion's vote, as counted, carries it. */
export const motionPasses = (c: Chamber, p: Pick<Poll, "yes" | "no" | "motion">): boolean => {
  const m = c.tr?.motions.find((x) => x.id === p.motion);
  const need = m ? motionNeeds(c, m.kind) : null;
  return need === null ? passes(p) : p.yes >= need;
};
/** Standard and Custom: the waiting motions in order of precedence. */
export function precedenceMotions(c: Chamber): Chamber {
  return reorderMotions(c, [...waitingMotions(c)].sort(byPrecedence));
}
const reorderMotions = (c: Chamber, w: Motion[]): Chamber => {
  let i = 0;
  return c.tr ? { ...c, tr: { ...c.tr, motions: c.tr.motions.map((m) => (m.status === "waiting" ? w[i++] : m)) } } : c;
};
export function sortMotions(c: Chamber): Chamber {
  return reorderMotions(c, [...waitingMotions(c)].sort((a, b) => a.at - b.at));
}
export function moveMotion(c: Chamber, id: string, by: -1 | 1): Chamber {
  const w = [...waitingMotions(c)];
  const at = w.findIndex((m) => m.id === id);
  const to = at + by;
  if (at < 0 || to < 0 || to >= w.length) return c;
  [w[at], w[to]] = [w[to], w[at]];
  return reorderMotions(c, w);
}
const setMotion = (c: Chamber, id: string, status: Motion["status"]): Chamber => (c.tr ? { ...c, tr: { ...c.tr, motions: c.tr.motions.map((m) => (m.id === id ? { ...m, status } : m)) } } : c);
export function withdrawMotion(c: Chamber, id: string): Chamber {
  const m = c.tr?.motions.find((x) => x.id === id);
  return m?.status === "waiting" && c.poll?.motion !== id ? setMotion(c, id, "withdrawn") : c;
}
const MOTION_STEPS: Step[] = ["statements", "general", "caucus", "floor", "amend", "closing"];
export function voteMotion(c: Chamber, id: string): Chamber {
  const m = c.tr?.motions.find((x) => x.id === id);
  if (!c.tr || !m || m.status !== "waiting" || c.poll || c.speech || !MOTION_STEPS.includes(c.step) || motionError(c, m)) return c;
  return note({ ...c, poll: { title: motionText(c, m), kind: "motion", yes: 0, no: 0, abstain: 0, motion: id } }, `Vote on the motion: ${motionText(c, m)}`);
}
export function decideMotion(c: Chamber, ruling: Ruling, id: string): Chamber {
  const p = c.poll;
  const m = c.tr?.motions.find((x) => x.id === id);
  if (!c.tr || !m || p?.kind !== "motion" || p.motion !== id) return c;
  const carried = motionPasses(c, p);
  const yes = ruling ? ruling === "for" : carried;
  const overrule = ruling !== null && yes !== carried;
  const need = motionNeeds(c, m.kind);
  const tail = `${p.yes} for, ${p.no} against, ${p.abstain} abstaining${need !== null ? `, ${need} needed` : ""}${overrule ? ", overruled" : ""}${rollTail(c, p)}`;
  const result: Result = { title: p.title, kind: "motion", motion: id, passed: yes, yes: p.yes, no: p.no, abstain: p.abstain, ...(p.ballots ? { ballots: p.ballots } : {}) };
  const closed = setMotion({ ...c, poll: null, result }, id, yes ? "passed" : "failed");
  if (!yes) return note(closed, `Motion failed (${tail}): ${p.title}`);
  const done = applyMotion(closed, m);
  // Passed, but there is nothing to carry out at this moment (a caucus voted for while another is running): it goes
  // back in the queue, so the chair can put it again instead of having to type it in a second time.
  if (done === closed && m.kind !== "open" && m.kind !== "resume" && m.kind !== "suspend") return note(setMotion(closed, id, "waiting"), `Motion passed (${tail}): ${p.title}. It could not be carried out now, so it is back in the queue`);
  return note(done === closed ? closed : { ...done, result: done.step === closed.step ? result : null }, `Motion passed (${tail}): ${p.title}${done === closed && m.kind !== "open" && m.kind !== "resume" && m.kind !== "suspend" ? ". It could not be carried out now" : ""}`);
}
function applyMotion(c: Chamber, m: Motion): Chamber {
  switch (m.kind) {
    case "mod": return callMod(c, m.topic, m.total, m.per);
    case "unmod": return callCaucus(c, m.total);
    case "extend": return extendCaucus(c, m.total, now());
    case "closemod": return endCaucus(c);
    case "close": return closeDebate(c);
    case "amend": return entertain(c, m.ref ?? "");
    default: return c;
  }
}

/* Points, rights of reply and honorary observers */

export const POINT_LABEL: Record<PointKind, string> = { order: "Order", privilege: "Personal Privilege", inquiry: "Procedural Inquiry", clarification: "Clarification" };
export function logPoint(c: Chamber, kind: PointKind): Chamber {
  return c.tr ? note({ ...c, tr: { ...c.tr, points: [...c.tr.points, { at: now(), kind, wk: c.tr.week }] } }, `Point of ${POINT_LABEL[kind]}`) : c;
}
export const REPLY_SECS = 20;
/** Whatever clock is running (a speech's, a caucus's) waits, paused, while a state is heard, and comes back when it is done. */
export function startReply(c: Chamber, by: string, to: string | null, at = now()): Chamber {
  const t = c.tr;
  if (!t || t.reply || !has(c, by) || (to !== null && !has(c, to)) || by === to) return c;
  const paused = c.timer ? pauseTimer(c, at) : c; // pauses a moderated caucus's own clock with its speaker's, too
  const stash = paused.timer;
  return note({ ...paused, timer: timerFor("Right of reply", REPLY_SECS), tr: { ...paused.tr!, reply: { by, to }, stash } }, `${nameOf(c, by)} claims a right of reply${to ? ` against ${nameOf(c, to)}` : ""}`);
}
export function finishReply(c: Chamber, outcome: "apologised" | "withdrew" | "refused" | null): Chamber {
  const t = c.tr;
  if (!t?.reply) return c;
  const r = t.reply;
  const text = outcome ? `${r.to ? nameOf(c, r.to) : "The speaker"} ${outcome}` : "No answer taken";
  return note({ ...c, timer: t.stash, tr: { ...t, reply: null, stash: null, replies: [...t.replies, { at: now(), by: r.by, to: r.to, outcome, wk: t.week }] } }, `Right of reply by ${nameOf(c, r.by)}: ${text}`);
}
export function setObserver(c: Chamber, who: string): Chamber {
  if (!c.tr || !has(c, who) || c.speech?.who === who || observing(c, who)) return c;
  const list = c.debate.list.filter((x) => x.id !== who);
  return note({ ...c, debate: { ...c.debate, list }, tr: { ...c.tr, observers: { ...c.tr.observers, [who]: now() + OBSERVER_SECS * 1000 } } }, `${nameOf(c, who)} is an honorary observer for 5 minutes`);
}
export function endObserver(c: Chamber, who: string): Chamber {
  if (!c.tr || !(who in c.tr.observers)) return c;
  const observers = { ...c.tr.observers };
  delete observers[who];
  return note({ ...c, tr: { ...c.tr, observers } }, `${nameOf(c, who)} is no longer an observer`);
}
export const observerLeft = (c: Chamber, who: string, at = now()) => Math.max(0, (c.tr?.observers[who] ?? 0) - at);

/* Storage */
export function load(): Chamber | null {
  try { return normalise(JSON.parse(localStorage.getItem(KEY) ?? "null")); } catch { return null; }
}
export function save(c: Chamber | null) {
  try { c ? localStorage.setItem(KEY, JSON.stringify(c)) : localStorage.removeItem(KEY); } catch { /* storage blocked: the console still works for this visit */ }
}
