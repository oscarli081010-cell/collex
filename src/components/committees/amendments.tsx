"use client";

import { useState } from "react";
import * as ch from "@/lib/chamber";
import type { Chamber, Side } from "@/lib/chamber";
import IconButton, { ICONS } from "../IconButton";
import s from "../Chambers.module.css";
import Select from "../Select";
import Flag from "../Flag";
import { Why } from "../RoomChair";
import SearchBox from "../SearchBox";
import { SWAP, uid, SIDE, type Act, Seg, SideSwitch, CardSide } from "./shared";

/** A name for searching: lower case, without accents, so "cote" finds Côte d'Ivoire. */
const fold = (x: string) => x.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

/* The speakers' list for the amendment in hand: For and Against, in the order they will be called. */
export function Lists({ c, act }: { c: Chamber; act: Act }) {
  const [who, setWho] = useState("");
  const [side, setSide] = useState<Side>("for");
  const [stance, setStance] = useState<"none" | Side>("none"); // the general list and a moderated caucus: whether the state speaks For or Against
  const next = ch.nextCandidate(c);
  const options = c.delegates.filter((d) => ch.canAdd(c, d.id, side));
  const spokeN = ch.spokeCount(c);
  const pick = options.some((d) => d.id === who) ? who : "";
  const col = (k: Side) => c.debate.list.filter((x) => x.side === k);
  const spoken = c.debate.run.map((x) => ch.nameOf(c, x.id));
  const plain = !ch.sided(c); // the general list and a moderated caucus are one list of states
  const heading = c.tr ? (c.step === "general" ? "General Speakers\u2019 List" : c.step === "caucus" ? "Moderated Caucus Speakers\u2019 List" : (c.step === "floor" || c.step === "proposer" || c.step === "seconder" || c.step === "opposer") ? `${ch.resNoun(c).replace("resolution", "Resolution")} Speakers\u2019 List` : "Speakers\u2019 List") : c.step === "amend" ? "Speakers\u2019 List" : "Resolution Speakers\u2019 List";

  const form = (
    <>
      <form className={s.addRow} onSubmit={(e) => { e.preventDefault(); if (pick) { act((x) => ch.addToList(x, pick, stance === "against" ? "against" : plain ? "for" : side, plain && stance !== "none")); setWho(""); } }}>
        <label htmlFor="ch-add" className="sr-only">Add a State to the List</label>
        <Select id="ch-add" className={`control ${s.addWho}`} value={pick} onChange={(e) => setWho(e.target.value)}>
          <option value="">{options.length ? "Add a state…" : "No one else can join this side"}</option>
          {options.map((d) => <option key={d.id} value={d.id}>{d.name}{spokeN[d.id] ? ` · spoken ${spokeN[d.id]} ${spokeN[d.id] === 1 ? "time" : "times"}` : ""}</option>)}
        </Select>
        {!plain && <SideSwitch side={side} setSide={setSide} />}
        {plain && !!c.tr && <Seg label="Stance" value={stance} onPick={setStance} className={s.sideSeg} items={[{ id: "none", label: "No Side" }, { id: "for", label: SIDE.for }, { id: "against", label: SIDE.against }]} />}
        <Why why={!pick && (options.length ? "Choose a state first" : "No one else can join this side")}><button type="submit" className="button secondary" disabled={!pick}>Add</button></Why>
      </form>
    </>
  );
  const lists = (
    <>
      <div className={s.sides} data-plain={plain || undefined}>
        {(plain ? (["for"] as const) : (["for", "against"] as const)).map((k) => (
          <div key={k} className={s.sideCol}>
            {!plain && <div className={s.sideHead}><span className={s.chip} data-side={k}>{SIDE[k]}</span><span className="badge">{col(k).length}</span></div>}
            {(plain ? c.debate.list : col(k)).length ? (
              <ol className={s.queue}>
                {(plain ? c.debate.list : col(k)).map((x) => (
                  <li key={x.id} data-next={next?.id === x.id}>
                    <span className={s.qname}><Flag name={ch.nameOf(c, x.id)} />{ch.nameOf(c, x.id)}</span>
                    {plain && x.stance && <span className={s.chip} data-side={x.side}>{SIDE[x.side]}</span>}
                    <span className={s.rowBtns}>
                      <IconButton label={`Move ${ch.nameOf(c, x.id)} up`} icon={ICONS.up} onClick={() => act((y) => ch.shiftList(y, x.id, -1))} />
                      <IconButton label={`Move ${ch.nameOf(c, x.id)} down`} icon={ICONS.down} onClick={() => act((y) => ch.shiftList(y, x.id, 1))} />
                      {!plain && <IconButton label={`${ch.nameOf(c, x.id)} changes side`} icon={SWAP} onClick={() => act((y) => ch.switchSide(y, x.id))} />}
                      <IconButton label={`Remove ${ch.nameOf(c, x.id)}`} icon={ICONS.close} onClick={() => act((y) => ch.removeFromList(y, x.id))} />
                    </span>
                  </li>
                ))}
              </ol>
            ) : <p className={s.empty}>No one yet.</p>}
          </div>
        ))}
      </div>
      {spoken.length > 0 && <p className={s.spoken}>Has spoken: {spoken.join(", ")}.</p>}
    </>
  );

  // The way to add a state on the left, the list on the right, like the amendments, in every procedure.
  return (
    <div className={s.pair}>
      <section className={`panel ${s.list}`} aria-labelledby="ch-list-add">
        <div className={s.head}>
          <h2 id="ch-list-add" className={s.h2}>Add to the {heading}</h2>
        </div>
        <div className={s.panelBody}>{form}</div>
      </section>
      <section className={`panel ${s.list}`} aria-labelledby="ch-list">
        <div className={s.head}>
          <h2 id="ch-list" className={s.h2}>{heading}</h2>
          <span className="badge">{c.debate.list.length}</span>
        </div>
        {lists}
      </section>
    </div>
  );
}

