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

// What the room sees: whoever has the floor and the time in very large type, the next speakers, the amendment in hand,
// any vote and then the roll call. It only reads the committee the console keeps and redraws when that changes.
const icon = (d: React.ReactNode) => <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>;
const Expand = () => icon(<path d="M6 2.5H2.5V6M10 2.5h3.5V6M6 13.5H2.5V10M10 13.5h3.5V10" />);
const Shrink = () => icon(<path d="M2.5 6H6V2.5M13.5 6H10V2.5M2.5 10H6v3.5M13.5 10H10v3.5" />);
const Back = () => icon(<path d="M13 8H3M7 4L3 8l4 4" />);
const SIDE = { for: "In favour", against: "Against" } as const;

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
  const timerView = (small = false) => c?.timer && (
    <>
      <div className={`${s.dTime} ${small ? s.s : ""}`} data-state={state} role="timer">{ch.clock(left)}</div>
      <div className={s.dTrack} aria-hidden="true"><i style={{ width: `${Math.min(100, (left / c.timer.total) * 100)}%` }} /></div>
    </>
  );

  let mid: React.ReactNode;
  if (!c) {
    mid = status === "signin" ? (
      <>
        <h1 className={`serif ${s.dWho}`}>Log in to see this committee</h1>
        <Link href="/login" className={s.dBtn}>Log in</Link>
      </>
    ) : status === "denied" ? (
      <>
        <h1 className={`serif ${s.dWho}`}>This committee isn&apos;t shared with you</h1>
        <p className={s.dTag}>Ask the person who runs it to add the email on your Collex account.</p>
      </>
    ) : status === "loading" || cloudId ? null : (
      <>
        <h1 className={`serif ${s.dWho}`}>Nothing to show yet</h1>
        <p className={s.dTag}>Open a committee in the console, then keep this window open beside it.</p>
      </>
    );
  } else if (c.speech) {
    const sp = c.speech;
    mid = (
      <>
        <p className={s.dTag}><span className={s.dChip}>{ch.ROLE_LABEL[sp.role]}</span><span className={s.dChip} data-side={sp.side}>{SIDE[sp.side]}</span></p>
        <h1 className={`serif ${s.dWho}`}>{name(sp.who)}</h1>
        {sp.phase === "speech" && timerView()}
        {sp.phase === "questions" && <p className={`serif ${s.dVerdict}`}>Points of information{sp.pois > 0 ? ` · ${sp.pois}` : ""}</p>}
        {sp.phase === "yield" && <p className={`serif ${s.dVerdict}`}>Yielding the floor</p>}
        {c.step === "amend" && amendment && <p className={s.dSub}>Amendment: {amendment.text}</p>}
      </>
    );
  } else if (c.step === "caucus") {
    mid = (
      <>
        <p className={s.dTag}>Negotiation room closed</p>
        <h1 className={`serif ${s.dWho}`}>{c.timer?.label ?? "Caucus"}</h1>
        {timerView()}
      </>
    );
  } else if (c.step === "amend" && amendment) {
    mid = (
      <>
        <p className={s.dTag}><span className={s.dChip}>Amendment</span>{amendment.clause && <span className={s.dChip}>{amendment.clause}</span>}<span className={s.dChip}>from {name(amendment.by)}</span></p>
        <p className={s.dText}>{amendment.text}</p>
        {amendment.backers.length > 0 && <p className={s.dSub}>Co-sponsors: {amendment.backers.map(name).join(", ")}</p>}
        {c.poll && (
          <>
            <p className={s.dTag}>{c.poll.title}</p>
            <div className={s.dTallies}>
              <div className={s.dTally}><span>For</span><b>{c.poll.yes}</b></div>
              <div className={s.dTally}><span>Against</span><b>{c.poll.no}</b></div>
              <div className={s.dTally}><span>Abstain</span><b>{c.poll.abstain}</b></div>
            </div>
          </>
        )}
        {!c.poll && timerView(true)}
      </>
    );
  } else if (c.step === "vote" || c.step === "closed") {
    const n = ch.count(c);
    mid = (
      <>
        {c.step === "closed" && c.outcome ? (
          <>
            <p className={s.dTag}>{c.resolution.title}</p>
            <div className={s.dVerdict} data-pass={c.outcome.passed}>{c.outcome.passed ? "Resolution approved" : "Resolution not approved"}</div>
            <p className={s.dTag}>{c.outcome.yes} for · {c.outcome.no} against · {c.outcome.abstain} abstaining{c.outcome.vetoed.length ? ` · vetoed by ${c.outcome.vetoed.join(", ")}` : !c.outcome.passed ? ` · ${c.outcome.needed} needed` : ""}</p>
          </>
        ) : (
          <>
            <p className={s.dTag}>Roll call vote</p>
            <div className={s.dTallies}>
              <div className={s.dTally}><span>For</span><b>{n.yes}</b></div>
              <div className={s.dTally}><span>Against</span><b>{n.no}</b></div>
              <div className={s.dTally}><span>Abstain</span><b>{n.abstain}</b></div>
            </div>
          </>
        )}
        <div className={s.dBoard}>
          {c.delegates.map((d) => <div key={d.id} className={s.dSeat} data-b={c.ballots[d.id]}><i />{d.name}{d.permanent && <small>P</small>}</div>)}
        </div>
      </>
    );
  } else if (c.step === "open") {
    mid = (
      <>
        <h1 className={`serif ${s.dWho}`}>{c.topic || c.name}</h1>
        <p className={s.dTag}>Waiting for the resolution</p>
      </>
    );
  } else {
    const next = ch.nextCandidate(c);
    const label = c.step === "proposer" ? "Proposer" : c.step === "seconder" ? "Seconder" : c.step === "reply" ? "Right of Reply" : c.step === "opposer" ? "First against" : "Up next";
    const who = c.step === "proposer" ? c.resolution.proposer : c.step === "seconder" ? c.resolution.seconder : c.step === "reply" ? ch.replyBy(c) : c.step === "floor" ? next?.id ?? null : null;
    mid = (
      <>
        <p className={s.dTag}><span className={s.dChip}>{label}</span></p>
        <h1 className={`serif ${s.dWho} ${who ? "" : s.m}`}>{who ? name(who) : c.step === "opposer" ? "A state against the resolution" : "Debate continues"}</h1>
        {c.resolution.title && <p className={s.dText}>{c.resolution.title}</p>}
      </>
    );
  }

  // The same order the console calls them in: whoever was yielded to, then the next on the alternating list.
  const first = c && c.step !== "open" && c.step !== "vote" && c.step !== "closed" && !c.debate.yielded ? ch.nextCandidate(c) : null;
  const upNext = c && c.step !== "open" && c.step !== "vote" && c.step !== "closed" ? [...(first ? [first] : []), ...c.debate.list.filter((x) => x.id !== first?.id)].slice(0, 4) : [];
  const body = (
    <div className={s.display}>
      <div className={s.dTop}>
        <div>
          <p className={`serif ${s.dName}`}>{c?.name ?? "Chambers"}</p>
          {c?.resolution.title && <p className={s.dSub}>{c.resolution.title}</p>}
          <p className={s.dBrand}>Powered by <Wordmark height={13} /></p>
        </div>
        {tools}
      </div>
      <main id="top" className={s.dMid}>{mid}</main>
      <div className={s.dBottom}>
        <div className={s.dNext}>
          {(c?.debate.yielded || upNext.length > 0) && c && (
            <>
              <span className="muted">Up next</span>
              <ol>
                {c.debate.yielded && <li data-side={c.debate.yielded.side}><i />{name(c.debate.yielded.id)} (yielded to)</li>}
                {upNext.map((x) => <li key={x.id} data-side={x.side}><i />{name(x.id)}</li>)}
              </ol>
            </>
          )}
        </div>
        {c && (
          <div className={s.dNote}>
            {c.result && !c.poll && <span>{c.result.title}: {c.result.passed ? "passed" : "failed"} ({c.result.yes}–{c.result.no}–{c.result.abstain})</span>}
            {c.step !== "open" && c.step !== "vote" && c.step !== "closed" && <span>Negotiation room {c.negotiation ? "open" : "closed"}</span>}
          </div>
        )}
      </div>
    </div>
  );
  // Over the site's own header and footer, which this window has no use for.
  return createPortal(body, document.body);
}
