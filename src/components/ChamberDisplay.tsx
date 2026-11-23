"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "next/navigation";
import * as ch from "@/lib/chamber";
import { Mark, Wordmark } from "@/lib/brand";
import { flagCode } from "@/lib/flags";
import { isId, useChamber } from "@/lib/useChamber";
import { useAuth } from "./AuthProvider";
import { useNow } from "./Chambers";
import Flag from "./Flag";
import QrCode from "./QrCode";
import { useOfflineReady } from "./Offline";
import { supabase } from "@/lib/supabase";
import s from "./Chambers.module.css";

// What the room sees. Every screen is built the same way, top to bottom: a pill only when it says something the heading
// doesn't, a big heading in the serif, then the thing to look at (the time, the votes, the signatories or the roll). The
// display only reads the committee the console keeps and redraws when that changes.
const icon = (d: React.ReactNode) => <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>;
const Expand = () => icon(<path d="M6 2.5H2.5V6M10 2.5h3.5V6M6 13.5H2.5V10M10 13.5h3.5V10" />);
const Shrink = () => icon(<path d="M2.5 6H6V2.5M13.5 6H10V2.5M2.5 10H6v3.5M13.5 10H10v3.5" />);
const Back = () => icon(<path d="M13 8H3M7 4L3 8l4 4" />);
const SIDE = { for: "In Favour", against: "Against" } as const;

/* The display's ornaments, like the rules on a printed programme: a hairline ending in a small diamond either side of a
   pill, the timer or a label, and a dot, line, diamond, line, dot under every heading. Drawn in the line colour, the
   diamonds in a faded accent, so they sit behind whatever the room is reading. */
const Flank = ({ flip }: { flip?: boolean }) => (
  <svg className={s.dFlank} viewBox="0 0 130 12" aria-hidden="true" style={flip ? { transform: "scaleX(-1)" } : undefined}>
    <line x1="10" y1="6" x2="130" y2="6" />
    <path d="M6 1.5 10.5 6 6 10.5 1.5 6Z" />
  </svg>
);
const Divider = () => (
  <svg className={s.dDivider} viewBox="0 0 440 12" aria-hidden="true">
    <circle cx="4" cy="6" r="2.2" /><line x1="10" y1="6" x2="210" y2="6" /><path d="M220 0.5 225.5 6 220 11.5 214.5 6Z" /><line x1="230" y1="6" x2="430" y2="6" /><circle cx="436" cy="6" r="2.2" />
  </svg>
);
/** A label with a flank either side: Signatories, Up next for the closing vote. */
const Flanked = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={`${s.dFlanked} ${className ?? ""}`}><Flank /><span>{children}</span><Flank flip /></div>
);

// A long heading (an amendment's own words, say) steps down in size so it always fits the screen.
// A heading with nothing else on the screen is bigger still.
const fit = (text: string, solo: boolean) => {
  const n = text.length;
  if (solo && n <= 14) return 1.45;
  if (solo && n <= 22) return 1.15;
  if (solo && n <= 30) return 0.92;
  return n <= 28 ? 1 : n <= 44 ? 0.78 : n <= 80 ? 0.58 : n <= 160 ? 0.44 : n <= 300 ? 0.34 : 0.28;
};

/** Pages of 15 states: the board follows the first state still to be marked, and once every one is marked it turns through the pages. */
const PER = 15;
function usePage(n: number, first: number) {
  const pages = Math.max(1, Math.ceil(n / PER));
  const [turn, setTurn] = useState(0);
  useEffect(() => {
    if (pages < 2 || first !== -1) return;
    const t = setInterval(() => setTurn((x) => (x + 1) % pages), 6000);
    return () => clearInterval(t);
  }, [pages, first]);
  return { pages, at: pages < 2 ? 0 : first !== -1 ? Math.floor(first / PER) : turn % pages };
}
const Pages = ({ at, pages }: { at: number; pages: number }) => (pages > 1 ? <p className={s.dPages} aria-live="polite">{at + 1} / {pages}</p> : null);
/** A state's name on a tile: its flag first (a dot where it has none), the short form of the name where there is one, the full name on hover, and an ellipsis if it is still too long. */
const Seat = ({ name }: { name: string }) => <>{flagCode(name) ? <Flag name={name} size={22} /> : <i />}<span className={s.dSeatName} title={name}>{ch.shortName(name)}</span></>;
/** How a state was marked, short enough for a tile: the tallies above spell the letters out. */
const ATTEND_SHORT: Record<ch.Attend, string> = { voting: "P & V", present: "P", absent: "A" };

