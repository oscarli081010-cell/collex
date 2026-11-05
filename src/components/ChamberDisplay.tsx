"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import * as ch from "@/lib/chamber";
import type { Chamber } from "@/lib/chamber";
import { useNow } from "./Chambers";
import s from "./Chambers.module.css";

// What the room sees: the speaker and the time in very large type, the next few speakers, and any vote. It only reads
// the committee the console saves, and redraws when the console changes it in another window.
export default function ChamberDisplay() {
  const [c, setC] = useState<Chamber | null>(null);
  const [ready, setReady] = useState(false);
  const [full, setFull] = useState(false);
  useEffect(() => {
    setC(ch.load());
    setReady(true);
    const onStore = (e: StorageEvent) => { if (e.key === ch.KEY || e.key === null) setC(ch.load()); };
    const onFull = () => setFull(!!document.fullscreenElement);
    window.addEventListener("storage", onStore);
    document.addEventListener("fullscreenchange", onFull);
    return () => { window.removeEventListener("storage", onStore); document.removeEventListener("fullscreenchange", onFull); };
  }, []);

  const now = useNow(ch.running(c?.timer ?? null));
  const left = c?.timer ? ch.remaining(c.timer, now) : 0;
  const state = !c?.timer ? "none" : left === 0 ? "up" : c.timer.endsAt === null ? "paused" : left <= 10_000 ? "low" : "running";

  const tools = (
    <div className={s.dTools}>
      <button type="button" className="button secondary" onClick={() => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.())}>{full ? "Exit full screen" : "Full screen"}</button>
      <Link href="/chambers" className="button secondary">Back to console</Link>
    </div>
  );

  if (!ready) return null; // the saved committee is only known in the browser

  let mid: React.ReactNode;
  if (!c) mid = (
    <>
      <h1 className={`serif ${s.dWho}`}>Nothing to show yet</h1>
      <p className={s.dTag}>Open a committee in the console, then keep this window open beside it.</p>
    </>
  );
  else if (c.vote) mid = (
    <>
      <p className={s.dTag}>{c.vote.needs === "simple" ? "Simple majority" : "Two-thirds majority"} · voting</p>
      <h1 className={`serif ${s.dWho}`}>{c.vote.title}</h1>
      <div className={s.dTallies}>
        <div className={s.dTally}><span>For</span><b>{c.vote.yes}</b></div>
        <div className={s.dTally}><span>Against</span><b>{c.vote.no}</b></div>
        <div className={s.dTally}><span>Abstain</span><b>{c.vote.abstain}</b></div>
      </div>
    </>
  );
  else if (c.timer) mid = (
    <>
      <p className={s.dTag}>{c.speaker ? "Speaking" : "Timer"}</p>
      <h1 className={`serif ${s.dWho}`}>{c.timer.label}</h1>
      <div className={s.dTime} data-state={state} role="timer">{ch.clock(left)}</div>
      <div className={s.dTrack} aria-hidden="true"><i style={{ width: `${Math.min(100, (left / c.timer.total) * 100)}%` }} /></div>
    </>
  );
  else if (c.result) mid = (
    <>
      <p className={s.dTag}>{c.result.title}</p>
      <div className={s.dVerdict} data-pass={c.result.passed}>{c.result.passed ? "Passed" : "Failed"}</div>
      <p className={s.dTag}>{c.result.yes} for · {c.result.no} against · {c.result.abstain} abstaining</p>
    </>
  );
  else mid = (
    <>
      <h1 className={`serif ${s.dWho}`}>{c.topic || c.name}</h1>
      <p className={s.dTag}>{ch.presentCount(c)} of {c.delegates.length} present</p>
    </>
  );

  const body = (
    <div className={s.display}>
      <div className={s.dTop}>
        <div>
          <p className={`serif ${s.dName}`}>{c?.name ?? "Chambers"}</p>
          {c && c.topic && c.timer && <p className={s.dSub}>{c.topic}</p>}
        </div>
        {tools}
      </div>
      <main id="top" className={s.dMid}>{mid}</main>
      <div className={s.dBottom}>
        <div className={s.dNext}>
          {c && c.queue.length > 0 && !c.vote && (
            <>
              <span className="muted">Up next</span>
              <ol>{c.queue.slice(0, 4).map((q) => <li key={q}>{ch.nameOf(c, q)}</li>)}</ol>
            </>
          )}
        </div>
        {c && c.result && c.timer && !c.vote && (
          <p className={s.dNote}>{c.result.title}: {c.result.passed ? "passed" : "failed"} ({c.result.yes}–{c.result.no}–{c.result.abstain})</p>
        )}
      </div>
    </div>
  );
  // Over the site's own header and footer, which this window has no use for.
  return createPortal(body, document.body);
}
