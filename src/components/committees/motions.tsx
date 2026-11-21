"use client";

import { useEffect, useState } from "react";
import * as ch from "@/lib/chamber";
import type { Chamber } from "@/lib/chamber";
import s from "../Chambers.module.css";
import Select from "../Select";
import { Why } from "../RoomChair";
import { uid, type Act, Duration, CardSide } from "./shared";

/* Trinity Grammar MUN: motions. Raised in any order, put in the order the chair chooses, then voted on by placard. */
export function Motions({ c, act }: { c: Chamber; act: Act }) {
  const [chosen, setKind] = useState<ch.MotionKind>("mod");
  const kinds = ch.motionKinds(c);
  const kind = kinds.includes(chosen) ? chosen : kinds[0];
  const [by, setBy] = useState("");
  const [topic, setTopic] = useState("");
  const [total, setTotal] = useState<number | null>(600);
  const [per, setPer] = useState<number | null>(60);
  const [ref, setRef] = useState("");
  const waiting = ch.waitingMotions(c);
  const past = c.tr!.motions.filter((m) => m.status === "passed" || m.status === "failed").slice(-6).reverse();
  const input: ch.MotionInput = { kind, by: by || null, topic, total: total ?? 0, per: per ?? 0, ref: ref || null };
  const err = ch.motionError(c, input);
  const pickKind = (k: ch.MotionKind) => { setKind(k); setRef(""); setTotal(k === "mod" ? 600 : k === "unmod" ? 300 : 120); setPer(60); };
  const amendments = ch.waitingAmendments(c);
  const busy = !!c.poll || !!c.speech;
  // "Start a moderated caucus" on the floor lands here, on that motion, with the topic ready to be typed.
  useEffect(() => {
    const open = () => { setKind("mod"); setTimeout(() => { const el = document.getElementById("mo-topic"); el?.scrollIntoView({ block: "center", behavior: "smooth" }); el?.focus({ preventScroll: true }); }, 50); };
    window.addEventListener("chambers:motion", open);
    return () => window.removeEventListener("chambers:motion", open);
  }, []);
  return (
    <div className={s.pair}>
    <section className={`panel ${s.list}`} aria-labelledby="ch-mo-add">
      <div className={s.head}>
        <h2 id="ch-mo-add" className={s.h2}>Add a Motion</h2>
      </div>
      <form className={s.panelBody} onSubmit={(e) => { e.preventDefault(); if (err) return; act((x) => ch.addMotion(x, uid(), input)); setTopic(""); }}>
        <div className={s.two}>
          <div className="field">
            <label htmlFor="mo-kind" className="sr-only">Motion</label>
            <Select id="mo-kind" className="control" value={kind} onChange={(e) => pickKind(e.target.value as ch.MotionKind)}>
              {kinds.map((k) => <option key={k} value={k}>{ch.MOTION_LABEL[k]}</option>)}
            </Select>
          </div>
          <div className="field">
            <label htmlFor="mo-by" className="sr-only">From Which State</label>
            <Select id="mo-by" className="control" value={by} onChange={(e) => setBy(e.target.value)}>
              <option value="">From which state?</option>
              {c.delegates.filter((d) => !ch.observing(c, d.id)).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </Select>
          </div>
        </div>
        {kind === "mod" && (
          <div className="field">
            <label htmlFor="mo-topic" className="sr-only">Topic</label>
            <input id="mo-topic" className="control" value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={120} placeholder="Topic of the caucus" />
          </div>
        )}
        {(kind === "mod" || kind === "unmod" || kind === "extend") && (
          <div className={s.two} key={kind}>
            <Duration id="mo-total" label={kind === "extend" ? "Extend by" : "Duration"} value={total} min={kind === "unmod" ? 30 : 10} max={ch.TR.maxCaucus} onChange={(v) => setTotal(v)} />
            {kind === "mod" && <Duration id="mo-per" label="Time per Speaker" value={per} min={5} max={ch.TR.maxCaucus} onChange={(v) => setPer(v)} />}
          </div>
        )}
        {kind === "amend" && (
          <div className="field">
            <label htmlFor="mo-ref" className="sr-only">Amendment</label>
            <Select id="mo-ref" className="control" value={ref} onChange={(e) => setRef(e.target.value)}>
              <option value="">{amendments.length ? "Which amendment?" : "No amendment is waiting"}</option>
              {amendments.map((a) => <option key={a.id} value={a.id}>{ch.nameOf(c, a.by)}{a.clause && ` · ${a.clause}`}</option>)}
            </Select>
          </div>
        )}
        {err && !(kind === "mod" && !topic.trim()) && <p className={s.hint} role="status">{err}</p>}
        <Why why={err}><button type="submit" className="button secondary block" disabled={!!err}>Add the Motion</button></Why>
      </form>
    </section>
    <section className={`panel ${s.list}`} aria-labelledby="ch-mo">
      <div className={s.head}>
        <h2 id="ch-mo" className={s.h2}>Motions</h2>
        <span className="badge">{waiting.length}</span>
      </div>
      {waiting.length > 1 && (
        <div className={s.sortRow} role="group" aria-label="Order the motions">
          {c.style && <button type="button" className="button secondary sm" onClick={() => act(ch.precedenceMotions)}>By Precedence</button>}
          <button type="button" className="button secondary sm" onClick={() => act(ch.sortMotions)}>Oldest First</button>
        </div>
      )}
      {waiting.length > 0 && (
        <ol className={s.queue}>
          {waiting.map((m, i) => (
            <li key={m.id} className={`${s.card} ${s.motion}`} data-next={i === 0}>
              <span className={s.cardTop}>
                <span className={s.cardTitle}>{ch.MOTION_LABEL[m.kind]}</span>
                <CardSide next={i === 0} first={i === 0} last={i === waiting.length - 1} label="motion" move={(d) => act((x) => ch.moveMotion(x, m.id, d))} />
              </span>
              <span className={s.cardMeta}>
                <span className={s.cardLine}>{m.by && <><strong>{ch.nameOf(c, m.by)}</strong> proposes{ch.motionDetail(c, m) ? " " : ""}</>}{ch.motionDetail(c, m)}</span>
                {ch.motionNeedsText(c, m.kind) && <span className={s.cardLine}>{ch.motionNeedsText(c, m.kind)}</span>}
              </span>
              <span className={s.kActions}>
                <Why why={c.poll ? "Finish the vote that's open first" : c.speech ? "Wait until the speech is over" : ch.motionError(c, m)}><button type="button" className="button secondary sm" disabled={busy || !!ch.motionError(c, m)} onClick={() => act((x) => ch.voteMotion(x, m.id))}>Put to the Vote</button></Why>
                <Why why={c.poll?.motion === m.id && "Being voted on now"}><button type="button" className={`button secondary sm ${s.kDanger}`} disabled={c.poll?.motion === m.id} onClick={() => act((x) => ch.withdrawMotion(x, m.id))}>Withdraw</button></Why>
              </span>
            </li>
          ))}
        </ol>
      )}
      {past.length > 0 && (
        <ul className={s.states}>
          {past.map((m) => <li key={m.id}><span>{ch.MOTION_LABEL[m.kind]}{m.by && ` · ${ch.nameOf(c, m.by)}`}</span><span className={s.chip} data-tone={m.status === "passed" ? "ok" : "bad"}>{m.status === "passed" ? "Passed" : "Failed"}</span></li>)}
        </ul>
      )}
    </section>
    </div>
  );
}

/* Trinity Grammar MUN: the committee's resolutions. */
const DOC_RESULT = { passed: "Passed", failed: "Failed" } as const;
export function Documents({ c, act }: { c: Chamber; act: Act }) {
  const t = c.tr!;
  const [title, setTitle] = useState("");
  return (
    <section className={`panel ${s.list}`} aria-labelledby="ch-docs">
      <div className={s.head}>
        <h2 id="ch-docs" className={s.h2}>Resolutions</h2>
        <span className="badge">{t.docs.length}</span>
      </div>
      {t.docs.length > 0 ? (
        <ul className={s.queue}>
          {t.docs.map((d) => (
            <li key={d.id} className={`${s.card} ${s.doc}`} data-next={t.current === d.id}>
              <span className={s.cardTop}>
                <span className={s.cardTitle}>{d.title}</span>
                {d.result
                  ? <span className={s.chip} data-tone={d.result === "passed" ? "ok" : "bad"}>{DOC_RESULT[d.result]}</span>
                  : t.current === d.id && <span className={s.chip} data-tone="accent">Being debated</span>}
              </span>
              {!c.style && <span className={s.seenTag} data-seen={d.seen}>{d.seen ? "Seen" : "Unseen"}</span>}
              {d.link && <a className={s.docLink} href={d.link} target="_blank" rel="noopener noreferrer">Open the document</a>}
              <span className={s.kActions}>
                {!d.result && t.current !== d.id && <Why why={c.step !== "general" ? "Only from the general speakers' list" : c.speech ? "Wait until the speech is over" : !!c.poll && "Finish the vote that's open first"}><button type="button" className="button secondary sm" disabled={c.step !== "general" || !!c.speech || !!c.poll} onClick={() => act((x) => ch.introduceDraft(x, d.id))}>Introduce</button></Why>}
                {c.style && !d.result && t.current !== d.id && <button type="button" className="button secondary sm" onClick={() => act((x) => ch.removeDraft(x, d.id))}>Remove</button>}
              </span>
            </li>
          ))}
        </ul>
      ) : <p className={s.empty}>{c.style ? "No resolutions yet. Add each draft here as it is handed in." : "No resolutions yet. Add them in Settings."}</p>}
      {c.style && (
        <form className={s.addRow2} onSubmit={(e) => { e.preventDefault(); if (!title.trim()) return; act((x) => ch.addDraft(x, uid(), title)); setTitle(""); }}>
          <label htmlFor="ch-doc-new" className="sr-only">Title of the Draft Resolution</label>
          <input id="ch-doc-new" className="control" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} placeholder="Title of the draft resolution" />
          <Why why={!title.trim() && "Type a title first"}><button type="submit" className="button secondary" disabled={!title.trim()}>Add</button></Why>
        </form>
      )}
    </section>
  );
}

