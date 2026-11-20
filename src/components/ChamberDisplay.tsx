"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "next/navigation";
import * as ch from "@/lib/chamber";
import { Mark, Wordmark } from "@/lib/brand";
import { isId, useChamber } from "@/lib/useChamber";
import { useAuth } from "./AuthProvider";
import { useNow } from "./Chambers";
import Flag from "./Flag";
import s from "./Chambers.module.css";

// What the room sees. Every screen is built the same way, top to bottom: a pill only when it says something the heading
// doesn't, a big heading in the serif, then the thing to look at (the time, the votes, the signatories or the roll). The
// display only reads the committee the console keeps and redraws when that changes.
const icon = (d: React.ReactNode) => <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>;
const Expand = () => icon(<path d="M6 2.5H2.5V6M10 2.5h3.5V6M6 13.5H2.5V10M10 13.5h3.5V10" />);
const Shrink = () => icon(<path d="M2.5 6H6V2.5M13.5 6H10V2.5M2.5 10H6v3.5M13.5 10H10v3.5" />);
const Back = () => icon(<path d="M13 8H3M7 4L3 8l4 4" />);
const SIDE = { for: "In Favour", against: "Against" } as const;

// A long heading (an amendment's own words, say) steps down in size so it always fits the screen.
// A heading with nothing else on the screen is bigger still.
const fit = (text: string, solo: boolean) => {
  const n = text.length;
  if (solo && n <= 14) return 1.45;
  if (solo && n <= 22) return 1.15;
  if (solo && n <= 30) return 0.92;
  return n <= 28 ? 1 : n <= 44 ? 0.78 : n <= 80 ? 0.58 : n <= 160 ? 0.44 : n <= 300 ? 0.34 : 0.28;
};

/** One screen: an optional pill, a heading, optional lines of text, and whatever there is to look at. */
/** A long title is set like the welcome: its first words small and slanted over the rest, which stays big. */
const leadAndBig = (text: string): [string, string] => {
  const w = text.trim().split(/\s+/);
  if (w.length < 4 || text.length < 22) return ["", text];
  const k = Math.floor(w.length / 2);
  return [w.slice(0, k).join(" "), w.slice(k).join(" ")];
};

/** The roll call as pages of 20 states: it follows the states being marked, and once every one is marked it turns through the pages. */
function RollBoard({ c, tag }: { c: ch.Chamber; tag: (id: string) => React.ReactNode }) {
  const PER = 20;
  const pages = Math.max(1, Math.ceil(c.delegates.length / PER));
  const first = c.delegates.findIndex((d) => !c.roll[d.id]);
  const [turn, setTurn] = useState(0);
  useEffect(() => {
    if (pages < 2 || first !== -1) return;
    const t = setInterval(() => setTurn((x) => (x + 1) % pages), 6000);
    return () => clearInterval(t);
  }, [pages, first]);
  const at = pages < 2 ? 0 : first !== -1 ? Math.floor(first / PER) : turn % pages;
  return (
    <>
      <div className={s.dBoard}>
        {c.delegates.slice(at * PER, (at + 1) * PER).map((d) => <div key={d.id} className={s.dSeat} data-a={c.roll[d.id]}><i /><span className={s.dSeatName}>{d.name}</span>{tag(d.id) ?? (c.roll[d.id] && <em title={ch.ATTEND_LABEL[c.roll[d.id]]}>{c.roll[d.id] === "voting" ? "P & V" : ch.ATTEND_LABEL[c.roll[d.id]]}</em>)}</div>)}
      </div>
      {pages > 1 && <p className={s.dPages} aria-live="polite">{at + 1} / {pages}</p>}
    </>
  );
}