/** The roll call as pages of 15 states. */
function RollBoard({ c, tag }: { c: ch.Chamber; tag: (id: string) => React.ReactNode }) {
  const { at, pages } = usePage(c.delegates.length, c.delegates.findIndex((d) => !c.roll[d.id]));
  return (
    <>
      <div className={s.dBoard}>
        {c.delegates.slice(at * PER, (at + 1) * PER).map((d) => <div key={d.id} className={s.dSeat} data-a={c.roll[d.id]}><Seat name={d.name} />{tag(d.id) ?? (c.roll[d.id] && <em title={ch.ATTEND_LABEL[c.roll[d.id]]}>{ATTEND_SHORT[c.roll[d.id]]}</em>)}</div>)}
      </div>
      <Pages at={at} pages={pages} />
    </>
  );
}
/** The vote as pages of 15 states present, each ballot in words as well as colour. */
const BALLOT_WORD: Record<ch.Ballot, string> = { for: "For", against: "Against", abstain: "Abstain" };
function VoteBoard({ c, tag }: { c: ch.Chamber; tag: (id: string) => React.ReactNode }) {
  const here = c.delegates.filter((d) => ch.isHere(c, d.id));
  const { at, pages } = usePage(here.length, c.step === "vote" ? here.findIndex((d) => !c.ballots[d.id]) : -1);
  return (
    <>
      <div className={s.dBoard}>
        {here.slice(at * PER, (at + 1) * PER).map((d) => {
          const b = c.ballots[d.id];
          return <div key={d.id} className={s.dSeat} data-b={b}><Seat name={d.name} />{tag(d.id) ?? (b && <em>{c.tr && b === "abstain" ? "Neutral" : BALLOT_WORD[b]}</em>)}</div>;
        })}
      </div>
      <Pages at={at} pages={pages} />
    </>
  );
}

/** The code to join from a device, with a QR code, while the chair shows it. Only a chair's browser can read the code. */
function JoinCode({ cid }: { cid: string }) {
  const [code, setCode] = useState<string | null>(null);
  useEffect(() => {
    if (!supabase) return;
    let live = true;
    const get = async () => {
      const { data } = await supabase!.rpc("room_chair", { cid });
      if (live) setCode((data as { code?: string | null } | null)?.code ?? null);
    };
    void get();
    const t = setInterval(get, 30_000); // a new code made in the console shows here within half a minute
    return () => { live = false; clearInterval(t); };
  }, [cid]);
  if (!code) return null;
  const url = `${location.origin}/chambers/room?join=${code}`;
  return (
    <div className={s.dJoin}>
      <QrCode value={url} size={112} label={`QR code to join with the code ${code}`} />
      <span>Join on your device<b>{code}</b>{location.host}/chambers/room</span>
    </div>
  );
}

/** One screen: an optional pill, a heading, optional lines of text, and whatever there is to look at. The rule under the
 *  heading is drawn only when something follows it (a line, the time, the roll, the speakers), and never over a vote's figures. */
