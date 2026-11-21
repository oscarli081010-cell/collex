"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import * as ch from "@/lib/chamber";
import type { Chamber } from "@/lib/chamber";
import { HOW_LABEL, POINTS, askText, strawKey, voteKey, voteTitle, type Ask, type DelegateSync } from "@/lib/room";
import { supabase } from "@/lib/supabase";
import { isId } from "@/lib/useChamber";
import { useDelegateRoom } from "@/lib/useRoom";
import { useAuth } from "./AuthProvider";
import { useNow } from "./Chambers";
import { Gavel } from "./Drawings";
import Flag from "./Flag";
import { ICONS } from "./IconButton";
import PanelTabs from "./PanelTabs";
import { Why } from "./RoomChair";
import { Empty, FilesPanel, NotesPanel } from "./RoomParts";
import Select from "./Select";
import { useToast } from "./useToast";
import board from "./board.module.css";
import s from "./Chambers.module.css";
import r from "./Room.module.css";

const svg = (d: React.ReactNode) => <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>;
const NOTE = svg(<path d="M2.5 3.5h11v7h-6l-3 2.5v-2.5h-2z" />);
const FILE = svg(<path d="M10.5 4.5l-5 5a1.8 1.8 0 002.5 2.5l5.5-5.5a3 3 0 00-4.3-4.2L3.5 8a4.3 4.3 0 006 6l4-4" />);

type Peek = { id: string; name: string; topic: string; mine: string | null; delegates: { id: string; name: string; taken: number }[] };

function Shell({ title, text, children }: { title: string; text: string; children?: React.ReactNode }) {
  return (
    <main id="top" className={`container ${s.setup}`}>
      <section className={`panel ${s.setupCard}`}>
        <div className={`${board.empty} ${s.emptyCard}`}>
          <Gavel />
          <p className={board.emptyTitle}>{title}</p>
          <p className="muted">{text}</p>
          {children && <div className="btnStack">{children}</div>}
        </div>
      </section>
    </main>
  );
}

