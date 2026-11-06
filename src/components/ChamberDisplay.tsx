"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "next/navigation";
import * as ch from "@/lib/chamber";
import { Wordmark } from "@/lib/brand";
import { isId, useChamber } from "@/lib/useChamber";
import { useAuth } from "./AuthProvider";
import { useNow } from "./Chambers";
import s from "./Chambers.module.css";

// What the room sees. Every screen is built the same way, top to bottom: a pill only when it says something the heading
// doesn't, a big heading in the serif, then the thing to look at (the time, the votes, the signatories or the roll). The
// display only reads the committee the console keeps and redraws when that changes.
const icon = (d: React.ReactNode) => <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>;
const Expand = () => icon(<path d="M6 2.5H2.5V6M10 2.5h3.5V6M6 13.5H2.5V10M10 13.5h3.5V10" />);
const Shrink = () => icon(<path d="M2.5 6H6V2.5M13.5 6H10V2.5M2.5 10H6v3.5M13.5 10H10v3.5" />);
const Back = () => icon(<path d="M13 8H3M7 4L3 8l4 4" />);
const SIDE = { for: "In favour", against: "Against" } as const;

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
function Screen({ pill, side, heading, pass, lines, children }: {
  pill?: (string | false | null | undefined)[]; side?: ch.Side; heading?: string; pass?: boolean; lines?: (React.ReactNode | false | null | undefined)[]; children?: React.ReactNode;
}) {
  const text = (pill ?? []).filter(Boolean).join(" · ");
  const rows = (lines ?? []).filter(Boolean);
  return (
    <>
      {text && <span className={s.dPill} data-side={side}>{text}</span>}
      {heading && <h1 className={`serif ${s.dH}`} data-pass={pass} style={{ "--k": fit(heading, !children) } as React.CSSProperties}>{heading}</h1>}
      {rows.length > 0 && <div className={s.dLines}>{rows.map((r, i) => <p key={i} className={s.dSub}>{r}</p>)}</div>}
      {children}
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

  const now = useNow(ch.running(c?.timer ?? null));
  const left = c?.timer ? ch.remaining(c.timer, now) : 0;
  const state = !c?.timer ? "none" : left === 0 ? "up" : c.timer.endsAt === null ? "paused" : left <= 10_000 ? "low" : "running";

  if (!mounted) return null; // the saved committee is only known in the browser

  const open = c ? ch.rooms(c) : null;
  const openNow = open ? [open.negotiation && "Negotiation Chamber open", open.amendments && "Amendments open", open.speakers && "Speakers\u2019 list open"].filter(Boolean).join(" \u00B7 ") : "";
  const tools = (
    <div className={s.dTools}>
      {openNow && <span className={`${s.dBtn} ${s.dStatus}`} role="status">{openNow}</span>}
      <button type="button" className={s.dBtn} onClick={() => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.())}>{full ? <Shrink /> : <Expand />}{full ? "Exit full screen" : "Full screen"}</button>
      <Link href={cloudId ? `/chambers?c=${cloudId}` : "/chambers"} className={s.dBtn}><Back />Console</Link>
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
  const amendPill = (a: ch.Amendment) => ["Amendment", a.clause, `from ${name(a.by)}`];
  const votes = (r: { yes: number; no: number; abstain: number }) => tallies([["For", r.yes], ["Against", r.no], ["Abstain", r.abstain]]);

  let mid: React.ReactNode;
  if (!c) {
    mid = status === "signin" ? (
      <Screen heading="Log in to see this committee"><Link href="/login" className={s.dBtn}>Log in</Link></Screen>
    ) : status === "denied" ? (
      <Screen heading="This committee isn't shared with you" lines={["Ask the person who runs it to add the email on your Collex account."]} />
    ) : status === "loading" || cloudId ? null : (
      <Screen heading="Nothing to show yet" lines={["Open a committee in the console, then keep this window open beside it."]} />
    );
  } else if (c.speech) {
    const sp = c.speech;
    mid = sp.phase === "ask" ? (
      <Screen pill={["Point of Information", `for ${name(sp.who)}`]} heading={name(sp.asker)}>{timerView()}</Screen>
    ) : sp.phase === "answer" ? (
      <Screen pill={["Reply", `to ${name(sp.asker)}`]} heading={name(sp.who)}>{timerView()}</Screen>
    ) : (
      <Screen pill={[ch.ROLE_LABEL[sp.role], SIDE[sp.side]]} side={sp.side} heading={name(sp.who)}
        lines={[sp.phase === "after" ? `Points of Information${sp.pois > 0 ? ` · ${sp.pois} taken` : ""}` : c.step === "amend" && amendment ? amendment.text : null]}>
        {sp.phase === "speech" && timerView()}
      </Screen>
    );
  } else if (c.step === "welcome") {
    mid = <Screen heading={`Welcome to ${c.name}`} />;
  } else if (c.step === "pick") {
    mid = (
      <Screen heading="Choosing the speakers">
        <div className={s.dRoles}>
          {([["proposer", "Proposer"], ["seconder", "Seconder"], ["opposer", "Opposer"]] as const).map(([k, label]) => (
            <div key={k} className={s.dRole}><span>{label}</span><b data-empty={!c.roles[k]}>{c.roles[k] ? name(c.roles[k]) : "\u2014"}</b></div>
          ))}
        </div>
      </Screen>
    );
  } else if (c.step === "roll") {
    const n = ch.rollCount(c);
    mid = (
      <Screen heading="Roll call">
        {tallies([["Present", n.present], ["Present and Voting", n.voting], ["Abstain", n.abstain]])}
        <div className={s.dBoard}>
          {c.delegates.map((d) => <div key={d.id} className={s.dSeat} data-a={c.roll[d.id]}><i />{d.name}{c.roll[d.id] && <em>{ch.ATTEND_LABEL[c.roll[d.id]]}</em>}</div>)}
        </div>
      </Screen>
    );
  } else if (c.step === "caucus") {
    mid = <Screen heading="Caucus">{timerView()}</Screen>;
  } else if (c.step === "amend" && amendment) {
    const stage = c.amend?.stage;
    const r = c.result && c.result.amendment === amendment.id && c.result.kind === "debate" ? c.result : null;
    mid = c.poll ? (
      <Screen pill={amendPill(amendment)} heading={stage === "ask" ? "Debate this amendment?" : "Adopt this amendment?"}>
        {votes(c.poll)}
        {signatories(amendment)}
      </Screen>
    ) : r ? (
      <Screen pill={amendPill(amendment)} heading={r.passed ? "Debate approved" : "Debate not approved"} pass={r.passed}>
        {votes(r)}
        {signatories(amendment)}
      </Screen>
    ) : (
      <Screen pill={amendPill(amendment)} heading={`“${amendment.text}”`}>
        {signatories(amendment)}
      </Screen>
    );
  } else if (c.step === "vote" || c.step === "closed") {
    const n = ch.count(c);
    const done = c.step === "closed" && c.outcome;
    mid = (
      <Screen heading={done ? (c.outcome!.passed ? "Resolution approved" : "Resolution not approved") : "Roll call vote"} pass={done ? c.outcome!.passed : undefined}
        lines={done ? [`${c.outcome!.yes} For · ${c.outcome!.no} Against · ${c.outcome!.abstain} Abstaining${!c.outcome!.passed ? ` · ${c.outcome!.needed} needed` : ""}`] : []}>
        {c.step === "vote" && votes(n)}
        <div className={s.dBoard}>
          {c.delegates.map((d) => <div key={d.id} className={s.dSeat} data-b={c.ballots[d.id]}><i />{d.name}</div>)}
        </div>
      </Screen>
    );
  } else if (c.step === "ended") {
    mid = <Screen heading="Thank you" lines={[`${c.name} has ended`]} />;
  } else if (c.step === "closing") {
    const todo = ch.closingRoles(c).filter((r) => !c.closers.includes(r.id));
    mid = (
      <Screen pill={["Closing speeches"]} heading={todo.length ? todo.map((r) => name(r.id)).join(" · ") : "The vote is next"}
        lines={[todo.length ? todo.map((r) => ch.ROLE_LABEL[r.role]).join(" · ") : null]} />
    );
  } else if (c.step === "floor" && c.result?.kind === "amendment" && c.amendments.some((a) => a.id === c.result?.amendment)) {
    const a = c.amendments.find((x) => x.id === c.result!.amendment)!;
    mid = (
      <Screen pill={amendPill(a)} heading={c.result.passed ? "This amendment passes" : "This amendment fails"} pass={c.result.passed}>
        {votes(c.result)}
        {signatories(a)}
      </Screen>
    );
  } else {
    const who = c.step === "proposer" ? c.roles.proposer : c.step === "seconder" ? c.roles.seconder : c.step === "opposer" ? c.roles.opposer : null;
    const role = c.step === "proposer" ? "Proposer" : c.step === "seconder" ? "Seconder" : "Opposer";
    mid = who
      ? <Screen pill={[role, c.step === "opposer" ? SIDE.against : SIDE.for]} side={c.step === "opposer" ? "against" : "for"} heading={name(who)} />
      : <Screen heading="Amendments" lines={["Send amendments to the chair's desk"]} />;
  }

  const first = c && c.step === "amend" ? ch.nextCandidate(c) : null;
  const rest = c && c.step === "amend" ? c.debate.list.slice(0, 4) : [];
  const ordered = first ? [first, ...rest.filter((x) => x.id !== first.id)] : rest;
  const body = (
    <div className={s.display}>
      <div className={s.dTop}>
        <div>
          <p className={`serif ${s.dName}`}>{c?.name ?? "Chambers"}</p>
          {c?.topic && <p className={s.dTopic}>{c.topic}</p>}
          <p className={s.dBrand}>Powered by <Wordmark height={13} /></p>
        </div>
        {tools}
      </div>
      <main id="top" className={s.dMid}>{mid}</main>
      <div className={s.dBottom}>
        <div className={s.dNext}>
          {c && ordered.length > 0 && (
            <>
              <span>Up next</span>
              <ol>{ordered.map((x) => <li key={x.id} data-side={x.side}><i />{name(x.id)}</li>)}</ol>
            </>
          )}
        </div>
      </div>
    </div>
  );
  // Over the site's own header and footer, which this window has no use for.
  return createPortal(body, document.body);
}
