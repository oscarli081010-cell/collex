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
/** `stance`: the state said it speaks For or Against (the Trinity general list and moderated caucus), so the side is shown. */
export type Slot = { id: string; side: Side; stance?: boolean };
export type Role = "proposer" | "seconder" | "opposer" | "speaker" | "amender" | "closer" | "statement";
/** speech, then the speaker either takes a Point of Information (ask, then answer) or yields to the chair. */
export type Phase = "speech" | "after" | "ask" | "answer";
/** `left` is the time the speaker had unused when the speech ended, in seconds: what a yield to another country passes on. */
export type Speech = { who: string; side: Side; role: Role; phase: Phase; asker: string | null; pois: number; left?: number; stance?: boolean };
/** The speeches on the amendment in hand. */
export type Debate = { list: Slot[]; run: Slot[] };
/** `backers` are the amendment's signatories. `at` is when it was handed in. */
/** Strike a clause, amend it, or add one. */
export type AmendHow = "strike" | "amend" | "add";
export type Amendment = { id: string; by: string; how?: AmendHow; /** Trinity: the second signatory. */ seconder?: string | null; clause: string; text: string; backers: string[]; at: number; status: "waiting" | "entertained" | "passed" | "failed" | "withdrawn" | "invalid" };
/** What a state did, for the analytics: a speech of each kind, a Point of Information asked or answered, an amendment handed in or signed. */
export type StatKind = "proposer" | "seconder" | "opposer" | "amender" | "speaker" | "closing" | "poi" | "reply" | "amendment" | "signatory" | "statement";
/** `wk` is the week of a Trinity committee the entry was made in. */
export type Stat = { at: number; who: string; kind: StatKind; secs: number; with?: string; res: string; wk?: 1 | 2 };
export type AmendStage = "read" | "ask" | "debate" | "vote";
/** A vote by placard: counts only. */
/** `motion` is the Trinity motion being voted on. */
export type Poll = { title: string; kind: "debate" | "amendment" | "motion"; yes: number; no: number; abstain: number; motion?: string };
/** `kind` says which vote it was (whether to debate an amendment, or whether to adopt it) and `amendment` which one. */
export type Result = { title: string; kind: "debate" | "amendment" | "motion"; amendment?: string; /** The Trinity motion a result is for. */ motion?: string; passed: boolean; yes: number; no: number; abstain: number };
export type Outcome = { passed: boolean; yes: number; no: number; abstain: number; needed: number };
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
};

// Times are milliseconds. A running timer has `endsAt`; a paused one keeps what is left in `left`. The time on screen
// is always worked out from the clock, never counted down, so a throttled background tab can't drift.
export type Timer = { label: string; total: number; endsAt: number | null; left: number };

export type Chamber = {
  v: 1;
  rules: "evatt" | "trinity";
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
  amend: { id: string; stage: AmendStage } | null;
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
  log: Entry[];
  /** Only a Trinity Grammar MUN committee has this. */
  tr: Trin | null;
};

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

export const remaining = (t: Timer, at: number) => (t.endsAt === null ? t.left : Math.max(0, t.endsAt - at));
export const running = (t: Timer | null) => !!t && t.endsAt !== null;
export const clock = (ms: number) => {
  const secs = Math.ceil(ms / 1000);
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
};

/* Setting up */

const byName = (a: Delegate, b: Delegate) => a.name.localeCompare(b.name, "en-AU", { sensitivity: "base" });
export const emptyDebate = (): Debate => ({ list: [], run: [] });
export const timerFor = (label: string, secs: number): Timer => ({ label, total: secs * 1000, endsAt: null, left: secs * 1000 });