function Screen({ pill, side, heading, k, pass, lines, foot, plain, children }: {
  pill?: (string | false | null | undefined)[]; side?: ch.Side; heading?: string; k?: number; pass?: boolean; lines?: (React.ReactNode | false | null | undefined)[]; foot?: React.ReactNode; plain?: boolean; children?: React.ReactNode;
}) {
  const text = (pill ?? []).filter(Boolean).join(" · ");
  const rows = (lines ?? []).filter(Boolean);
  const rule = !plain && (rows.length > 0 || !!children);
  return (
    <>
      {text && <Flanked><span className={s.dPill} data-side={side}>{text}</span></Flanked>}
      {heading && <h1 className={`serif ${s.dH}`} data-pass={pass} style={{ "--k": k ?? fit(heading, !children) } as React.CSSProperties}><Flag name={heading} em />{heading}</h1>}
      {heading && rule && <Divider />}
      {rows.length > 0 && <div className={s.dLines}>{rows.map((r, i) => <p key={i} className={s.dSub}>{r}</p>)}</div>}
      {children}
      {foot && <div className={s.dFoot}>{foot}</div>}
    </>
  );
}

/* The display's sounds, when the chair turns them on in Settings (off by default): a chime when a speech reaches 0:00
   and again 10 seconds over, and a softer tone 10 seconds before the end. Played with the browser's own audio, so a
   muted tab stays silent. Browsers only allow sound after a click on the page, so until then a button asks for one. */
