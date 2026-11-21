"use client";

import { useState } from "react";
import * as ch from "@/lib/chamber";
import type { Chamber } from "@/lib/chamber";
import { ICONS } from "../IconButton";
import s from "../Chambers.module.css";
import Select from "../Select";
import Flag from "../Flag";
import { ArmedButton, Why } from "../RoomChair";
import { type Act, Undo, Seg, Stats } from "./shared";

/* The three parts of the debate, and the step inside the one we're in. */
export function Rail({ c }: { c: Chamber }) {
  const idx = ch.stageIndex(c);
  return (
    <ol className={s.rail} aria-label="Where the council is" data-n={ch.stagesOf(c).length} style={{ "--n": ch.stagesOf(c).length } as React.CSSProperties}>
      {ch.stagesOf(c).map((label, i) => (
        <li key={label} data-state={i < idx ? "done" : i === idx ? "now" : "next"} aria-current={i === idx ? "step" : undefined}>
          <span className={s.dot}>{i < idx ? ICONS.check : i + 1}</span>
          <span className={s.railText}>
            <span className={s.railLabel}>{label}</span>
            {i === idx && <span className={s.railSub}>{ch.substep(c)}</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}

/* Opening, 1: the welcome, with the resolution. */
export function Welcome({ c, act }: { c: Chamber; act: Act }) {
  const [text, setText] = useState("");
  return (
    <section className={`panel ${s.welcome}`} aria-label="Welcome">
      <Undo c={c} act={act} />
      <h2 className={`serif ${s.welcomeTitle}`}>Welcome to {c.name}</h2>
      {c.topic ? (
        <div className={s.resBox}>
          <span className={s.tag}>{c.tr ? "Topic" : "Resolution"}</span>
          <p className={`serif ${s.resText}`}>{c.topic}</p>
        </div>
      ) : (
        <form className={s.resBox} onSubmit={(e) => { e.preventDefault(); act((x) => ch.setResolution(x, text)); }}>
          <div className="field">
            <label htmlFor="wl-res">Resolution</label>
            <input id="wl-res" className="control" value={text} onChange={(e) => setText(e.target.value)} maxLength={160} placeholder="The resolution being debated" />
          </div>
          <Why why={!text.trim() && "Type the resolution first"}><button type="submit" className="button secondary block" disabled={!text.trim()}>Save the Resolution</button></Why>
        </form>
      )}
      <Why why={!c.topic && "Save the resolution first"}><button type="button" className="button lg block" disabled={!c.topic} onClick={() => act(ch.startRoll)}>Start Roll Call</button></Why>
    </section>
  );
}

/* Opening, 2: the roll call. */
export const ATTEND: ch.Attend[] = ["absent", "present", "voting"];
export function RollCallOpen({ c, act }: { c: Chamber; act: Act }) {
  const n = ch.rollCount(c);
  // Standard and Custom: a third of the member states must be here to open debate. The chair can still go on.
  const q = c.style ? ch.quorum(c, "debate") : null;
  return (
    <section className={`panel ${s.opening}`} aria-labelledby="rc-h">
      <div className={s.head}>
        <h2 id="rc-h" className={`serif ${s.who}`}>Roll Call</h2>
        <Undo c={c} act={act} />
      </div>
      <Stats label="Roll Call So Far" bar items={[
        { label: "Present & Voting", value: n.voting, tone: "ok" },
        { label: "Present", value: n.present, tone: "accent" },
        { label: "Absent", value: n.absent, tone: "warn" },
        { label: "Not Marked Yet", value: n.unmarked },
      ]} />
      <div className={s.btnRow}>
        <button type="button" className="button secondary" onClick={() => act((x) => ch.markAllRoll(x, "present"))}>Everyone Present</button>
        <button type="button" className="button secondary" onClick={() => act((x) => ch.markAllRoll(x, "voting"))}>Everyone Present & Voting</button>
      </div>
      <ul className={s.ballots}>
        {c.delegates.map((d) => (
          <li key={d.id} className={s.ballot}>
            <span className={s.cname2}><Flag name={d.name} />{d.name}</span>
            <Seg label={`Roll call: ${d.name}`} value={c.roll[d.id]} className={`${s.ballotSeg} ${s.rollSeg}`}
              items={ATTEND.map((a) => ({ id: a, label: ch.ATTEND_LABEL[a] }))}
              onPick={(a) => act((x) => ch.markRoll(x, d.id, c.roll[d.id] === a ? null : a))} />
          </li>
        ))}
      </ul>
      {q && <p className={s.hint} role="status" data-tone={q.met ? undefined : "warn"}>{ch.quorumText(q, "debate")}{q.met ? "" : ". Mark more states present, or continue without quorum."}</p>}
      {!q || q.met
        ? <button type="button" className="button lg block" onClick={() => act(ch.beginDebate)}>Begin Debate</button>
        : <ArmedButton className="button lg block" label="Continue Without Quorum" again="Press Again to Begin Debate" onConfirm={() => act(ch.beginDebate)} />}
    </section>
  );
}

/* Opening, 3: the chair chooses the Proposer, Seconder and Opposer. Each choice is saved as it is made, so the display shows it at once. */
const PICK = [["proposer", "Proposer"], ["seconder", "Seconder"], ["opposer", "Opposer (optional)"]] as const;
export function Pick({ c, act }: { c: Chamber; act: Act }) {
  const pool = c.delegates.filter((d) => ch.isHere(c, d.id)); // a state not marked counts as present
  const ok = !!(c.roles.proposer && c.roles.seconder); // nobody has to oppose
  const why = ok ? null : !c.roles.proposer && !c.roles.seconder ? "Choose a proposer and seconder" : !c.roles.proposer ? "Choose a proposer" : "Choose a seconder";
  return (
    <form className={`panel ${s.opening}`} onSubmit={(e) => { e.preventDefault(); if (ok) act(ch.startSpeeches); }}>
      <div className={s.head}>
        <h2 className={`serif ${s.who}`}>Choose the Speakers</h2>
        <Undo c={c} act={act} />
      </div>
      <div className={s.three}>
        {PICK.map(([role, label]) => {
          const taken = PICK.filter(([k]) => k !== role).map(([k]) => c.roles[k]);
          return (
            <div key={role} className="field">
              <label htmlFor={`pk-${role}`}>{label}</label>
              <Select id={`pk-${role}`} className="control" value={c.roles[role] ?? ""} onChange={(e) => act((x) => ch.pickRole(x, role, e.target.value || null))}>
                <option value="">{role === "opposer" ? "No opposer" : "Choose a state"}</option>
                {pool.filter((d) => !taken.includes(d.id)).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </Select>
            </div>
          );
        })}
      </div>
      <Why why={why}><button type="submit" className="button lg block" disabled={!ok}>Start the Speeches</button></Why>
    </form>
  );
}

/* Trinity Grammar MUN: introducing a resolution. Its proposer and co-proposer come from the draft (a given resolution has none yet); the chair chooses an opposer, if anyone will. */
export function TrinityPick({ c, act }: { c: Chamber; act: Act }) {
  const d = ch.currentDoc(c);
  const name = (id: string | null) => ch.nameOf(c, id);
  const here = c.delegates.filter((x) => ch.isHere(c, x.id) && !ch.observing(c, x.id)); // a state not marked counts as present
  const pool = here.filter((x) => x.id !== c.roles.proposer && x.id !== c.roles.seconder);
  return (
    <form className={`panel ${s.opening}`} onSubmit={(e) => { e.preventDefault(); act(ch.startSpeeches); }}>
      <div className={s.head}>
        <h2 className={`serif ${s.who}`}>Introduce the {ch.resNoun(c).replace("resolution", "Resolution")}</h2>
        <Undo c={c} act={act} />
      </div>
      {d && (
        <div className={s.resBox}>
          <span className={s.tag}>{ch.resNoun(c)}</span>
          <p className={`serif ${s.resText}`}>{d.title}</p>
        </div>
      )}
      <div className={s.three}>
        {d && !d.proposer ? (
          <>
            <div className="field">
              <label htmlFor="pk-proposer">Proposer</label>
              <Select id="pk-proposer" className="control" value={c.roles.proposer ?? ""} onChange={(e) => act((x) => ch.pickRole(x, "proposer", e.target.value || null))}>
                <option value="">Which state?</option>
                {c.delegates.filter((x) => here.some((h) => h.id === x.id) && x.id !== c.roles.seconder && x.id !== c.roles.opposer).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
              </Select>
            </div>
            <div className="field">
              <label htmlFor="pk-second">{ch.roleName(c, "seconder")}</label>
              <Select id="pk-second" className="control" value={c.roles.seconder ?? ""} onChange={(e) => act((x) => ch.pickRole(x, "seconder", e.target.value || null))}>
                <option value="">Which state?</option>
                {c.delegates.filter((x) => here.some((h) => h.id === x.id) && x.id !== c.roles.proposer && x.id !== c.roles.opposer).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
              </Select>
            </div>
          </>
        ) : (
          <>
            <div className="field"><span>Proposer</span><p className={s.fixedVal}><Flag name={name(c.roles.proposer)} />{name(c.roles.proposer)}</p></div>
            <div className="field"><span>{ch.roleName(c, "seconder")}</span><p className={s.fixedVal}><Flag name={name(c.roles.seconder)} />{name(c.roles.seconder)}</p></div>
          </>
        )}
        <div className="field">
          <label htmlFor="pk-opposer">Opposer (optional)</label>
          <Select id="pk-opposer" className="control" value={c.roles.opposer ?? ""} onChange={(e) => act((x) => ch.pickRole(x, "opposer", e.target.value || null))}>
            <option value="">No opposer</option>
            {pool.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </Select>
        </div>
      </div>
      <Why why={!ch.has(c, c.roles.proposer) && !ch.has(c, c.roles.seconder) ? `Choose a proposer and ${ch.roleName(c, "seconder").toLowerCase()}` : !ch.has(c, c.roles.proposer) ? "Choose a proposer" : !ch.has(c, c.roles.seconder) && `Choose a ${ch.roleName(c, "seconder").toLowerCase()}`}><button type="submit" className="button lg block" disabled={!ch.has(c, c.roles.proposer) || !ch.has(c, c.roles.seconder)}>Start the Speeches</button></Why>
      <button type="button" className="button secondary block" onClick={() => act(ch.cancelIntroduction)}>Back to the Resolutions</button>
    </form>
  );
}