const STATUS: Record<ch.Amendment["status"], string> = { waiting: "Waiting", entertained: "Being Considered", passed: "Passed", failed: "Failed", withdrawn: "Withdrawn", invalid: "Ruled Invalid" };
export const HOW: Record<ch.AmendHow, string> = { strike: "Strike", amend: "Amend", add: "Add" };

/* Amendments, in two boxes: handing one in (left), and the line of them waiting and what became of the rest (right). */
/** How many states have signed, against the states present: the more sponsors the better. */
function SignMeter({ have, of }: { have: number; of: number }) {
  return (
    <div className={s.sigMeter} data-met={have >= 2} role="img" aria-label={`${have} of ${of} states have signed`}>
      <span className={s.kMeter}>
        <span className={s.kMeterBar}><i style={{ width: `${Math.min(100, (have / Math.max(of, 1)) * 100)}%` }} /></span>
        <span className={s.kMeterText}><b>{have}</b> of <b>{of}</b> signed</span>
      </span>
    </div>
  );
}

/** Who signed an amendment, set out like the signatories of a document. */
function Signers({ c, a }: { c: Chamber; a: ch.Amendment }) {
  const [open, setOpen] = useState(false);
  const ids = [a.by, ...(a.seconder ? [a.seconder] : []), ...a.backers.filter((x) => x !== a.seconder)];
  return (
    <>
      <button type="button" className="button secondary sm block" aria-expanded={open} onClick={() => setOpen((v) => !v)}>{open ? "Hide Signatories" : "Show Signatories"} - {ids.length}</button>
      {open && (
        <span className={`${s.kSigners} ${s.reveal}`}>
          {ids.map((id) => (
            <span key={id} className={s.kSigner} data-tone={id === a.by ? "lead" : id === a.seconder ? "second" : undefined}>
              {ch.nameOf(c, id)}
              {id === a.by && <small>proposer</small>}
              {id === a.seconder && <small>seconder</small>}
            </span>
          ))}
        </span>
      )}
    </>
  );
}