// A second display tab open in the same browser plays each tone only once between them: the first tab to reach a mark
// notes it here, and the other stays quiet for that mark.
function first(mark: string): boolean {
  try {
    const k = "collex-chime";
    const [was, at] = (localStorage.getItem(k) ?? "").split("@");
    if (was === mark && Date.now() - Number(at) < 5000) return false;
    localStorage.setItem(k, `${mark}@${Date.now()}`);
  } catch { /* no storage: just play it */ }
  return true;
}
function useChime(c: ch.Chamber | null, now: number) {
  const ctx = useRef<AudioContext | null>(null);
  const last = useRef<{ key: string; rem: number } | null>(null);
  const [ready, setReady] = useState(false);
  const want = !!(c?.chime?.end || c?.chime?.warn);
  const make = () => {
    if (ctx.current || typeof window === "undefined") return ctx.current;
    const A = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!A) return null;
    const a = new A();
    a.onstatechange = () => setReady(a.state === "running");
    setReady(a.state === "running");
    ctx.current = a;
    return a;
  };
  useEffect(() => { if (want) make(); }, [want]);
  useEffect(() => () => { void ctx.current?.close(); }, []);
  const tone = (freq: number, at: number, len: number, vol: number) => {
    const a = ctx.current;
    if (!a || a.state !== "running") return;
    const o = a.createOscillator();
    const g = a.createGain();
    const t0 = a.currentTime + at;
    o.type = "sine";
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + len);
    o.connect(g).connect(a.destination);
    o.start(t0);
    o.stop(t0 + len + 0.05);
  };
  // Each speech's clock is followed on its own; a tone plays when the time left crosses a mark while it runs.
  const sp = c?.speech;
  const timer = c?.timer ?? null;
  const key = sp && sp.phase === "speech" && timer ? `${sp.who}|${sp.role}|${timer.label}|${timer.total}` : "";
  const rem = timer ? ch.remaining(timer, now) - ch.overtime(timer, now) : 0;
  useEffect(() => {
    const prev = last.current;
    last.current = key ? { key, rem } : null;
    if (!key || !prev || prev.key !== key || !want || rem >= prev.rem) return;
    const crossed = (mark: number) => prev.rem > mark && rem <= mark;
    if (c?.chime?.warn && crossed(10_000) && first(`${key}|warn`)) tone(660, 0, 0.35, 0.18);
    if (c?.chime?.end && (crossed(0) || crossed(-10_000)) && first(`${key}|${crossed(0) ? "end" : "over"}`)) { tone(880, 0, 0.6, 0.3); tone(660, 0.28, 0.8, 0.3); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, rem]);
  // Browsers only play sound after a click or key on the page: the first one on the display, wherever it lands, turns the sound on.
  useEffect(() => {
    if (!want || ready) return;
    const on = () => { void make()?.resume(); };
    document.addEventListener("pointerdown", on);
    document.addEventListener("keydown", on);
    return () => { document.removeEventListener("pointerdown", on); document.removeEventListener("keydown", on); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [want, ready]);
}

export default function ChamberDisplay() {
  const q = useSearchParams().get("c");
  const cloudId = isId(q) ? q : null;
  const { ready: authReady, session } = useAuth();
  const { c, status } = useChamber(cloudId, { signedIn: !!session, authReady, readOnly: true });
  const [full, setFull] = useState(false);
  useOfflineReady(); // keeps the display's own scripts, so it opens again without wifi
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    const onFull = () => setFull(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFull);
    return () => document.removeEventListener("fullscreenchange", onFull);
  }, []);

  const now = useNow(ch.running(c?.timer ?? null) || ch.running(c?.tr?.cauc?.clock ?? null) || (!!c?.tr && Object.keys(c.tr.observers).length > 0));
  const left = c?.timer ? ch.remaining(c.timer, now) : 0;
  const state = !c?.timer ? "none" : left === 0 ? "up" : c.timer.endsAt === null ? "paused" : left <= 10_000 ? "low" : "running";
  useChime(c ?? null, now);

  if (!mounted) return null; // the saved committee is only known in the browser

  const open = c ? ch.rooms(c) : null;
  const openNow = open ? (open.labels ?? [
    open.negotiation && open.notes ? "Negotiation Chamber and Notes Open" : open.negotiation ? "Negotiation Chamber Open" : open.notes && "Notes Open",
    open.amendments && "Amendments Open", open.speakers && "Speakers\u2019 List Open",
  ]).filter(Boolean).join(" \u00B7 ") : "";
  const fullLabel = full ? "Exit Full Screen" : "Full Screen";
  const tools = (
    <div className={s.dTools}>
      <div className={s.dToolRow}>
        <button type="button" className={s.dBtn} onClick={() => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.())}>{full ? <Shrink /> : <Expand />}{fullLabel}</button>
        <Link href={cloudId ? `/chambers?c=${cloudId}` : "/chambers"} className={s.dBtn}><Back />Console</Link>
      </div>
      <span className={`${s.dBtn} ${s.dBrand}`}><Mark size={16} /><Wordmark height={13} /></span>
    </div>
  );

  const name = (id: string | null) => (c ? ch.nameOf(c, id) : "");
  const amendment = c?.amend ? c.amendments.find((a) => a.id === c.amend!.id) : undefined;
  const subA = c?.amend?.sub ? c.amendments.find((a) => a.id === c.amend!.sub!.id) : undefined;
  const timerView = () => c?.timer && (
    <>
      <div className={s.dTime} data-state={state} data-over={ch.overtime(c.timer, now) > 0 || undefined} role="timer">{ch.timerText(c.timer, now)}</div>
      <div className={s.dTrack} data-state={state} aria-hidden="true"><i style={{ width: `${Math.min(100, (left / c.timer.total) * 100)}%` }} /></div>
    </>
  );
  // The figures, with a hairline and a diamond between each pair.
  const tallies = (labels: [string, number][]) => (
    <div className={s.dTallies}>
      {labels.map(([label, n], i) => (
        <div key={label} className={s.dTally}>
          {i > 0 && <i className={s.dTallySep} aria-hidden="true" />}
          <b>{n}</b><span>{label}</span>
        </div>
      ))}
    </div>
  );
  // The states that signed an amendment, as a row of tiles under a small label.
  const signatories = (a?: ch.Amendment) => a && a.backers.length > 0 && (
    <div className={s.dSigs}>
      <Flanked className={s.dCaps}>Signatories</Flanked>
      <ul>{a.backers.map((id) => <li key={id}>{name(id)}</li>)}</ul>
    </div>
  );
  const amendPill = (a: ch.Amendment) => ["Amendment", a.how && { strike: "Strike", amend: "Amend", add: "Add" }[a.how], a.clause, `from ${name(a.by)}`];
  const votes = (r: { yes: number; no: number; abstain: number }, neutral = false) => tallies([["For", r.yes], ["Against", r.no], [neutral ? "Neutral" : "Abstain", r.abstain]]);
  const motionOf = (id?: string) => (c && id ? c.tr?.motions.find((m) => m.id === id) : undefined);
  const k = c?.tr?.cauc ?? null;
  const kLeft = k?.clock ? ch.remaining(k.clock, now) : 0;
  const doc = c ? ch.currentDoc(c) : undefined;
  const obsTag = (id: string) => (c && ch.observing(c, id, now) ? <em>Observer</em> : null);
  const sideOf = (sp: ch.Speech) => (c && c.tr && !ch.sided(c) && (sp.role === "speaker" || sp.role === "statement") && !sp.stance ? undefined : sp.side);

  let mid: React.ReactNode;
  if (!c) {
    mid = status === "signin" ? (
      <Screen heading="Log in to See This Committee"><Link href="/login" className={s.dBtn}>Log In</Link></Screen>
    ) : status === "denied" ? (
      <Screen heading="This Committee Isn't Shared with You" lines={["Ask the person who runs it to add the email on your Collex account."]} />
    ) : status === "loading" || cloudId ? null : (
      <Screen heading="Nothing to Show Yet" lines={["Open a committee in the console, then keep this window open beside it."]} />
    );
  } else if (c.tr?.reply) {
    const r = c.tr.reply;
    mid = <Screen pill={["Right of reply"]} heading={name(r.by)} lines={[r.to ? `Against ${name(r.to)}` : null]}>{timerView()}</Screen>;
  } else if (c.speech) {
    const sp = c.speech;
    const kLine = c.tr && k?.kind === "mod" && c.step === "caucus" ? `${k.topic} \u00B7 ${ch.clock(kLeft)} left` : c.tr && c.step === "amend" && k?.clock ? `Caucus ${ch.clock(kLeft)} left` : null;
    const points = ch.takingPoints(sp);
    const taken = sp.pois > 0 ? `${sp.pois} ${sp.pois === 1 ? "Point" : "Points"} of Information taken` : null;
    mid = sp.phase === "ask" ? (
      <Screen pill={["Point of Information", `for ${name(sp.who)}`]} heading={name(sp.asker)}>{timerView()}</Screen>
    ) : sp.phase === "answer" ? (
      <Screen pill={["Reply", `to ${name(sp.asker)}`]} heading={name(sp.who)}>{timerView()}</Screen>
    ) : sp.phase === "after" && points ? (
      <Screen pill={["Points of Information"]} heading={name(sp.who)} lines={[taken ?? "Raise your placard to ask"]} />
    ) : (
      <Screen pill={[ch.roleName(c, sp.role), sideOf(sp) && SIDE[sp.side]]} side={sideOf(sp)} heading={name(sp.who)}
        lines={[sp.phase === "after" ? "How do you yield?" : null, kLine]}>
        {sp.phase === "speech" && timerView()}
      </Screen>
    );
  } else if (c.explain?.who) {
    const e = c.explain.who;
    mid = <Screen pill={["Explanation of Vote", e.side === "for" ? "Yes with Rights" : "No with Rights"]} side={e.side} heading={name(e.id)}>{timerView()}</Screen>;
  } else if (c.step === "welcome") {
    // "Welcome to" small and slanted over the committee's name, which is as big as it can be.
    const n = c.name.length;
    const k = n <= 6 ? 2.0 : n <= 10 ? 1.7 : n <= 16 ? 1.3 : n <= 24 ? 1 : n <= 40 ? 0.7 : 0.5;
    mid = (
      <>
        <h1 className={`serif ${s.dWelcome} ${s.dWelcomeTo}`} style={{ "--k": k } as React.CSSProperties}>
          <span>Welcome to</span>
          <b>{c.name}</b>
        </h1>
        <Divider />
      </>
    );
  } else if (c.step === "pick") {
    mid = (
      <Screen heading={c.tr && doc ? doc.title : "Choosing the Speakers"} pill={c.tr ? [ch.resNoun(c).replace("resolution", "Resolution")] : undefined}>
        <div className={s.dRoles}>
          {([["proposer", "Proposer"], ["seconder", c.tr ? ch.roleName(c, "seconder") : "Seconder"], ["opposer", "Opposer"]] as const).map(([k, label]) => (
            <div key={k} className={s.dRole}><span>{label}</span><b data-empty={!c.roles[k]}>{c.roles[k] ? name(c.roles[k]) : k === "opposer" ? "None" : "\u2014"}</b></div>
          ))}
        </div>
      </Screen>
    );
  } else if (c.step === "roll") {
    const n = ch.rollCount(c);
    mid = (
      <Screen heading="Roll Call">
        {tallies([["Present & Voting (P & V)", n.voting], ["Present (P)", n.present], ["Absent (A)", n.absent]])}
        <RollBoard c={c} tag={obsTag} />
      </Screen>
    );
  } else if (c.poll?.kind === "motion") {
    const m = motionOf(c.poll.motion);
    mid = <Screen pill={m ? ch.motionPill(c, m) : ["Motion"]} heading={m ? ch.motionDetail(c, m) || ch.MOTION_LABEL[m.kind] : c.poll.title} plain>{votes(c.poll)}</Screen>;
  } else if (c.step === "statements") {
    const next3 = ch.upcomingStatements(c, 3);
    mid = (
      <Screen heading="Opening Statements" foot={next3.length > 0 && <div className={s.dSigs}><Flanked className={s.dCaps}>Up next</Flanked><ul>{next3.map((id) => <li key={id}>{name(id)}</li>)}</ul></div>} />
    );
  } else if (c.step === "general") {
    const m = c.result?.kind === "motion" ? motionOf(c.result.motion) : undefined;
    mid = c.result?.kind === "motion"
      ? <Screen pill={m ? ch.motionPill(c, m) : ["Motion"]} heading={c.result.passed ? "Motion Passes" : "Motion Fails"} pass={c.result.passed} lines={[m ? ch.motionDetail(c, m) : c.result.title]} plain>{votes(c.result)}</Screen>
      : c.style ? <Screen heading={"General Speakers\u2019 List"} lines={[ch.nextCandidate(c) ? `Next: ${name(ch.nextCandidate(c)!.id)}` : "The floor is open"]} />
      : <Screen heading="The Chair Is Choosing a Resolution" />;
  } else if (c.step === "caucus" && c.tr && k?.kind === "mod") {
    mid = (
      <Screen heading={k.topic}>
        <div className={s.dTime} data-state={kLeft === 0 ? "up" : ch.running(k.clock) ? "running" : "paused"} role="timer">{ch.clock(kLeft)}</div>
        <div className={s.dTrack} data-state={kLeft === 0 ? "up" : undefined} aria-hidden="true"><i style={{ width: `${k.clock ? Math.min(100, (kLeft / k.clock.total) * 100) : 0}%` }} /></div>
      </Screen>
    );
  } else if (c.step === "caucus") {
    mid = <Screen heading={k?.kind === "final" ? "Final Unmoderated Caucus" : c.tr ? "Unmoderated Caucus" : "Caucus"}>{timerView()}</Screen>;
  } else if (c.step === "amend" && amendment && subA) {
    const subPill = ["Amendment to the Amendment", `from ${name(subA.by)}`];
    mid = c.poll ? (
      <Screen pill={subPill} heading="Adopt This Amendment to the Amendment?" plain>{votes(c.poll)}</Screen>
    ) : (
      <Screen pill={subPill} heading={`\u201C${subA.text}\u201D`} lines={[`Instead of: \u201C${amendment.text}\u201D`]} />
    );
  } else if (c.step === "amend" && amendment) {
    const stage = c.amend?.stage;
    const r = c.result && c.result.amendment === amendment.id && c.result.kind === "debate" ? c.result : null;
    // The ruling on whether to debate stays up until the next vote begins (when it failed, that is the vote to adopt, with no votes yet).
    const ruling = r && (stage === "debate" || (stage === "vote" && c.poll && c.poll.yes + c.poll.no + c.poll.abstain === 0)) ? r : null;
    mid = ruling ? (
      <Screen pill={amendPill(amendment)} heading={ruling.passed ? "Debate Approved" : "Debate Not Approved"} pass={ruling.passed} foot={signatories(amendment)} plain>
        {votes(ruling)}
      </Screen>
    ) : c.poll ? (
      <Screen pill={amendPill(amendment)} heading={stage === "ask" ? "Debate This Amendment?" : "Adopt This Amendment?"} foot={signatories(amendment)} plain>
        {votes(c.poll)}
      </Screen>
    ) : (
      <Screen pill={amendPill(amendment)} heading={`\u201C${amendment.text}\u201D`} foot={signatories(amendment)} />
    );
  } else if (c.step === "vote" || c.step === "closed") {
    // The vote and its result are laid out alike, the heading at one size and one line kept for a note, so the states on
    // the board stay in the same place from the first ballot to the result, and on every page.
    const n = ch.count(c);
    const o = c.step === "closed" ? c.outcome : null;
    const noun = c.tr ? ch.resNoun(c).replace("resolution", "Resolution") : "Resolution";
    const struck = o ? (o.struck?.length ? `Struck: ${o.struck.join("; ")}` : null)
      : ch.divisionPart(c) === null && c.divide?.parts.some((x) => x.result === "failed") ? `Struck: ${c.divide.parts.filter((x) => x.result === "failed").map((x) => x.label).join("; ")}` : null;
    const note = o ? struck : ch.partText(c) ?? struck;
    mid = (
      <Screen heading={o ? (o.passed ? `${noun} Passes` : `${noun} Does Not Pass`) : "Roll Call Vote"} k={Math.min(fit(`${noun} Does Not Pass`, false), 0.7)} pass={o ? o.passed : undefined}
        pill={c.tr && doc ? [doc.title] : undefined} plain>
        {votes(o ?? n, !!c.tr)}
        <p className={`${s.dSub} ${s.dNote1}`} title={note ?? undefined}>{note ?? "\u00A0"}</p>
        <VoteBoard c={c} tag={obsTag} />
      </Screen>
    );
  } else if (c.step === "ended") {
    mid = <Screen heading="Thank You" lines={[`${c.name} has ended`]} />;
  } else if (c.step === "closing") {
    const todo = ch.closingRoles(c).filter((r) => !c.closers.includes(r.id));
    const shown = c.tr ? todo.slice(0, 1) : todo; // Trinity: one at a time, in order
    // With no opposer the third place still shows, as None, so the room sees there is no one to speak against.
    const none = !c.tr && shown.length > 0 && !c.roles.opposer;
    mid = (
      <Screen pill={[c.tr ? "Closing" : "Closing Speeches"]} heading={shown.length ? [...shown.map((r) => name(r.id)), ...(none ? ["None"] : [])].join(" \u00B7 ") : "The Vote Is Next"}
        lines={[shown.length ? [...shown.map((r) => ch.roleName(c, r.role)), ...(none ? ["Opposer"] : [])].join(" \u00B7 ") : null]} />
    );
  } else if (c.step === "floor" && c.result?.kind === "amendment" && c.amendments.some((a) => a.id === c.result?.amendment)) {
    const a = c.amendments.find((x) => x.id === c.result!.amendment)!;
    mid = (
      <Screen pill={amendPill(a)} heading={c.result.passed ? "This Amendment Passes" : "This Amendment Fails"} pass={c.result.passed} foot={signatories(a)} plain>
        {votes(c.result)}
      </Screen>
    );
  } else {
    const who = c.step === "proposer" ? c.roles.proposer : c.step === "seconder" ? c.roles.seconder : c.step === "opposer" ? c.roles.opposer : null;
    const role = c.step === "proposer" ? "Proposer" : c.step === "seconder" ? (c.tr ? ch.roleName(c, "seconder") : "Seconder") : "Opposer";
    mid = who
      ? <Screen pill={[role, c.step === "opposer" ? SIDE.against : SIDE.for]} side={c.step === "opposer" ? "against" : "for"} heading={name(who)} />
      : c.tr
        ? (c.result?.kind === "motion"
          ? <Screen pill={motionOf(c.result.motion) ? ch.motionPill(c, motionOf(c.result.motion)!) : ["Motion"]} heading={c.result.passed ? "Motion Passes" : "Motion Fails"} pass={c.result.passed} lines={[motionOf(c.result.motion) ? ch.motionDetail(c, motionOf(c.result.motion)!) : c.result.title]} plain>{votes(c.result)}</Screen>
          : <Screen heading={`${ch.resNoun(c).replace("resolution", "Resolution")} Debate`} lines={[doc?.title]} />)
        : (() => { // Evatt: the speakers' list on the resolution comes first; amendments only when no one is listed
          const up = ch.nextCandidate(c);
          if (up) return <Screen pill={["Speakers\u2019 List", SIDE[up.side]]} side={up.side} heading={name(up.id)} lines={["Next to speak"]} />;
          if (c.amendments.some((a) => a.status === "waiting")) return <Screen heading="Amendments" lines={["Send amendments to the chair's desk"]} />;
          return <Screen heading={"Speakers\u2019 List"} lines={["Raise your placard to be added", "Send amendments to the chair's desk"]} />;
        })();
  }

  const listed = !!c && ch.listOpen(c);
  const first = c && listed ? ch.nextCandidate(c) : null;
  const rest = c && listed ? c.debate.list.slice(0, 4) : [];
  const ordered = first ? [first, ...rest.filter((x) => x.id !== first.id)] : rest;
  const photo = c?.background ? ({ "--photo": `url("${c.background}")`, "--bgw": `${100 - c.backgroundStrength}%`, "--photo-pos": c.backgroundAt ? `${c.backgroundAt[0]}% ${c.backgroundAt[1]}%` : "center" } as React.CSSProperties) : undefined;
  const body = (
    <div className={s.display} data-photo={photo ? "" : undefined} style={photo}>
      <div className={s.dTop}>
        <div className={s.dId}>
          <span className={`${s.dBtn} ${s.dBig}`}>{c?.name ?? "Committees"}</span>
        </div>
        {openNow ? <span className={`${s.dBtn} ${s.dStatus}`} role="status">{openNow}</span> : <span className={s.dGap} />}
        {tools}
      </div>
      <main id="top" className={s.dMid} data-board={(!!c && !c.speech && !c.tr?.reply && !c.explain?.who && (c.step === "roll" || c.step === "vote" || c.step === "closed")) || undefined}>{mid}</main>
      <div className={s.dBottom}>
        <div className={s.dNext}>
          {c && ordered.length > 0 && (
            <>
              <span className={s.dCaps}>Up next</span>
              <ol>{ordered.map((x) => <li key={x.id} data-side={c && (ch.sided(c) || x.stance) ? x.side : undefined} data-plain={(c && !ch.sided(c) && !x.stance) || undefined}><i /><Flag name={name(x.id)} em /><span className={s.dNextName} title={name(x.id)}>{ch.shortName(name(x.id))}</span></li>)}</ol>
            </>
          )}
        </div>
        {c?.showJoin && cloudId && <JoinCode cid={cloudId} />}
      </div>
    </div>
  );
  // Over the site's own header and footer, which this window has no use for.
  return createPortal(body, document.body);
}