// A long state's name goes in its short form, so the tiles it sits in stay a sensible size: the well-known ones by their
// usual letters, and any other very long name by the first letters of its words.
const SHORT: Record<string, string> = {
  "united states of america": "USA", "united states": "USA", "united kingdom": "UK", "united arab emirates": "UAE",
  "democratic republic of the congo": "DRC", "democratic republic of congo": "DRC", "central african republic": "CAR",
  "russian federation": "Russia", "peoples republic of china": "China", "republic of korea": "South Korea",
  "democratic peoples republic of korea": "North Korea", "great britain": "UK",
};
export function shortName(name: string): string {
  const clean = name.trim().replace(/\s+/g, " ");
  const known = SHORT[clean.toLowerCase().replace(/[.'’]/g, "")];
  if (known) return known;
  if (clean.length <= 18) return clean;
  const words = clean.split(" ").filter((w) => !/^(of|the|and|for|de|la|el)$/i.test(w));
  return words.length >= 2 ? words.map((w) => w[0].toUpperCase()).join("") : clean;
}

// Names typed one per line or separated by commas; blanks and repeats dropped, long ones shortened.
export function parseNames(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of text.split(/[\n,;]+/)) {
    const name = shortName(raw.trim().replace(/\s+/g, " ").slice(0, 60));
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

const isTrin = (t: unknown): t is Trin => {
  const o = t as Partial<Trin> | null;
  return !!o && typeof o === "object" && (o.week === 1 || o.week === 2) && Array.isArray(o.docs) && Array.isArray(o.motions) && Array.isArray(o.opened)
    && Array.isArray(o.points) && Array.isArray(o.replies) && !!o.observers && typeof o.observers === "object" && !!o.rolls && typeof o.rolls === "object";
};

// Whatever comes in from storage or the database is checked once here. A committee saved before this shape existed keeps
// its name, resolution, states and minutes, and starts again at the welcome.
export function normalise(x: unknown): Chamber | null {
  if (!x || typeof x !== "object") return null;
  const o = x as Record<string, unknown> & Partial<Chamber> & { resolution?: { title?: string } };
  if (o.v !== 1 || !Array.isArray(o.delegates) || !Array.isArray(o.log)) return null;
  const ok = (o.rules === "evatt" || (o.rules === "trinity" && isTrin(o.tr))) && o.rev === 2 && typeof o.step === "string" && o.debate && Array.isArray(o.debate.list) && Array.isArray(o.debate.run)
    && o.roll && typeof o.roll === "object" && o.roles && Array.isArray(o.closers) && Array.isArray(o.amendments) && o.ballots && typeof o.ballots === "object";
  if (ok) return { ...(o as Chamber), tr: o.rules === "trinity" ? { ...(o.tr as Trin), cauc: (o.tr as Trin).cauc ?? null, saved: (o.tr as Trin).saved ?? null, current: (o.tr as Trin).current ?? null, bonus: (o.tr as Trin).bonus ?? null, stash: (o.tr as Trin).stash ?? null, reply: (o.tr as Trin).reply ?? null, finalDone: !!(o.tr as Trin).finalDone } : null, stats: Array.isArray(o.stats) ? o.stats : [], background: validBackground(o.background) ? o.background : null, backgroundStrength: typeof o.backgroundStrength === "number" ? Math.min(100, Math.max(20, o.backgroundStrength)) : 55, amendments: (o.amendments as Amendment[]).map((a, i) => ({ ...a, at: a.at ?? i })) };
  const old = o.delegates as { id: string; name: string }[];
  const resolution = String(o.topic ?? "").trim() || String(o.resolution?.title ?? "").trim();
  const fresh = create(String(o.name ?? "Committee"), resolution, Number(o.speakSecs) || 120, [], []);
  return { ...fresh, delegates: old.map((d) => ({ id: d.id, name: d.name })).sort(byName), log: (o.log as Entry[]).slice(-200) };
}

export const note = (c: Chamber, text: string): Chamber => ({ ...c, log: [...c.log, { at: now(), text }] });
export const nameOf = (c: Chamber, who: string | null) => c.delegates.find((d) => d.id === who)?.name ?? "";
export const has = (c: Chamber, who: string | null | undefined): who is string => !!who && c.delegates.some((d) => d.id === who);
export const other = (s: Side): Side => (s === "for" ? "against" : "for");
const sideWord = (s: Side) => (s === "for" ? "in favour" : "against");

export const ROLE_LABEL: Record<Role, string> = { proposer: "Proposer", seconder: "Seconder", opposer: "Opposer", speaker: "Speaker", amender: "Amendment Proposer", closer: "Closing Speech", statement: "Opening Statement" };
/** A Trinity committee calls the seconder a co-sponsor. */
export const roleName = (c: Chamber, r: Role) => (c.tr && r === "seconder" ? "Co-sponsor" : ROLE_LABEL[r]);
/** What the document being debated is called. */
export const resNoun = (_c: Chamber) => "Resolution";
export const ATTEND_LABEL: Record<Attend, string> = { present: "Present", voting: "Present & Voting", abstain: "Abstain" };

/* The display's background photo */
const BG_URL = /^https:\/\/npdaczdwmhbtgitmplxc\.supabase\.co\/storage\/v1\/object\/public\/photos\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp)$/;
const BG_DATA = /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/;
/** Only a file in our own photos bucket or a small JPEG carried in the committee: it ends up inside a CSS url(), so nothing else gets through. */
export const validBackground = (v: unknown): v is string => typeof v === "string" && ((v.length <= 600 && BG_URL.test(v)) || (v.length <= 700_000 && BG_DATA.test(v)));
export function setBackground(c: Chamber, bg: string | null): Chamber {
  return bg === null || validBackground(bg) ? { ...c, background: bg } : c;
}
export function setBackgroundStrength(c: Chamber, n: number): Chamber {
  return Number.isFinite(n) ? { ...c, backgroundStrength: Math.min(100, Math.max(20, Math.round(n))) } : c;
}

/* People */
export function addDelegate(c: Chamber, id: string, name: string): Chamber {
  const clean = shortName(name.trim().replace(/\s+/g, " ").slice(0, 60));
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
  return note({ ...c, step: c.tr ? "statements" : "pick" }, `Roll call: ${n.present} present, ${n.voting} present and voting, ${n.abstain} abstaining${n.unmarked ? `, ${n.unmarked} not marked` : ""}`);
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
const roleSecs = (c: Chamber, role: Role) => {
  if (!c.tr) return c.speakSecs;
  if (role === "statement") return TR.statement;
  if (role === "proposer" || role === "seconder") return TR.speech;
  if (role === "opposer") return TR.introOppose;
  if (role === "closer") return TR.oppose;
  return c.speakSecs;
};
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
  const a = c.amendments.find((x) => x.id === c.amend?.id);
  if (c.step !== "amend" || c.amend?.stage !== "debate" || c.speech || c.debate.run.length || !a || !has(c, a.by)) return c;
  return start(c, a.by, "for", "amender", secs ?? (c.tr?.cauc?.kind === "amend" ? c.tr.cauc.per : undefined));
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

export function endSpeech(c: Chamber, at: number, who: string): Chamber {
  const sp = c.speech;
  if (!sp || sp.who !== who || sp.phase !== "speech") return c;
  const logged = record(pauseTimer(c, at), sp.who, SPEECH_KIND[sp.role], used(c, at), at);
  if (sp.role === "closer") return finish(logged); // no Points of Information in the closing
  return { ...logged, speech: { ...sp, phase: "after", left: Math.floor((logged.timer?.left ?? 0) / 1000) } };
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
  return note({ ...c, step: c.after ?? "floor", after: null, timer: null, ...(t ? { debate: t.saved ?? c.debate, tr: { ...t, cauc: null, saved: null } } : {}) }, "Caucus ended");
}

/* Amendments */

// Notes come in from the caucus on, and are taken one at a time once it is over. Signatories are the states that sign it.
// Trinity: a quarter of the states present must sign (the proposer and seconder among them), and a clause already amended needs full consensus to be amended again.
export const present = (c: Chamber) => c.delegates.filter((d) => c.roll[d.id] === "present" || c.roll[d.id] === "voting").length;
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
  tr: { ...c.tr, cauc: { kind: "amend", topic: a?.text ?? "Amendment", per: TR.amendPer, total: TR.amend, ext: 0, clock: timerFor("Amendment debate", TR.amend) } },
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
  if (c.step !== "amend" || c.amend?.id !== id || (c.amend.stage !== "read" && c.amend.stage !== "debate") || c.speech) return c;
  return note({ ...c, amend: { ...c.amend, stage: "vote" }, poll: poll("Adopt this amendment?", "amendment"), ...(c.tr ? { tr: { ...c.tr, cauc: null } } : {}) }, "Vote on the amendment");
}
export function tally(c: Chamber, which: "yes" | "no" | "abstain", by: 1 | -1): Chamber {
  if (!c.poll) return c;
  return { ...c, poll: { ...c.poll, [which]: Math.min(c.delegates.length, Math.max(0, c.poll[which] + by)) } };
}
// More in favour than against passes. The President may overrule the result.
export const passes = (p: Pick<Poll, "yes" | "no">) => p.yes > p.no;

/** `ruling` is the President's overrule, For or Against; with none, the count decides. */
export type Ruling = "for" | "against" | null;
export function decideAsk(c: Chamber, ruling: Ruling, id: string): Chamber {
  const p = c.poll;
  if (c.step !== "amend" || c.amend?.id !== id || c.amend.stage !== "ask" || p?.kind !== "debate") return c;
  const yes = ruling ? ruling === "for" : passes(p);
  const overrule = ruling !== null && yes !== passes(p);
  const result: Result = { title: p.title, kind: "debate", amendment: id, passed: yes, yes: p.yes, no: p.no, abstain: p.abstain };
  const tail = `${p.yes} for, ${p.no} against, ${p.abstain} abstaining${overrule ? ", overruled" : ""}`;
  if (yes) return note({ ...toDebate(c, c.amendments.find((x) => x.id === id)), poll: null, result }, `Amendment to be debated (${tail})`);
  return note({ ...c, amend: { ...c.amend, stage: "vote" }, poll: poll("Adopt this amendment?", "amendment"), result }, `Not to be debated (${tail}); straight to the vote`);
}
export function decideAmendment(c: Chamber, ruling: Ruling, id: string): Chamber {
  const p = c.poll;
  const a = c.amendments.find((x) => x.id === c.amend?.id);
  if (c.step !== "amend" || c.amend?.id !== id || c.amend.stage !== "vote" || p?.kind !== "amendment" || !a) return c;
  const yes = ruling ? ruling === "for" : passes(p);
  const overrule = ruling !== null && yes !== passes(p);
  const result: Result = { title: `Amendment from ${nameOf(c, a.by)}`, kind: "amendment", amendment: a.id, passed: yes, yes: p.yes, no: p.no, abstain: p.abstain };
  const tail = `${p.yes} for, ${p.no} against, ${p.abstain} abstaining${overrule ? ", overruled" : ""}`;
  // On to the next amendment.
  const next: Chamber = { ...setAmendment(c, a.id, yes ? "passed" : "failed"), step: "floor", amend: null, poll: null, debate: c.tr ? c.tr.saved ?? emptyDebate() : c.held ?? emptyDebate(), held: null, result, timer: null, ...(c.tr ? { tr: { ...c.tr, saved: null, cauc: null } } : {}) };
  return note(next, `Amendment from ${nameOf(c, a.by)} ${yes ? "passed" : "failed"} (${tail})`);
}

/* The speakers' list for the amendment in hand */

// Evatt: the opening caucus, the debate on the resolution as a whole, and an amendment's debate. Trinity: the general speakers' list, a moderated caucus, the draft resolution's own list, an amendment's debate.
export const listOpen = (c: Chamber) => c.tr
  ? c.step === "proposer" || c.step === "seconder" || c.step === "opposer" || c.step === "floor" || (c.step === "amend" && c.amend?.stage === "debate") || (c.step === "caucus" && c.tr.cauc?.kind === "mod")
  : c.step === "floor" || c.step === "caucus" || (c.step === "amend" && c.amend?.stage === "debate");
/** Whether the list has For and Against columns. The general list and a moderated caucus are one list of states. */
export const sided = (c: Chamber) => !c.tr || c.step === "floor" || c.step === "amend" || c.step === "proposer" || c.step === "seconder" || c.step === "opposer";
export const spokeOn = (c: Chamber, who: string, side: Side) => c.debate.run.some((s) => s.id === who && s.side === side);
export function canAdd(c: Chamber, who: string, side: Side): boolean {
  return listOpen(c) && has(c, who) && !observing(c, who) && !c.debate.list.some((s) => s.id === who) && c.speech?.who !== who && (!!c.tr || !spokeOn(c, who, side));
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
export function startVote(c: Chamber): Chamber {
  if (c.step !== "closing" || c.speech) return c;
  return note({ ...c, step: "vote", ballots: {} }, "Roll call vote");
}

/* The vote on the resolution: a roll call */

export function cast(c: Chamber, who: string, ballot: Ballot | null): Chamber {
  if (c.step !== "vote" || !has(c, who)) return c;
  if (c.tr && ballot === "abstain" && c.roll[who] === "voting") return c; // Present and Voting must vote For or Against
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
  if (c.tr) return finishTrinityVote(c, n);
  const need = needed(c.delegates.length);
  const passed = n.yes >= need;
  const outcome: Outcome = { passed, yes: n.yes, no: n.no, abstain: n.abstain, needed: need };
  return note({ ...c, step: "closed", outcome }, `Resolution ${passed ? "approved" : "not approved"}: ${n.yes} for, ${n.no} against, ${n.abstain} abstaining${passed ? "" : `, ${need} needed`}`);
}
// Back to amending the ballots, if the result was recorded too soon.
export function reopenVote(c: Chamber): Chamber {
  if (c.step !== "closed" || !c.outcome) return c;
  return note({ ...c, step: "vote", outcome: null, ...(c.tr ? { tr: { ...c.tr, docs: c.tr.docs.map((d) => (d.id === c.tr!.current ? { ...d, result: null } : d)) } } : {}) }, "Vote reopened");
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

/* Timer */

/** In a moderated caucus (and an amendment's debate) every speech is taken out of the whole caucus's time: its clock runs when a speaker's does. */
const drains = (c: Chamber) => !!c.speech && !!c.tr?.cauc?.clock && (c.tr.cauc.kind === "mod" || c.tr.cauc.kind === "amend") && (c.step === "caucus" || c.step === "amend");
export function startTimer(c: Chamber, at: number): Chamber {
  if (!c.timer || running(c.timer) || c.timer.left <= 0) return c;
  const next = { ...c, timer: { ...c.timer, endsAt: at + c.timer.left } };
  return drains(c) ? startCauc(next, at) : next;
}
export function pauseTimer(c: Chamber, at: number): Chamber {
  if (!c.timer || !running(c.timer)) return c;
  const next = { ...c, timer: { ...c.timer, endsAt: null, left: remaining(c.timer, at) } };
  // The caucus stops with the speaker, or when the speaker's time ran out if the chair was slow to stop it.
  return drains(c) ? pauseCauc(next, Math.min(at, c.timer.endsAt ?? at)) : next;
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

export const used = (c: Chamber, at: number) => (c.timer ? Math.max(0, Math.round((c.timer.total - remaining(c.timer, at)) / 1000)) : 0);
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

/* What is open right now, for the display: the negotiation chamber (shut for the whole opening and every caucus; open between amendments and while one
   is debated, but not while it is read or voted on, and shut again from the closing speeches on), notes with amendments
   (from the first caucus of the debate until the closing), and the speakers' list (once the council has voted to debate an amendment). */
export function rooms(c: Chamber): { negotiation: boolean; amendments: boolean; speakers: boolean; labels?: string[] } {
  if (c.tr) {
    // The pill says what delegates can do now, and it is exactly what the console has open: the speakers' list, amendments and motions. A caucus is not named.
    const list = listOpen(c);
    const labels = [list && "Speakers\u2019 List Open", amendmentsOpen(c) && "Amendments Open", motionsOpen(c) && "Motions Open"].filter((x): x is string => !!x);
    return { negotiation: false, amendments: amendmentsOpen(c), speakers: list, labels };
  }
  const speakers = listOpen(c);
  return {
    negotiation: c.step === "floor" || (c.step === "amend" && c.amend?.stage === "debate"),
    amendments: c.step === "caucus" || c.step === "floor" || c.step === "amend",
    speakers,
  };
}

/* Where the council is: three parts, each with a step inside it (Trinity has four) */
export const STAGES = ["Opening", "Debate", "Closing"] as const;
export const TRINITY_STAGES = ["Opening", "Resolutions", "Debate", "Closing"] as const;
export const stagesOf = (c: Chamber): readonly string[] => (c.tr ? TRINITY_STAGES : STAGES);
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
    case "floor": return c.tr ? `${res} Debate` : "Amendments";
    case "amend": return c.amend?.stage === "read" ? "Amendment Read" : c.amend?.stage === "ask" ? "Vote on Whether to Debate" : c.amend?.stage === "debate" ? (c.tr ? "Amendment Moderated Caucus" : "Amendment Debate") : "Vote on the Amendment";
    case "closing": return c.tr ? "Closing" : "Closing Speeches";
    case "vote": return "Roll Call Vote";
    case "statements": return "Opening Statements";
    case "general": return "Choosing a Resolution";
    case "ended": return "Ended";
    default: return "Result";
  }
}

/* Trinity Grammar MUN */

// A resolution needs more For than Against. Abstentions count for neither. A draft's result is kept on the draft.
function finishTrinityVote(c: Chamber, n: { yes: number; no: number; abstain: number }): Chamber {
  const t = c.tr!;
  const cast = n.yes + n.no;
  const need = Math.floor(cast / 2) + 1;
  const passed = n.yes > n.no;
  const outcome: Outcome = { passed, yes: n.yes, no: n.no, abstain: n.abstain, needed: need };
  const docs = t.docs.map((d) => (d.id === t.current ? { ...d, result: (passed ? "passed" : "failed") as Doc["result"] } : d));
    return note({ ...c, step: "closed", outcome, tr: { ...t, docs } }, `${resNoun(c)} ${passed ? "approved" : "not approved"}: ${n.yes} for, ${n.no} against, ${n.abstain} abstaining`);
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
    ...c, step: "pick", roles: { proposer: d.proposer, seconder: d.seconder, opposer: null }, closers: [], debate: emptyDebate(), amendments: [], amend: null, result: null, ballots: {}, outcome: null,
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
    ...c, step: "general", after: null, roles: { proposer: null, seconder: null, opposer: null }, closers: [], debate: emptyDebate(), speech: null, amendments: [], amend: null, poll: null,
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
  const here = c.delegates.filter((d) => c.roll[d.id] === "present" || c.roll[d.id] === "voting");
  return (here.length ? here : c.delegates).filter((d) => !c.tr!.opened.includes(d.id) && !observing(c, d.id)).slice(0, n).map((d) => d.id);
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
export const motionsOpen = (c: Chamber) => !!c.tr && (c.step === "floor" || (c.step === "caucus" && c.tr.cauc?.kind !== "final") || (c.step === "amend" && c.amend?.stage === "debate"));

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
  return note({ ...c, tr: { ...t, motions: [...t.motions, motion] } }, `Motion: ${motionText(c, motion)}`);
}
export const waitingMotions = (c: Chamber) => c.tr?.motions.filter((m) => m.status === "waiting") ?? [];
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
  const yes = ruling ? ruling === "for" : passes(p);
  const overrule = ruling !== null && yes !== passes(p);
  const tail = `${p.yes} for, ${p.no} against, ${p.abstain} abstaining${overrule ? ", overruled" : ""}`;
  const result: Result = { title: p.title, kind: "motion", motion: id, passed: yes, yes: p.yes, no: p.no, abstain: p.abstain };
  const closed = setMotion({ ...c, poll: null, result }, id, yes ? "passed" : "failed");
  if (!yes) return note(closed, `Motion failed (${tail}): ${p.title}`);
  const done = applyMotion(closed, m);
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
/** A speech's clock waits while a state is heard. */
export function startReply(c: Chamber, by: string, to: string | null): Chamber {
  const t = c.tr;
  if (!t || t.reply || !has(c, by) || (to !== null && !has(c, to)) || by === to) return c;
  const stash = c.timer && c.speech ? pauseTimer(c, now()).timer : null;
  return note({ ...c, timer: timerFor("Right of reply", REPLY_SECS), tr: { ...t, reply: { by, to }, stash } }, `${nameOf(c, by)} claims a right of reply${to ? ` against ${nameOf(c, to)}` : ""}`);
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