export function AmendmentForm({ c, act }: { c: Chamber; act: Act }) {
  const [by, setBy] = useState("");
  const [clause, setClause] = useState("");
  const [text, setText] = useState("");
  const [backers, setBackers] = useState<string[]>([]);
  const [second, setSecond] = useState("");
  const [consensus, setConsensus] = useState(false);
  const [how, setHow] = useState<ch.AmendHow>("amend");
  const [find, setFind] = useState(""); // narrows the states to tick as signatories
  const t = c.tr;
  // Trinity (2026): a proposer and a seconder, and as many sponsors as possible. A clause already amended needs full consensus.
  const signed = new Set([by, second, ...backers].filter(Boolean)).size;
  const again = !!t && ch.amendedClause(c, clause);
  const ready = !!by && text.trim().length > 0 && (!t || (!!second && second !== by && (!again || consensus)));
  const why = ready ? null : !by ? "Choose the state it's from" : !text.trim() ? "Describe the amendment" : t && (!second || second === by) ? "Choose a seconder" : "Confirm full consensus for this clause";
  const free = c.delegates.filter((d) => !ch.observing(c, d.id));
  const q = fold(find);
  const signable = free.filter((d) => d.id !== by && d.id !== second && (!q || fold(d.name).includes(q)));
  return (
    <section className={`panel ${s.list}`} aria-labelledby="ch-am-add">
      <div className={s.head}>
        <h2 id="ch-am-add" className={s.h2}>Add an Amendment</h2>
      </div>
      <form className={s.panelBody} onSubmit={(e) => { e.preventDefault(); if (!ready) return; act((x) => ch.submitAmendment(x, uid(), by, clause, text, backers, t ? second : null, consensus, how)); setText(""); setClause(""); setBackers([]); setSecond(""); setConsensus(false); setFind(""); }}>
        <div className={s.two}>
          <div className="field">
            <label htmlFor="am-by" className="sr-only">Amendment from</label>
            <Select id="am-by" className="control" value={by} onChange={(e) => { setBy(e.target.value); setBackers((b) => b.filter((x) => x !== e.target.value)); if (second === e.target.value) setSecond(""); }}>
              <option value="">From which state?</option>
              {free.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </Select>
          </div>
          <div className="field">
            <label htmlFor="am-cl" className="sr-only">Clause</label>
            <input id="am-cl" className="control" value={clause} onChange={(e) => setClause(e.target.value)} placeholder="E.g., Operative Clause 1" maxLength={40} />
          </div>
        </div>
        {t && (
          <div className="field">
            <label htmlFor="am-sec" className="sr-only">Seconder</label>
            <Select id="am-sec" className="control" value={second} onChange={(e) => { setSecond(e.target.value); setBackers((b) => b.filter((x) => x !== e.target.value)); }}>
              <option value="">Seconder</option>
              {free.filter((d) => d.id !== by).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </Select>
          </div>
        )}
        <Seg label="What It Does to the Clause" value={how} onPick={setHow} items={[{ id: "amend", label: "Amend" }, { id: "strike", label: "Strike" }, { id: "add", label: "Add" }]} />
        <div className="field">
          <label htmlFor="am-tx" className="sr-only">Description</label>
          <textarea id="am-tx" className="control" rows={3} value={text} onChange={(e) => setText(e.target.value)} maxLength={600} placeholder="Description" />
        </div>
        <fieldset className={s.procedure}>
          <legend>{t ? "Co-sponsors" : "Signatories"}</legend>
          {/* Enter in the search only searches: it doesn't send the amendment. */}
          <div onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}>
            <SearchBox label={t ? "Search the co-sponsors" : "Search the signatories"} placeholder="Search states" value={find} onChange={setFind} />
          </div>
          <div className={s.backers}>
            {signable.length === 0 && <p className={s.empty}>No states match.</p>}
            {signable.map((d) => (
              <label key={d.id} className={s.check}>
                <input type="checkbox" checked={backers.includes(d.id)} onChange={(e) => setBackers((b) => (e.target.checked ? [...b, d.id] : b.filter((x) => x !== d.id)))} />
                {d.name}
              </label>
            ))}
          </div>
        </fieldset>
        {t && <SignMeter have={signed} of={ch.present(c) || c.delegates.length} />}
        {again && (
          <label className={s.check}><input type="checkbox" checked={consensus} onChange={(e) => setConsensus(e.target.checked)} />This clause was already amended: full consensus, no votes against and no abstentions</label>
        )}
        <Why why={why}><button type="submit" className="button secondary block" disabled={!ready}>Add Amendment</button></Why>
      </form>
    </section>
  );
}

/* Standard and Custom: an amendment to the amendment being debated. One at a time, and none to that one. */
export function SubAmend({ c, act, parent }: { c: Chamber; act: Act; parent: ch.Amendment }) {
  const [open, setOpen] = useState(false);
  const [by, setBy] = useState("");
  const [text, setText] = useState(parent.text);
  if (parent.to) return null;
  const free = c.delegates.filter((d) => !ch.observing(c, d.id) && ch.isHere(c, d.id));
  const why = !ch.subOpen(c) ? "Wait until the speech is over" : !by ? "Choose the state it's from" : !text.trim() ? "Write the new wording" : text.trim() === parent.text ? "Change the wording first" : null;
  if (!open) return <button type="button" className="button secondary sm" aria-expanded={false} onClick={() => setOpen(true)}>Move an Amendment to This Amendment</button>;
  return (
    <form className={s.anyBox} onSubmit={(e) => { e.preventDefault(); if (why) return; act((x) => ch.moveSubAmendment(x, uid(), by, text)); setOpen(false); setBy(""); }}>
      <div className="field">
        <label htmlFor="fl-sub-by">From</label>
        <Select id="fl-sub-by" className="control" value={by} onChange={(e) => setBy(e.target.value)}>
          <option value="">Choose a state</option>
          {free.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </Select>
      </div>
      <div className="field">
        <label htmlFor="fl-sub-tx">The Amendment Would Read</label>
        <textarea id="fl-sub-tx" className="control" rows={3} value={text} onChange={(e) => setText(e.target.value)} maxLength={600} />
      </div>
      <p className={s.hint}>Debated and voted on first. If it passes, the amendment reads this way.</p>
      <div className={s.btnRow}>
        <Why why={why}><button type="submit" className="button secondary sm" disabled={!!why}>Move It</button></Why>
        <button type="button" className="button secondary sm" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </form>
  );
}

export function AmendmentQueue({ c, act }: { c: Chamber; act: Act }) {
  const waiting = ch.waitingAmendments(c);
  const live = c.amendments.find((a) => a.id === c.amend?.id);
  const subLive = c.amendments.find((a) => a.id === c.amend?.sub?.id);
  const done = c.amendments.filter((a) => a.status !== "waiting" && a.status !== "entertained");
  const name = (id: string) => ch.nameOf(c, id);
  const canEntertain = c.step === "floor" && !c.speech && !c.amend;
  const entertainWhy = canEntertain ? null : c.amend ? "Finish the amendment being considered" : c.speech ? "Wait until the speech is over" : "Only during debate on the resolution";
  return (
    <section className={`panel ${s.list}`} aria-labelledby="ch-am">
      <div className={s.head}>
        <h2 id="ch-am" className={s.h2}>Amendments</h2>
        <span className="badge">{waiting.length}</span>
      </div>
      {waiting.length > 1 && (
        <div className={s.sortRow} role="group" aria-label="Sort the waiting amendments">
          <button type="button" className="button secondary sm" onClick={() => act((x) => ch.sortAmendments(x, "signatories"))}>Most Signatories First</button>
          <button type="button" className="button secondary sm" onClick={() => act((x) => ch.sortAmendments(x, "oldest"))}>Oldest First</button>
        </div>
      )}
      {(live || waiting.length > 0) && (
        <ol className={s.queue}>
          {live && (
            <li data-next="true" className={`${s.card} ${s.amend}`}>
              <span className={s.cardTop}>
                <span className={s.cardTitle}><Flag name={name(live.by)} />{name(live.by)}{live.how && ` \u00B7 ${HOW[live.how]}`}{live.clause && ` \u00B7 ${live.clause}`}</span>
                <span className={s.nextTag}>Being Considered</span>
              </span>
              <span className={s.amText}>{live.text}</span>
              {live.was && <span className={s.hint}>Amended from: {live.was}</span>}
              {subLive && <span className={s.hint}>Amendment to it from {name(subLive.by)}: {subLive.text}</span>}
              <Signers c={c} a={live} />
            </li>
          )}
          {waiting.map((a, i) => (
            <li key={a.id} className={`${s.card} ${s.amend}`} data-next={!live && i === 0}>
              <span className={s.cardTop}>
                <span className={s.cardTitle}><Flag name={name(a.by)} />{name(a.by)}{a.how && ` \u00B7 ${HOW[a.how]}`}{a.clause && ` \u00B7 ${a.clause}`}</span>
                <CardSide next={!live && i === 0} first={i === 0} last={i === waiting.length - 1} label="amendment" move={(d) => act((x) => ch.moveAmendment(x, a.id, d))} />
              </span>
              <span className={s.amText}>{a.text}</span>
              <span className={s.kActions}>
                <Why why={entertainWhy}><button type="button" className="button secondary sm" disabled={!canEntertain} onClick={() => act((x) => ch.entertain(x, a.id))}>Entertain</button></Why>
                <button type="button" className="button secondary sm" onClick={() => act((x) => ch.invalidAmendment(x, a.id))}>Rule Invalid</button>
                <button type="button" className={`button secondary sm ${s.kDanger}`} onClick={() => act((x) => ch.withdrawAmendment(x, a.id))}>Withdraw</button>
              </span>
              <Signers c={c} a={a} />
            </li>
          ))}
        </ol>
      )}
      {done.length > 0 && (
        <ul className={s.states}>
          {done.map((a) => <li key={a.id}><span>{name(a.by)}{a.clause && ` · ${a.clause}`}{a.to && " · To an amendment"}</span><span className={s.chip} data-tone={a.status === "passed" ? "ok" : a.status === "failed" || a.status === "invalid" ? "bad" : undefined}>{STATUS[a.status]}</span></li>)}
        </ul>
      )}
    </section>
  );
}
