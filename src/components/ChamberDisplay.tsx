"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "next/navigation";
import * as ch from "@/lib/chamber";
import { Wordmark } from "@/lib/brand";
import { isId, useChamber } from "@/lib/useChamber";
import { useAuth } from "./AuthProvider";
import { bare, useNow } from "./Chambers";
import s from "./Chambers.module.css";

// What the room sees. Every screen is built the same way, top to bottom: one pill saying what this moment is, a heading
// in the serif, one or two lines of ordinary text under it, and then the thing to look at (the time, the votes or the
// roll). The display only reads the committee the console keeps and redraws when that changes.
const icon = (d: React.ReactNode) => <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>;
const Expand = () => icon(<path d="M6 2.5H2.5V6M10 2.5h3.5V6M6 13.5H2.5V10M10 13.5h3.5V10" />);
const Shrink = () => icon(<path d="M2.5 6H6V2.5M13.5 6H10V2.5M2.5 10H6v3.5M13.5 10H10v3.5" />);
const Back = () => icon(<path d="M13 8H3M7 4L3 8l4 4" />);
const SIDE = { for: "In favour", against: "Against" } as const;

/** One screen: a pill, a heading, lines of text, and whatever there is to look at. */
function Screen({ pill, side, heading, long, pass, lines, children }: {
  pill?: (string | false | null | undefined)[]; side?: ch.Side; heading?: React.ReactNode; long?: boolean; pass?: boolean; lines?: (React.ReactNode | false | null | undefined)[]; children?: React.ReactNode;
}) {
  const text = (pill ?? []).filter(Boolean).join(" · ");
  const rows = (lines ?? []).filter(Boolean);
  return (
    <>
      {text && <span className={s.dPill} data-side={side}>{text}</span>}
      {heading && <h1 className={`serif ${s.dH} ${long ? s.m : ""}`} data-pass={pass}>{heading}</h1>}
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

  const tools = (
    <div className={s.dTools}>
      <button type="button" className={s.dBtn} onClick={() => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.())}>{full ? <Shrink /> : <Expand />}{full ? "Exit full screen" : "Full screen"}</button>
      <Link href={cloudId ? `/chambers?c=${cloudId}` : "/chambers"} className={s.dBtn}><Back />Console</Link>
    </div>
  );

  const name = (id: string | null) => (c ? ch.nameOf(c, id) : "");
  const amendment = c?.amend ? c.amendments.find((a) => a.id === c.amend!.id) : undefined;
  const signatories = amendment && amendment.backers.length > 0 ? `Signatories: ${amendment.backers.map(name).join(", ")}` : null;
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
  // What the speeches are about: the amendment in hand, or else the resolution.
  const context = c ? (c.step === "amend" && amendment ? amendment.text : c.topic) : "";

  let mid: React.ReactNode;
  if (!c) {
    mid = status === "signin" ? (
      <Screen heading="Log in to see this committee"><Link href="/login" className={s.dBtn}>Log in</Link></Screen>
    ) : status === "denied" ? (
      <Screen heading="This committee isn't shared with you" long lines={["Ask the person who runs it to add the email on your Collex account."]} />
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
        lines={[sp.phase === "after" ? `Points of Information${sp.pois > 0 ? ` · ${sp.pois} taken` : ""}` : context]}>
        {sp.phase === "speech" && timerView()}
      </Screen>
    );
  } else if (c.step === "welcome" || c.step === "pick") {
    mid = <Screen pill={["Opening", c.step === "pick" && "Choosing the speakers"]} heading={`Welcome to the ${bare(c.name)}`} lines={[c.topic]} />;
  } else if (c.step === "roll") {
    const n = ch.rollCount(c);
    mid = (
      <Screen pill={["Opening", "Roll call"]} heading="Roll call">
        {tallies([["Present", n.present], ["Present and Voting", n.voting], ["Abstain", n.abstain]])}
        <div className={s.dBoard}>
          {c.delegates.map((d) => <div key={d.id} className={s.dSeat} data-a={c.roll[d.id]}><i />{d.name}{c.roll[d.id] && <em>{ch.ATTEND_LABEL[c.roll[d.id]]}</em>}</div>)}
        </div>
      </Screen>
    );
  } else if (c.step === "caucus") {
    mid = <Screen pill={["Debate", "Caucus"]} heading="Caucus" lines={[c.topic]}>{timerView()}</Screen>;
  } else if (c.step === "amend" && amendment) {
    const stage = c.amend?.stage;
    mid = (
      <Screen pill={["Amendment", amendment.clause, `from ${name(amendment.by)}`]}
        heading={stage === "ask" ? "Debate this amendment?" : stage === "vote" ? "Adopt this amendment?" : "Reading the amendment"} long
        lines={[amendment.text, signatories]}>
        {c.poll ? tallies([["For", c.poll.yes], ["Against", c.poll.no], ["Abstain", c.poll.abstain]]) : timerView()}
      </Screen>
    );
  } else if (c.step === "vote" || c.step === "closed") {
    const n = ch.count(c);
    mid = (
      <Screen pill={["Closing", c.step === "closed" ? "Result" : "Roll call vote"]}
        heading={c.step === "closed" && c.outcome ? (c.outcome.passed ? "Resolution approved" : "Resolution not approved") : "Roll call vote"}
        pass={c.step === "closed" && c.outcome ? c.outcome.passed : undefined}
        lines={c.step === "closed" && c.outcome
          ? [c.topic, `${c.outcome.yes} For · ${c.outcome.no} Against · ${c.outcome.abstain} Abstaining${!c.outcome.passed ? ` · ${c.outcome.needed} needed` : ""}`]
          : []}>
        {c.step === "vote" && tallies([["For", n.yes], ["Against", n.no], ["Abstain", n.abstain]])}
        <div className={s.dBoard}>
          {c.delegates.map((d) => <div key={d.id} className={s.dSeat} data-b={c.ballots[d.id]}><i />{d.name}</div>)}
        </div>
      </Screen>
    );
  } else if (c.step === "ended") {
    mid = <Screen pill={["Closing", "Ended"]} heading="Thank you" lines={[`The ${bare(c.name)} has ended`]} />;
  } else if (c.step === "closing") {
    const todo = ch.closingRoles(c).filter((r) => !c.closers.includes(r.id));
    mid = (
      <Screen pill={["Closing", "Closing speeches"]} heading={todo.length ? todo.map((r) => name(r.id)).join(" · ") : "The vote is next"} long
        lines={[todo.length ? todo.map((r) => ch.ROLE_LABEL[r.role]).join(" · ") : c.topic]} />
    );
  } else {
    const who = c.step === "proposer" ? c.roles.proposer : c.step === "seconder" ? c.roles.seconder : c.step === "opposer" ? c.roles.opposer : null;
    const role = c.step === "proposer" ? "Proposer" : c.step === "seconder" ? "Seconder" : c.step === "opposer" ? "Opposer" : "";
    mid = who ? (
      <Screen pill={[role, c.step === "opposer" ? SIDE.against : SIDE.for]} side={c.step === "opposer" ? "against" : "for"} heading={name(who)} lines={[c.topic]} />
    ) : (
      <Screen pill={["Debate", "Amendments"]} heading="Amendments" lines={[c.topic]} />
    );
  }

  const first = c && c.step === "amend" ? ch.nextCandidate(c) : null;
  const rest = c && c.step === "amend" ? c.debate.list.slice(0, 4) : [];
  const ordered = first ? [first, ...rest.filter((x) => x.id !== first.id)] : rest;
  const body = (
    <div className={s.display}>
      <div className={s.dTop}>
        <div>
          <p className={`serif ${s.dName}`}>{c?.name ?? "Chambers"}</p>
          {c?.topic && c.step !== "welcome" && <p className={s.dTopic}>{c.topic}</p>}
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
        {c && c.result && !c.poll && (
          <p className={s.dNote}><strong>{c.result.passed ? "Passed" : "Failed"}:</strong> {c.result.yes} For, {c.result.no} Against, {c.result.abstain} Abstaining</p>
        )}
      </div>
    </div>
  );
  // Over the site's own header and footer, which this window has no use for.
  return createPortal(body, document.body);
}