/* Trinity Grammar MUN: points, rights of reply and the honorary observer. */
export function ChairTools({ c, act, now }: { c: Chamber; act: Act; now: number }) {
  const t = c.tr!;
  const [by, setBy] = useState("");
  const [to, setTo] = useState("");
  const [obs, setObs] = useState("");
  const name = (id: string | null) => ch.nameOf(c, id);
  const toId = to || c.speech?.who || "";
  const active = Object.keys(t.observers).filter((id) => ch.observing(c, id, now) && c.delegates.some((d) => d.id === id));
  return (
    <section className={`panel ${s.list}`} aria-labelledby="ch-tools">
      <div className={s.head}>
        <h2 id="ch-tools" className={s.h2}>Chair&apos;s Tools</h2>
      </div>
      <div className={s.panelBody}>
        <fieldset className={s.procedure}>
          <legend>Right of Reply</legend>
          {t.reply ? (
            <>
              <p className={s.hint}>{name(t.reply.by)} has {ch.REPLY_SECS} seconds{t.reply.to ? `, then ${name(t.reply.to)} answers` : ""}. No questions.</p>
              <div className={s.sortRow}>
                {(["apologised", "withdrew", "refused"] as const).map((o) => <button key={o} type="button" className="button secondary sm" onClick={() => act((x) => ch.finishReply(x, o))}>{o === "apologised" ? "Apologised" : o === "withdrew" ? "Withdrew" : "Refused"}</button>)}
                <button type="button" className="button secondary sm" onClick={() => act((x) => ch.finishReply(x, null))}>No Answer</button>
              </div>
            </>
          ) : (
            <div className={s.two}>
              <Select id="rr-by" className="control" value={by} onChange={(e) => setBy(e.target.value)}>
                <option value="">Who claims it?</option>
                {c.delegates.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </Select>
              <Select id="rr-to" className="control" value={toId} onChange={(e) => setTo(e.target.value)}>
                <option value="">Against whom?</option>
                {c.delegates.filter((d) => d.id !== by).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </Select>
              <Why why={!by ? "Choose who claims it first" : by === toId && "Choose a different state to reply to"}><button type="button" className="button secondary" disabled={!by || by === toId} onClick={() => { act((x) => ch.startReply(x, by, toId || null)); setBy(""); setTo(""); }}>Start the 20 Seconds</button></Why>
            </div>
          )}
        </fieldset>
        <fieldset className={s.procedure}>
          <legend>Honorary Observer</legend>
          <div className={s.pickRow}>
            <Select id="ob-who" className="control" value={obs} onChange={(e) => setObs(e.target.value)}>
              <option value="">Which state?</option>
              {c.delegates.filter((d) => !ch.observing(c, d.id, now) && c.speech?.who !== d.id).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </Select>
            <Why why={!obs && "Choose a state first"}><button type="button" className="button secondary sm" disabled={!obs} onClick={() => { act((x) => ch.setObserver(x, obs)); setObs(""); }}>5 Minutes</button></Why>
          </div>
          {active.length > 0 && (
            <ul className={s.queue}>
              {active.map((id) => {
                const left = ch.observerLeft(c, id, now);
                return (
                  <li key={id} className={s.card}>
                    <span className={s.cardTop}>
                      <span className={s.kSigner}>{name(id)}<small>honorary observer</small></span>
                      <span className={s.obsClock} data-low={left < 60000 || undefined}>{ch.clock(left)}</span>
                    </span>
                    <span className={s.kActions}>
                      <button type="button" className={`button secondary sm ${s.kDanger}`} onClick={() => act((x) => ch.endObserver(x, id))}>End Observation</button>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </fieldset>
      </div>
    </section>
  );
}
