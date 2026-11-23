"use client";

import { useState } from "react";
import * as ch from "@/lib/chamber";
import type { Ballot, Chamber } from "@/lib/chamber";
import s from "../Chambers.module.css";
import Flag from "../Flag";
import { Why } from "../RoomChair";
import { type Act, Seg, Stats } from "./shared";

// A vote by placard: counts for, against and abstaining. More for than against passes; the President may overrule it.
export function PollBox({ c, act }: { c: Chamber; act: Act }) {
  const [overrule, setOverrule] = useState(false);
  const p = c.poll;
  if (!p) return null;
  // The same rule the result is decided by: Standard and Custom motions need a majority (or two-thirds) of those present.
  const would = p.kind === "motion" ? ch.motionPasses(c, p) : ch.passes(p);
  const cast = p.yes + p.no + p.abstain;
  const id = p.kind === "motion" ? p.motion ?? "" : c.amend?.id ?? "";
  const decide = p.kind === "motion" ? ch.decideMotion : p.kind === "debate" ? ch.decideAsk : ch.decideAmendment;
  const byRoll = !!p.ballots;
  return (
    <>
      <div className={s.counters}>
        {([["yes", "For"], ["no", "Against"], ["abstain", "Abstain"]] as const).map(([k, label]) => (
          <div key={k} className={s.counter} data-kind={k}>
            <span className={s.cname}>{label}</span>
            <output className={`${s.count} num`} aria-live="polite">{p[k]}</output>
            {!byRoll && (
              <div className={s.step}>
                <Why why={!p[k] && "Already at 0"}><button type="button" className="button secondary" onClick={() => act((x) => ch.tally(x, k, -1))} aria-label={`One fewer ${label.toLowerCase()}`} disabled={!p[k]}>−</button></Why>
                <button type="button" className="button secondary" onClick={() => act((x) => ch.tally(x, k, 1))} aria-label={`One more ${label.toLowerCase()}`}>+</button>
              </div>
            )}
          </div>
        ))}
      </div>
      {byRoll && (
        <ul className={s.ballots}>
          {c.delegates.filter((d) => ch.isHere(c, d.id)).map((d) => (
            <li key={d.id} className={s.ballot}>
              <span className={s.cname2}><Flag name={d.name} />{d.name}</span>
              <Seg label={`Vote of ${d.name}`} value={p.ballots?.[d.id]} className={s.ballotSeg}
                items={[{ id: "for", label: "For" }, { id: "against", label: "Against" }, { id: "abstain", label: "Abstain" }]}
                onPick={(b) => act((x) => ch.pollCast(x, d.id, p.ballots?.[d.id] === b ? null : (b as Ballot)))} />
            </li>
          ))}
        </ul>
      )}
      {!byRoll && cast > ch.present(c) && <p className={s.hint} role="status" data-tone="warn">{cast} counted, {ch.present(c)} present. Count the placards again.</p>}
      {cast > 0 && <p className={s.verdict}><strong data-pass={would}>{would ? "Would pass" : "Would fail"}</strong></p>}
      <button type="button" className="button" onClick={() => act((x) => decide(x, null, id))}>Record the Result</button>
      {overrule ? (
        <div className={s.btnRow} role="group" aria-label="Overrule the count">
          <button type="button" className="button secondary sm" onClick={() => act((x) => decide(x, "for", id))}>For</button>
          <button type="button" className="button secondary sm" onClick={() => act((x) => decide(x, "against", id))}>Against</button>
        </div>
      ) : (
        <button type="button" className="button secondary sm" onClick={() => setOverrule(true)}>Overrule</button>
      )}
    </>
  );
}

/* The vote on the resolution, state by state. */
export function RollCall({ c, act }: { c: Chamber; act: Act }) {
  const n = ch.count(c);
  const t = c.tr;
  const two = !!t && c.pass === "twothirds";
  const need = two ? Math.max(1, Math.ceil(((n.yes + n.no) * 2) / 3)) : t ? Math.floor((n.yes + n.no) / 2) + 1 : ch.needed(c.delegates.length);
  const closed = c.step === "closed" || c.step === "ended";
  return (
    <section className={`panel ${s.side}`}>
      <div className={s.head}>
        <h2 className={s.h2}>Roll Call Vote</h2>
      </div>
      {closed && c.outcome && (
        <p className={s.banner} data-pass={c.outcome.passed}>
          <strong>{c.outcome.passed ? "Approved" : "Not approved"}</strong>
          {c.outcome.yes} for, {c.outcome.no} against, {c.outcome.abstain} abstaining.
          {!c.outcome.passed ? ` ${c.outcome.needed} votes in favour were needed.` : ""}
          {c.outcome.struck?.length ? ` Struck: ${c.outcome.struck.join("; ")}.` : ""}
        </p>
      )}
      {c.style && !closed && !ch.quorum(c, "vote").met && <p className={s.hint} role="status" data-tone="warn">{ch.quorumText(ch.quorum(c, "vote"), "vote")}.</p>}
      {c.style && <Division c={c} act={act} closed={closed} />}
      <Stats label="Votes So Far" bar items={[
        { label: "For", value: n.yes, tone: "ok" },
        { label: "Against", value: n.no, tone: "bad" },
        { label: "Abstain", value: n.abstain },
        { label: "Still to Vote", value: n.left },
      ]} />
      {two ? <p className={s.hint}>Two-thirds of the votes cast, so {need} For at the moment. Abstentions count for neither.</p> : t ? <p className={s.hint}>More For than Against, so {need} For at the moment. Abstentions count for neither.</p> : <p className={s.hint}>Needs at least {need} in favour</p>}
      {closed
        ? <p className={s.hint}>The vote is recorded, so the ballots can&rsquo;t be changed.</p>
        : c.delegates.some((d) => ch.isHere(c, d.id) && c.roll[d.id] === "voting") && <p className={s.hint}>States marked Present &amp; Voting can&rsquo;t abstain.</p>}
      {c.style ? <Answers c={c} act={act} closed={closed} /> : (
      <ul className={s.ballots}>
        {c.delegates.filter((d) => ch.isHere(c, d.id)).map((d) => (
          <li key={d.id} className={s.ballot}>
            <span className={s.cname2}><Flag name={d.name} />{d.name}</span>
            <Seg label={`Vote of ${d.name}`} value={c.ballots[d.id]} disabled={closed} className={s.ballotSeg}
              items={[{ id: "for", label: "For" }, { id: "against", label: "Against" }, { id: "abstain", label: "Abstain", off: c.roll[d.id] === "voting", why: "Present and Voting, so For or Against only" }]}
              onPick={(b) => act((x) => ch.cast(x, d.id, c.ballots[d.id] === b ? null : (b as Ballot)))} />
          </li>
        ))}
      </ul>
      )}
    </section>
  );
}