/* A delegate's own page: follow the debate, ask the chairs for things, vote, pass notes and share files. */
export default function ChamberRoom() {
  const params = useSearchParams();
  const q = params.get("c");
  const cid = isId(q) ? q : null;
  const join = (params.get("join") ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
  const { ready, session } = useAuth();
  const router = useRouter();
  const { say, node } = useToast();

  if (!ready) return <main id="top" className="container" />;
  if (!session) {
    const next = cid ? `/chambers/room?c=${cid}` : `/chambers/room?join=${join}`;
    return <Shell title="Log in to take your seat" text="Delegates join a committee from their free Collex account."><Link href={`/login?next=${encodeURIComponent(next)}`} className="button">Log In</Link><Link href="/signup" className="button secondary">Create an Account</Link></Shell>;
  }
  if (!cid) return <><TakeSeat code={join} say={say} done={(id) => router.replace(`/chambers/room?c=${id}`)} />{node}</>;
  return <><Seat cid={cid} userId={session.user.id} say={say} />{node}</>;
}

/* After typing the delegates' code: choose which state you are. */
function TakeSeat({ code, say, done }: { code: string; say: (t: string) => void; done: (id: string) => void }) {
  const [peek, setPeek] = useState<Peek | null | "none">(null);
  const [busy, setBusy] = useState("");
  useEffect(() => {
    if (!supabase || code.length !== 6) { setPeek("none"); return; }
    let live = true;
    supabase.rpc("room_peek", { code }).then(({ data, error }) => { if (!live) return; if (error) say(error.message); setPeek((data as Peek | null) ?? "none"); });
    return () => { live = false; };
  }, [code]); // eslint-disable-line react-hooks/exhaustive-deps
  if (peek === null) return <main id="top" className="container" />;
  if (peek === "none") return <Shell title="No committee has that code" text="Check the six characters with your chair. Delegates use the delegates' code, not the chairs' one."><Link href="/chambers?join=" className="button">Type a Code</Link></Shell>;
  const take = async (id: string) => {
    if (!supabase || busy) return;
    setBusy(id);
    const { data, error } = await supabase.rpc("room_take_seat", { code, delegate: id });
    setBusy("");
    if (error) { say(error.message); return; }
    // No answer means the code no longer matches a committee (or there were too many tries).
    if (!data) { say("No committee has that code. Check it with the chair."); return; }
    done(data as string);
  };
  return (
    <main id="top" className={`container ${r.room}`}>
      <header>
        <h1 className={`serif ${s.name}`}>{peek.name}</h1>
        {peek.topic && <p className="muted">{peek.topic}</p>}
      </header>
      <section className={`panel ${s.share}`} aria-labelledby="ts-h">
        <h2 id="ts-h" className={s.h2}>Which State Are You?</h2>
        <p className="muted">Choose the state you represent. Up to three people can sit as one state.</p>
        <ul className={r.rows}>
          {peek.delegates.map((d) => (
            <li key={d.id}>
              <span className={r.rowMain}>
                <strong><Flag name={d.name} />{d.name}</strong>
                {d.taken > 0 && <small>{d.taken} {d.taken === 1 ? "person has" : "people have"} this seat</small>}
              </span>
              <span className={r.rowBtns}>
                <Why why={busy ? (busy === d.id ? "Joining…" : "Joining another seat…") : d.taken >= 3 && "Three people already have this seat"}><button type="button" className={peek.mine === d.id ? "button sm" : "button secondary sm"} disabled={!!busy || d.taken >= 3} onClick={() => void take(d.id)}>{busy === d.id ? "Joining…" : peek.mine === d.id ? "Continue" : d.taken >= 3 ? "Full" : "Take This Seat"}</button></Why>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

type Tab = "floor" | "vote" | "notes" | "files";

function Seat({ cid, userId, say }: { cid: string; userId: string; say: (t: string) => void }) {
  const { data, c, status, refresh } = useDelegateRoom(cid, true);
  const [tab, setTab] = useState<Tab>("floor");
  const router = useRouter();
  const run = ch.running(c?.timer ?? null) || ch.running(c?.tr?.cauc?.clock ?? null);
  const now = useNow(run);

  if (status === "denied") return <Shell title="You don't have a seat here" text="The chairs may have turned delegates' devices off, or your seat was taken away. Ask your chair for the delegates' code."><Link href="/chambers?join=" className="button">Type a Code</Link></Shell>;
  if (!data || !c) return status === "offline" ? <Shell title="Can't reach the committee" text="Check your connection. This page keeps trying." /> : <main id="top" className="container" />;

  const me = data.seat;
  const myName = ch.nameOf(c, me);
  const key = voteKey(c);
  const straw = data.room.straw?.open ? data.room.straw : null;
  const voting = (key && !data.votes[key] ? 1 : 0) + (straw && !data.votes[strawKey(straw)] ? 1 : 0);
  const lastAll = [...data.notes].reverse().find((n) => n.to_id === "all" && Date.now() - Date.parse(n.created_at) < 30 * 60000);
  const leave = async () => { if (supabase) { await supabase.rpc("room_unseat", { cid, target: userId }); router.replace("/chambers?tab=yours"); } };

  return (
    <main id="top" className={`container ${r.room}`}>
      <header className={s.top}>
        <div className={s.nameBox}>
          <h1 className={`serif ${s.name}`}>{data.name}<i className={`${s.liveDot} ${s.nameDot}`} data-off={status === "offline"} title={status === "offline" ? "Offline" : "Live"} aria-hidden="true" /></h1>
          <dl className={s.facts3}>
            <div><dt>You Are</dt><dd><Flag name={myName} />{myName || "A removed state"}</dd></div>
            {c.topic && <div className={s.factWide}><dt>Topic</dt><dd>{c.topic}</dd></div>}
          </dl>
        </div>
        <button type="button" className={`button secondary ${s.topBtn}`} onClick={() => void leave()}>{ICONS.leave}Leave</button>
      </header>
      {status === "offline" && <p className={s.result} data-pass="false" role="alert">Offline: what you see may be out of date.</p>}
      {lastAll && <p className={r.announce} role="status"><strong>From the chairs</strong>{lastAll.body}</p>}

      <PanelTabs idPrefix="rm" label="Your Seat" tab={tab} setTab={setTab}
        tabs={[{ id: "floor", label: "Floor", icon: ICONS.manage }, { id: "vote", label: "Vote", icon: ICONS.check, badge: voting || undefined, badgeNote: "to vote on" }, { id: "notes", label: "Notes", icon: NOTE }, { id: "files", label: "Files", icon: FILE }]} />

      <div id={`rm-panel-${tab}`} role="tabpanel" aria-labelledby={`rm-tab-${tab}`} className={s.manage}>
        {tab === "floor" && <><Now c={c} now={now} me={me} /><Requests c={c} cid={cid} me={me} asks={data.asks} say={say} refresh={refresh} /></>}
        {tab === "vote" && <Vote c={c} cid={cid} me={me} data={data} say={say} refresh={refresh} />}
        {tab === "notes" && <NotesPanel c={c} cid={cid} notes={data.notes} me={me} rule={data.room.notes ?? "on"} say={say} onSent={refresh} />}
        {tab === "files" && <FilesPanel c={c} cid={cid} files={data.files} userId={userId} chair={false} say={say} onChange={refresh} />}
      </div>
    </main>
  );
}

/* What is happening now: who has the floor, the time left, and who is next. */
function Now({ c, now, me }: { c: Chamber; now: number; me: string }) {
  const sp = c.speech;
  const k = c.tr?.cauc ?? null;
  const left = c.timer ? ch.remaining(c.timer, now) : 0;
  const state = !c.timer ? "none" : left === 0 ? "up" : c.timer.endsAt !== null ? "running" : "paused";
  const who = sp ? (sp.phase === "ask" ? sp.asker : sp.who) : null;
  const title = who ? ch.nameOf(c, who) : c.poll ? "Vote" : k?.kind === "mod" ? k.topic : c.step === "caucus" ? "Caucus" : ch.substep(c);
  const sub = sp ? (sp.phase === "ask" ? `Point of Information for ${ch.nameOf(c, sp.who)}` : sp.phase === "answer" ? `Replying to ${ch.nameOf(c, sp.asker)}` : sp.phase === "after" ? (ch.takingPoints(sp) ? "Points of Information" : "Choosing how to yield") : ch.roleName(c, sp.role)) : c.poll ? c.poll.title : "";
  const list = c.debate.list;
  return (
    <section className={`panel ${r.now}`} aria-label="Now">
      <span className={r.nowStep}>{ch.stagesOf(c)[ch.stageIndex(c)] ?? ""} · {ch.substep(c)}</span>
      <h2 className={`serif ${r.nowWho}`}>{who && <Flag name={title} em />}{title}</h2>
      {sub && <p className={s.sub}>{sub}</p>}
      {c.timer && c.step !== "closed" && c.step !== "ended" && <div className={r.nowTime} data-state={state} role="timer">{ch.clock(left)}</div>}
      {k?.clock && <p className={s.sub}>Whole caucus: {ch.clock(ch.remaining(k.clock, now))} left</p>}
      {c.result && !c.poll && <p className={s.result} data-pass={c.result.passed}><strong>{c.result.passed ? "Passed" : "Failed"}:</strong> {c.result.yes} For, {c.result.no} Against, {c.result.abstain} Abstaining</p>}
      {c.outcome && (c.step === "closed" || c.step === "ended") && <p className={s.result} data-pass={c.outcome.passed}><strong>{c.outcome.passed ? "Approved" : "Not approved"}:</strong> {c.outcome.yes} For, {c.outcome.no} Against, {c.outcome.abstain} Abstaining</p>}
      {list.length > 0 && (
        <>
          <span className={r.nowStep}>Speakers&rsquo; List</span>
          <ol className={r.order}>
            {list.map((x) => <li key={x.id} data-me={x.id === me}><Flag name={ch.nameOf(c, x.id)} />{ch.nameOf(c, x.id)}{ch.sided(c) || x.stance ? <span className={s.chip} data-side={x.side}>{x.side === "for" ? "For" : "Against"}</span> : null}</li>)}
          </ol>
        </>
      )}
    </section>
  );
}

const ASK_STATUS: Record<Ask["status"], [string, string | undefined]> = { open: ["Waiting", "warn"], done: ["Accepted", "ok"], dismissed: ["Not taken", "bad"], withdrawn: ["Withdrawn", undefined] };

/* Everything a delegate can ask the chairs for. Each request waits in the chairs' inbox until a chair accepts it. */
function Requests({ c, cid, me, asks, say, refresh }: { c: Chamber; cid: string; me: string; asks: Ask[]; say: (t: string) => void; refresh: () => void }) {
  const [form, setForm] = useState<"" | "point" | "motion" | "amendment">("");
  const [busy, setBusy] = useState(false);
  const [point, setPoint] = useState<string>("order");
  const kinds = ch.motionKinds(c);
  const [mk, setMk] = useState<ch.MotionKind>("mod");
  const [topic, setTopic] = useState("");
  const [mins, setMins] = useState("10");
  const [per, setPer] = useState("60");
  const [how, setHow] = useState<ch.AmendHow>("amend");
  const [clause, setClause] = useState("");
  const [text, setText] = useState("");
  const [second, setSecond] = useState("");

  const ask = async (kind: Ask["kind"], body: Record<string, unknown>, done: string) => {
    if (!supabase || busy) return;
    setBusy(true);
    const { error } = await supabase.rpc("room_ask", { cid, kind, body });
    setBusy(false);
    if (error) { say(error.message); return; }
    say(done); setForm(""); setText(""); setClause(""); setTopic("");
    refresh();
  };
  const withdraw = async (id: string) => { if (supabase) { await supabase.rpc("room_ask_set", { ask: id, new_status: "withdrawn" }); refresh(); } };

  const onList = c.debate.list.some((x) => x.id === me);
  const asked = asks.some((a) => a.kind === "floor" && a.status === "open");
  const sided = ch.sided(c);
  const motionsOpen = ch.motionsOpen(c);
  const amendOpen = ch.amendmentsOpen(c);
  const total = Math.round(Number(mins) * 60);
  const motion: ch.MotionInput = { kind: mk, by: me, topic, total: mk === "mod" || mk === "unmod" || mk === "extend" ? total : 0, per: mk === "mod" ? Number(per) : 0 };
  const motionErr = form === "motion" ? ch.motionError(c, motion) : null;
  const floorOff = !ch.isHere(c, me) ? "Your state was marked absent at roll call" : onList ? "Your state is already on the speakers’ list" : asked ? "You’ve already asked for the floor" : !ch.listOpen(c) ? "The speakers’ list isn’t open" : null;
  // Every button is always there. One that can't be used now is greyed, and hovering (or pressing) it says why.
  const btn = (label: string, off: string | null, onClick: () => void, primary: boolean, expanded?: boolean) => off
    ? <span key={label} className="tip" data-tip={off} data-tip-align="start" tabIndex={0}><button type="button" className={primary ? "button" : "button secondary"} disabled>{label}</button></span>
    : <Why key={label} why={busy && "Sending…"}><button type="button" className={primary ? "button" : "button secondary"} disabled={busy} aria-expanded={expanded} onClick={onClick}>{label}</button></Why>;
  const signable = ch.waitingAmendments(c).filter((a) => a.by !== me && a.seconder !== me && !a.backers.includes(me) && !asks.some((x) => x.kind === "sign" && x.status === "open" && x.body.amendment === a.id));

  return (
    <section className={`panel ${s.share}`} aria-labelledby="rq-h">
      <h2 id="rq-h" className={s.h2}>Ask the Chairs</h2>
      <div className={r.acts}>
        {sided ? (<>
          {btn("Speak In Favour", floorOff ?? (ch.canAdd(c, me, "for") ? null : "Your state has already spoken in favour"), () => void ask("floor", { side: "for" }, "Asked for the floor"), true)}
          {btn("Speak Against", floorOff ?? (ch.canAdd(c, me, "against") ? null : "Your state has already spoken against"), () => void ask("floor", { side: "against" }, "Asked for the floor"), true)}
        </>) : btn("Ask for the Floor", floorOff, () => void ask("floor", {}, "Asked for the floor"), true)}
        {btn("Raise a Point", null, () => setForm(form === "point" ? "" : "point"), false, form === "point")}
        {btn("Propose a Motion", !c.tr ? "Motions aren’t part of this procedure" : motionsOpen ? null : "Motions aren’t being taken right now", () => setForm(form === "motion" ? "" : "motion"), false, form === "motion")}
        {btn("Hand In an Amendment", amendOpen ? null : "Amendments aren’t open right now", () => setForm(form === "amendment" ? "" : "amendment"), false, form === "amendment")}
      </div>

      {form === "point" && (
        <form className={r.form} onSubmit={(e) => { e.preventDefault(); void ask("point", { kind: point, text }, "Point raised"); }}>
          <div className="field">
            <label htmlFor="rq-pt">Point</label>
            <Select id="rq-pt" className="control" value={point} onChange={(e) => setPoint(e.target.value)}>{POINTS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}</Select>
          </div>
          <div className="field">
            <label htmlFor="rq-pt-t">What It Is About (optional)</label>
            <input id="rq-pt-t" className="control" value={text} maxLength={200} onChange={(e) => setText(e.target.value)} />
          </div>
          <Why why={busy && "Sending…"}><button type="submit" className="button block" disabled={busy}>Raise the Point</button></Why>
        </form>
      )}
      {form === "motion" && (
        <form className={r.form} onSubmit={(e) => { e.preventDefault(); if (!motionErr) void ask("motion", { kind: mk, topic, total: motion.total, per: motion.per }, "Motion proposed"); }}>
          <div className="field">
            <label htmlFor="rq-mk">Motion</label>
            <Select id="rq-mk" className="control" value={mk} onChange={(e) => setMk(e.target.value as ch.MotionKind)}>{kinds.map((k) => <option key={k} value={k}>{ch.MOTION_LABEL[k]}</option>)}</Select>
          </div>
          {mk === "mod" && <div className="field"><label htmlFor="rq-mt">Topic</label><input id="rq-mt" className="control" value={topic} maxLength={120} onChange={(e) => setTopic(e.target.value)} /></div>}
          {(mk === "mod" || mk === "unmod" || mk === "extend") && (
            <div className={r.two}>
              <div className="field"><label htmlFor="rq-mm">Minutes</label><input id="rq-mm" className="control" inputMode="decimal" value={mins} onChange={(e) => setMins(e.target.value)} /></div>
              {mk === "mod" && <div className="field"><label htmlFor="rq-mp">Seconds per Speaker</label><input id="rq-mp" className="control" inputMode="numeric" value={per} onChange={(e) => setPer(e.target.value)} /></div>}
            </div>
          )}
          {motionErr && <p className={s.hint}>{motionErr}</p>}
          <Why why={busy ? "Sending…" : motionErr}><button type="submit" className="button block" disabled={busy || !!motionErr}>Propose the Motion</button></Why>
        </form>
      )}
      {form === "amendment" && (
        <form className={r.form} onSubmit={(e) => { e.preventDefault(); if (text.trim() && (!c.tr || second)) void ask("amendment", { how, clause, text, seconder: second || null }, "Amendment handed in"); }}>
          <div className={r.two}>
            <div className="field">
              <label htmlFor="rq-ah">Kind</label>
              <Select id="rq-ah" className="control" value={how} onChange={(e) => setHow(e.target.value as ch.AmendHow)}>{(Object.keys(HOW_LABEL) as ch.AmendHow[]).map((k) => <option key={k} value={k}>{HOW_LABEL[k]}</option>)}</Select>
            </div>
            <div className="field"><label htmlFor="rq-ac">Clause</label><input id="rq-ac" className="control" value={clause} maxLength={40} placeholder="Operative clause 3" onChange={(e) => setClause(e.target.value)} /></div>
          </div>
          {c.tr && (
            <div className="field">
              <label htmlFor="rq-as">Seconded By</label>
              <Select id="rq-as" className="control" value={second} onChange={(e) => setSecond(e.target.value)}>
                <option value="">Choose a state…</option>
                {c.delegates.filter((d) => d.id !== me).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </Select>
            </div>
          )}
          <div className="field"><label htmlFor="rq-at">The Amendment</label><textarea id="rq-at" className="control" rows={3} value={text} maxLength={600} onChange={(e) => setText(e.target.value)} /></div>
          <Why why={busy ? "Sending…" : !text.trim() ? "Write the amendment first" : !!c.tr && !second && "Choose who seconds it"}><button type="submit" className="button block" disabled={busy || !text.trim() || (!!c.tr && !second)}>Hand In the Amendment</button></Why>
        </form>
      )}

      {signable.length > 0 && (
        <fieldset className={s.procedure}>
          <legend>Amendments You Can Sign</legend>
          <ul className={r.rows}>
            {signable.map((a) => (
              <li key={a.id}>
                <span className={r.rowMain}><strong>From {ch.nameOf(c, a.by)}{a.clause ? ` · ${a.clause}` : ""}</strong><small>{a.text}</small></span>
                <span className={r.rowBtns}><Why why={busy && "Sending…"}><button type="button" className="button secondary sm" disabled={busy} onClick={() => void ask("sign", { amendment: a.id }, "Asked to sign")}>Sign</button></Why></span>
              </li>
            ))}
          </ul>
        </fieldset>
      )}

      {asks.length > 0 && (
        <fieldset className={s.procedure}>
          <legend>Your Requests</legend>
          <ul className={r.rows}>
            {asks.map((a) => {
              const t = askText(c, { ...a, delegate_id: me });
              return (
                <li key={a.id}>
                  <span className={r.rowMain}><strong>{t.title.replace(/^Asks/, "Asked").replace(/^Proposes/, "Proposed").replace(/^Hands/, "Handed")}</strong>{t.detail && <small>{t.detail}</small>}</span>
                  <span className={r.rowBtns}>
                    <span className={s.chip} data-tone={ASK_STATUS[a.status][1]}>{ASK_STATUS[a.status][0]}</span>
                    {a.status === "open" && <button type="button" className="button secondary sm" onClick={() => void withdraw(a.id)}>Withdraw</button>}
                  </span>
                </li>
              );
            })}
          </ul>
        </fieldset>
      )}
    </section>
  );
}

/* Voting from your own device: the vote in hand (a motion, an amendment, the resolution) and the chairs' straw poll. */
function Vote({ c, cid, me, data, say, refresh }: { c: Chamber; cid: string; me: string; data: DelegateSync; say: (t: string) => void; refresh: () => void }) {
  const key = voteKey(c);
  const straw = data.room.straw ?? null;
  const [local, setLocal] = useState<Record<string, string>>({});
  const mine = (k: string) => local[k] ?? data.votes[k] ?? "";
  const here = ch.isHere(c, me);
  const cast = async (k: string, ballot: string) => {
    if (!supabase) return;
    const next = mine(k) === ballot ? "" : ballot;
    setLocal((v) => ({ ...v, [k]: next }));
    const { error } = await supabase.rpc("room_vote", { cid, vote_key: k, ballot: next });
    if (error) { say(error.message); setLocal((v) => { const o = { ...v }; delete o[k]; return o; }); }
    refresh();
  };
  // Present and Voting can't abstain on the resolution itself.
  const noAbstain = c.step === "vote" && !c.poll && c.roll[me] === "voting";
  return (
    <>
      <section className={`panel ${s.share}`} aria-labelledby="vt-h">
        <h2 id="vt-h" className={s.h2}>Vote</h2>
        {key ? (
          <>
            <p className={`serif ${r.nowBig}`}>{voteTitle(c)}</p>
            {!here ? <p className={s.hint}>Your state was marked absent at roll call, so it has no vote.</p> : (
              <div className={r.voteBtns} role="group" aria-label="Your vote">
                {([["for", "For"], ["against", "Against"], ["abstain", "Abstain"]] as const).map(([b, label]) => (
                  <Why key={b} why={b === "abstain" && noAbstain && "Present and Voting states can't abstain"}><button type="button" className="button secondary" aria-pressed={mine(key) === b} disabled={b === "abstain" && noAbstain} onClick={() => void cast(key, b)}>{label}</button></Why>
                ))}
              </div>
            )}
            <p className={s.hint}>{mine(key) ? "Your vote is in. Tap it again to take it back, or tap another to change it. The chairs record the result." : noAbstain ? "Your state is Present and Voting, so it votes For or Against." : "Tap your vote. The chairs see it and record the result."}</p>
          </>
        ) : <Empty title="Nothing to vote on yet" text="When the chairs put a motion, an amendment or the resolution to a vote, your ballot appears here." />}
      </section>
      {straw && (
        <section className={`panel ${s.share}`} aria-labelledby="vs-h">
          <h2 id="vs-h" className={s.h2}>Straw Poll{!straw.open && <span className={r.count}>Closed</span>}</h2>
          <p className={`serif ${r.nowBig}`}>{straw.q}</p>
          <div className={r.strawBtns} role="group" aria-label="Your answer">
            {straw.options.map((o, i) => <Why key={i} why={!straw.open && "The poll is closed"}><button type="button" className="button secondary" aria-pressed={mine(strawKey(straw)) === String(i)} disabled={!straw.open} onClick={() => void cast(strawKey(straw), String(i))}>{o}</button></Why>)}
          </div>
          <p className={s.hint}>A straw poll doesn&rsquo;t bind anyone. It shows the chairs where the room stands.</p>
        </section>
      )}
    </>
  );
}