function Screen({ pill, side, heading, pass, lines, foot, children }: {
  pill?: (string | false | null | undefined)[]; side?: ch.Side; heading?: string; pass?: boolean; lines?: (React.ReactNode | false | null | undefined)[]; foot?: React.ReactNode; children?: React.ReactNode;
}) {
  const text = (pill ?? []).filter(Boolean).join(" · ");
  const [lead, big] = leadAndBig(heading ?? "");
  const rows = (lines ?? []).filter(Boolean);
  return (
    <>
      {text && <span className={s.dPill} data-side={side}>{text}</span>}
      {heading && (lead
        ? <h1 className={`serif ${s.dWelcome}`} data-pass={pass} style={{ "--k": fit(big, !children) } as React.CSSProperties}><span>{lead}</span><b>{big}</b></h1>
        : <h1 className={`serif ${s.dH}`} data-pass={pass} style={{ "--k": fit(heading, !children) } as React.CSSProperties}><Flag name={heading} em />{heading}</h1>)}
      {rows.length > 0 && <div className={s.dLines}>{rows.map((r, i) => <p key={i} className={s.dSub}>{r}</p>)}</div>}
      {children}
      {foot && <div className={s.dFoot}>{foot}</div>}
    </>
  );
}

export default function ChamberDisplay() {
  const q = useSearchParams().get("c");
  const cloudId = isId(q) ? q : null;
  const { ready: authReady, session } = useAuth();
  const { c, status } = useChamber(cloudId, { signedIn: !!session, authReady, readOnly: true });
  const [full, setFull] = useState(false);
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

  if (!mounted) return null; // the saved committee is only known in the browser

  const open = c ? ch.rooms(c) : null;
  const openNow = open ? (open.labels ?? [
    open.negotiation && open.notes ? "Negotiation Chamber and Notes Open" : open.negotiation ? "Negotiation Chamber Open" : open.notes && "Notes Open",
    open.amendments && "Amendments Open", open.speakers && "Speakers\u2019 List Open",
  ]).filter(Boolean).join(" \u00B7 ") : "";
  const tools = (
    <div className={s.dTools}>
      <div className={s.dToolRow}>
        <button type="button" className={s.dBtn} onClick={() => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.())}>{full ? <Shrink /> : <Expand />}{full ? "Exit full screen" : "Full screen"}</button>
        <Link href={cloudId ? `/chambers?c=${cloudId}` : "/chambers"} className={s.dBtn}><Back />Console</Link>
      </div>
      <span className={`${s.dBtn} ${s.dBrand}`}>Powered by <Mark size={17} /><Wordmark height={13} /></span>
    </div>
  );

  const name = (id: string | null) => (c ? ch.nameOf(c, id) : "");
  const amendment = c?.amend ? c.amendments.find((a) => a.id === c.amend!.id) : undefined;
  const timerView = () => c?.timer && (
    <>
      <div className={s.dTime} data-state={state} role="timer">{ch.clock(left)}</div>
      <div className={s.dTrack} aria-hidden="true"><i style={{ width: `${Math.min(100, (left / c.timer.total) * 100)}%` }} /></div>
    </>
  );
  const tallies = (labels: [string, number][]) => (
    <div className={s.dTallies}>
      {labels.map(([label, n]) => <div key={label} className={s.dTally}><span>{label}</span><b>{n}</b></div>)}
    </div>
  );
  // The states that signed an amendment, as a row of tiles under a small label.
  const signatories = (a?: ch.Amendment) => a && a.backers.length > 0 && (
    <div className={s.dSigs}>
      <span>Signatories</span>
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
      <Screen heading="Log in to See This Committee"><Link href="/login" className={s.dBtn}>Log in</Link></Screen>
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
        lines={[sp.phase === "after" ? "How do you yield?" : c.step === "amend" && amendment ? amendment.text : null, kLine]}>
        {sp.phase === "speech" && timerView()}
      </Screen>
    );
  } else if (c.step === "welcome") {
    // "Welcome to" small and slanted over the committee's name, which is as big as it can be.
    const n = c.name.length;
    const k = n <= 6 ? 2.0 : n <= 10 ? 1.7 : n <= 16 ? 1.3 : n <= 24 ? 1 : n <= 40 ? 0.7 : 0.5;
    mid = (
      <>
        <h1 className={`serif ${s.dWelcome}`} style={{ "--k": k } as React.CSSProperties}>
          <span>Welcome to</span>
          <b>{c.name}</b>
        </h1>
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
        {tallies([["Present & Voting", n.voting], ["Present", n.present], ["Absent", n.absent]])}
        <RollBoard c={c} tag={obsTag} />
      </Screen>
    );
  } else if (c.poll?.kind === "motion") {
    const m = motionOf(c.poll.motion);
    mid = <Screen pill={m ? ch.motionPill(c, m) : ["Motion"]} heading={m ? ch.motionDetail(c, m) || ch.MOTION_LABEL[m.kind] : c.poll.title}>{votes(c.poll)}</Screen>;
  } else if (c.step === "statements") {
    const next3 = ch.upcomingStatements(c, 3);
    mid = (
      <Screen heading="Opening Statements" foot={next3.length > 0 && <div className={s.dSigs}><span>Up next</span><ul>{next3.map((id) => <li key={id}>{name(id)}</li>)}</ul></div>} />
    );
  } else if (c.step === "general") {
    const m = c.result?.kind === "motion" ? motionOf(c.result.motion) : undefined;
    mid = c.result?.kind === "motion"
      ? <Screen pill={m ? ch.motionPill(c, m) : ["Motion"]} heading={c.result.passed ? "Motion Passes" : "Motion Fails"} pass={c.result.passed} lines={[m ? ch.motionDetail(c, m) : c.result.title]}>{votes(c.result)}</Screen>
      : c.style ? <Screen heading="General Speakers\u2019 List" lines={[ch.nextCandidate(c) ? `Next: ${name(ch.nextCandidate(c)!.id)}` : "The floor is open"]} />
      : <Screen heading="The Chair Is Choosing a Resolution" />;
  } else if (c.step === "caucus" && c.tr && k?.kind === "mod") {
    mid = (
      <Screen heading={k.topic}>
        <div className={s.dTime} data-state={kLeft === 0 ? "up" : ch.running(k.clock) ? "running" : "paused"} role="timer">{ch.clock(kLeft)}</div>
        <div className={s.dTrack} aria-hidden="true"><i style={{ width: `${k.clock ? Math.min(100, (kLeft / k.clock.total) * 100) : 0}%` }} /></div>
      </Screen>
    );
  } else if (c.step === "caucus") {
    mid = <Screen heading={k?.kind === "final" ? "Final Unmoderated Caucus" : c.tr ? "Unmoderated Caucus" : "Caucus"}>{timerView()}</Screen>;
  } else if (c.step === "amend" && amendment) {
    const stage = c.amend?.stage;
    const r = c.result && c.result.amendment === amendment.id && c.result.kind === "debate" ? c.result : null;
    // The ruling on whether to debate stays up until the next vote begins (when it failed, that is the vote to adopt, with no votes yet).
    const ruling = r && (stage === "debate" || (stage === "vote" && c.poll && c.poll.yes + c.poll.no + c.poll.abstain === 0)) ? r : null;
    mid = ruling ? (
      <Screen pill={amendPill(amendment)} heading={ruling.passed ? "Debate Approved" : "Debate Not Approved"} pass={ruling.passed} foot={signatories(amendment)}>
        {votes(ruling)}
      </Screen>
    ) : c.poll ? (
      <Screen pill={amendPill(amendment)} heading={stage === "ask" ? "Debate This Amendment?" : "Adopt This Amendment?"} foot={signatories(amendment)}>
        {votes(c.poll)}
      </Screen>
    ) : (
      <Screen pill={amendPill(amendment)} heading={`\u201C${amendment.text}\u201D`} foot={signatories(amendment)} />
    );
  } else if (c.step === "vote" || c.step === "closed") {
    const n = ch.count(c);
    const done = c.step === "closed" && c.outcome;
    const noun = c.tr ? ch.resNoun(c).replace("resolution", "Resolution") : "Resolution";
    mid = (
      <Screen heading={done ? (c.outcome!.passed ? `${noun} Approved` : `${noun} Not Approved`) : "Roll Call Vote"} pass={done ? c.outcome!.passed : undefined}
        pill={c.tr && doc ? [doc.title] : undefined}
        lines={done ? [`${c.outcome!.yes} For · ${c.outcome!.no} Against · ${c.outcome!.abstain} ${c.tr ? "Neutral" : "Abstaining"}${!c.outcome!.passed ? ` · ${c.outcome!.needed} needed` : ""}`] : []}>
        {c.step === "vote" && votes(n, !!c.tr)}
        <div className={s.dBoard}>
          {c.delegates.filter((d) => ch.isHere(c, d.id)).map((d) => <div key={d.id} className={s.dSeat} data-b={c.ballots[d.id]}><i /><span className={s.dSeatName}>{d.name}</span>{obsTag(d.id)}</div>)}
        </div>
      </Screen>
    );
  } else if (c.step === "ended") {
    mid = <Screen heading="Thank You" lines={[`${c.name} has ended`]} />;
  } else if (c.step === "closing") {
    const todo = ch.closingRoles(c).filter((r) => !c.closers.includes(r.id));
    const shown = c.tr ? todo.slice(0, 1) : todo; // Trinity: one at a time, in order
    mid = (
      <Screen pill={[c.tr ? "Closing" : "Closing speeches"]} heading={shown.length ? shown.map((r) => name(r.id)).join(" · ") : "The Vote Is Next"}
        lines={[shown.length ? shown.map((r) => ch.roleName(c, r.role)).join(" · ") : null]} />
    );
  } else if (c.step === "floor" && c.result?.kind === "amendment" && c.amendments.some((a) => a.id === c.result?.amendment)) {
    const a = c.amendments.find((x) => x.id === c.result!.amendment)!;
    mid = (
      <Screen pill={amendPill(a)} heading={c.result.passed ? "This Amendment Passes" : "This Amendment Fails"} pass={c.result.passed} foot={signatories(a)}>
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
          ? <Screen pill={motionOf(c.result.motion) ? ch.motionPill(c, motionOf(c.result.motion)!) : ["Motion"]} heading={c.result.passed ? "Motion Passes" : "Motion Fails"} pass={c.result.passed} lines={[motionOf(c.result.motion) ? ch.motionDetail(c, motionOf(c.result.motion)!) : c.result.title]}>{votes(c.result)}</Screen>
          : <Screen heading={`${ch.resNoun(c).replace("resolution", "Resolution")} Debate`} lines={[doc?.title]} />)
        : (() => { // Evatt: the speakers' list on the resolution comes first; amendments only when no one is listed
          const up = ch.nextCandidate(c);
          if (up) return <Screen pill={["Speakers\u2019 List", SIDE[up.side]]} side={up.side} heading={name(up.id)} lines={["Next to speak"]} />;
          if (c.amendments.some((a) => a.status === "waiting")) return <Screen heading="Amendments" lines={["Send amendments to the chair's desk"]} />;
          return <Screen heading="Speakers\u2019 List" lines={["Raise your placard to be added", "Send amendments to the chair's desk"]} />;
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
          <div className={`${s.dBtn} ${s.dBig}`}>
            <p className={`serif ${s.dName}`}>{c?.name ?? "Chambers"}</p>
            {c?.topic && <p className={s.dTopic}>{c.topic}</p>}
          </div>
        </div>
        {openNow ? <span className={`${s.dBtn} ${s.dStatus}`} role="status">{openNow}</span> : <span className={s.dGap} />}
        {tools}
      </div>
      <main id="top" className={s.dMid}>{mid}</main>
      <div className={s.dBottom}>
        <div className={s.dNext}>
          {c && ordered.length > 0 && (
            <>
              <span>Up next</span>
              <ol>{ordered.map((x) => <li key={x.id} data-side={c && (ch.sided(c) || x.stance) ? x.side : undefined} data-plain={(c && !ch.sided(c) && !x.stance) || undefined}><i /><Flag name={name(x.id)} em />{name(x.id)}{x.stance && <small>{SIDE[x.side]}</small>}</li>)}</ol>
            </>
          )}
        </div>
      </div>
    </div>
  );
  // Over the site's own header and footer, which this window has no use for.
  return createPortal(body, document.body);
}