/* Standard and Custom: each state answers For, Against, Abstain or Pass, and For or Against can be "with rights" (they
   explain their vote after the result). A state that passes is asked again at the end, and must then vote For or Against. */
function Answers({ c, act, closed }: { c: Chamber; act: Act; closed: boolean }) {
  const here = c.delegates.filter((d) => ch.isHere(c, d.id));
  const again = new Set(c.passed ?? []);
  const row = (d: ch.Delegate) => {
    const a = ch.answerOf(c, d.id);
    const ballot = a === "forRights" ? "for" : a === "againstRights" ? "against" : a;
    const rights = a === "forRights" || a === "againstRights";
    const passed = again.has(d.id);
    return (
      <li key={d.id} className={s.ballot}>
        <span className={s.cname2}><Flag name={d.name} />{d.name}</span>
        {(ballot === "for" || ballot === "against") && !closed && (
          <button type="button" className={s.pbadge} aria-pressed={rights} onClick={() => act((x) => ch.answer(x, d.id, rights ? ballot : ballot === "for" ? "forRights" : "againstRights"))}>With Rights</button>
        )}
        {closed && rights && <span className={s.pbadge}>With Rights</span>}
        <Seg label={`Vote of ${d.name}`} value={ballot} disabled={closed} className={`${s.ballotSeg} ${passed ? "" : s.ballotSeg4}`}
          items={[{ id: "for", label: "For" }, { id: "against", label: "Against" }, { id: "abstain", label: "Abstain", off: c.roll[d.id] === "voting" || passed },
            ...(passed ? [] : [{ id: "pass" as const, label: "Pass", off: !!c.ballots[d.id] }])]}
          onPick={(b) => act((x) => ch.answer(x, d.id, ballot === b ? null : b))} />
      </li>
    );
  };
  const first = here.filter((d) => !again.has(d.id));
  const second = here.filter((d) => again.has(d.id));
  return (
    <>
      <ul className={s.ballots}>{first.map(row)}</ul>
      {second.length > 0 && (
        <>
          <h3 className={s.h3}>Passed: Asked Again</h3>
          <p className={s.hint}>Once everyone else has answered, these states are asked again. They vote For or Against.</p>
          <ul className={s.ballots}>{second.map(row)}</ul>
        </>
      )}
    </>
  );
}

/* Standard and Custom: dividing the question, before anyone votes. Each part (an operative clause, say) is voted on in
   turn, and a part that fails is struck; then the rest of the resolution is voted on as a whole. */
function Division({ c, act, closed }: { c: Chamber; act: Act; closed: boolean }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const d = c.divide;
  if (d) {
    const now = ch.partText(c);
    return (
      <div className={s.anyBox}>
        {!closed && now && <p className={s.sub}><strong>Voting on:</strong> {now}</p>}
        <ul className={s.states}>
          {d.parts.map((p, i) => (
            <li key={i}><span>{p.label}</span><span className={s.chip} data-tone={p.result === "passed" ? "ok" : p.result === "failed" ? "bad" : undefined}>{p.result === "passed" ? "Kept" : p.result === "failed" ? "Struck" : i === d.at ? "Voting" : "Waiting"}</span></li>
          ))}
        </ul>
        {ch.undivide(c) !== c && <button type="button" className="button secondary block" onClick={() => act(ch.undivide)}>Undo the Division</button>}
      </div>
    );
  }
  if (!ch.canDivide(c)) return null;
  const labels = typed.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
  if (!open) return <button type="button" className="button secondary block" aria-expanded={false} onClick={() => setOpen(true)}>Divide the Question</button>;
  return (
    <form className={s.anyBox} onSubmit={(e) => { e.preventDefault(); if (labels.length) { act((x) => ch.divideQuestion(x, labels)); setOpen(false); setTyped(""); } }}>
      <p className={s.hint}>Each part is voted on first, in this order. A part that fails is struck. Then the rest is voted on as a whole.</p>
      <div className="field">
        <label htmlFor="dv-typed">Parts, One per Line</label>
        <textarea id="dv-typed" className="control" rows={2} value={typed} onChange={(e) => setTyped(e.target.value)} maxLength={800} placeholder="E.g., Operative Clause 3" />
      </div>
      <div className={s.btnRow}>
        <Why why={!labels.length && "Type at least one part"}><button type="submit" className="button secondary sm" disabled={!labels.length}>Divide</button></Why>
        <button type="button" className="button secondary sm" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </form>
  );
}
