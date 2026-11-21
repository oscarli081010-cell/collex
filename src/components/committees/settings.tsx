"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import * as ch from "@/lib/chamber";
import type { Chamber } from "@/lib/chamber";
import { backgroundData, dataToBlob, uploadBackground, uploadBackgroundBlob } from "@/lib/photo";
import { supabase } from "@/lib/supabase";
import IconButton, { ICONS } from "../IconButton";
import s from "../Chambers.module.css";
import Select from "../Select";
import { CodeBoxes } from "../CodeInput";
import CoverFrame from "../CoverFrame";
import Flag from "../Flag";
import { Why } from "../RoomChair";
import { type OfflineState } from "../Offline";
import { COPY, SOUND_KEY, soundOn, chime, type Act, Duration, Seg } from "./shared";
import { ATTEND } from "./opening";

/* The given resolutions: set when the committee is made, and here they can be added or renamed until they are debated. */
export function Resolutions({ c, act }: { c: Chamber; act: Act }) {
  const t = c.tr!;
  const title = (slot: number) => t.docs.find((d) => d.id === `agenda${slot}`)?.title ?? "";
  const [vals, setVals] = useState<string[]>(() => ch.SLOTS.map((_, i) => title(i)));
  const key = ch.SLOTS.map((_, i) => title(i)).join("\u0001");
  useEffect(() => { setVals(ch.SLOTS.map((_, i) => title(i))); }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const locked = (slot: number) => { const d = t.docs.find((x) => x.id === `agenda${slot}`); return !!d && (!!d.result || t.current === d.id); };
  return (
    <section className={`panel ${s.list}`} aria-labelledby="rs-h">
      <div className={s.head}>
        <h2 id="rs-h" className={s.h2}>Resolutions</h2>
      </div>
      <div className={s.panelBody}>
        <div className={s.two} style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
          {ch.SLOTS.map((sl, i) => (
            <div className="field" key={i}>
              <label htmlFor={`rs-${i}`}>{sl.seen ? "Seen Resolution" : "Unseen Resolution"}</label>
              <input id={`rs-${i}`} className="control" value={vals[i] ?? ""} disabled={locked(i)} maxLength={160} placeholder="Title"
                onChange={(e) => setVals((v) => v.map((x, j) => (j === i ? e.target.value : x)))}
                onBlur={() => { if ((vals[i] ?? "").trim() !== title(i)) act((x) => ch.setAgenda(x, i, vals[i] ?? "")); }} />
            </div>
          ))}
        </div>
        <small className="muted">A resolution can be changed until it has been debated.</small>
      </div>
    </section>
  );
}

/* Settings: the chime when a speaker's time is up. Kept on this device only. */
/* The roll after roll call: a state that arrives late or leaves early is marked at any point, except while a vote is
   taken. A state can be renamed without losing anything. Trinity and Standard take the roll again for a new session. */
export function RollPanel({ c, act }: { c: Chamber; act: Act }) {
  const [who, setWho] = useState("");
  const [to, setTo] = useState("");
  const open = ch.rollOpen(c);
  const shut = !open && (c.poll ? "Not while a vote is being taken" : "Not while the vote is being taken");
  const n = ch.present(c);
  const renameWhy = !who ? "Choose a state first" : !to.trim() ? "Type the new name first" : ch.renameError(c, who, to);
  return (
    <>
    {ch.canRetakeRoll(c) && <button type="button" className="button secondary block" onClick={() => act((x) => ch.retakeRoll(x, ch.now()))}>Retake the Roll</button>}
    <details className={`panel ${s.list}`}>
      <summary className={s.head}>
        <h2 className={s.h2}>The Roll</h2>
        <span className="badge">{n} of {c.delegates.length} present</span>
      </summary>
      <div className={s.panelBody}>
        {shut && <p className={s.hint} role="status">{shut}: the roll can be changed once it is over.</p>}
        <ul className={s.ballots}>
          {c.delegates.map((d) => (
            <li key={d.id} className={s.ballot}>
              <span className={s.cname2}><Flag name={d.name} />{d.name}</span>
              <Seg label={`Roll: ${d.name}`} value={c.roll[d.id]} disabled={!open} className={`${s.ballotSeg} ${s.rollSeg}`}
                items={ATTEND.map((a) => ({ id: a, label: ch.ATTEND_LABEL[a] }))}
                onPick={(a) => act((x) => ch.markRoll(x, d.id, c.roll[d.id] === a ? null : a))} />
            </li>
          ))}
        </ul>
        <form className={s.addRow} onSubmit={(e) => { e.preventDefault(); if (renameWhy) return; act((x) => ch.renameDelegate(x, who, to)); setTo(""); setWho(""); }}>
          <label htmlFor="rp-who" className="sr-only">State to Rename</label>
          <Select id="rp-who" className={`control ${s.addWho}`} value={who} onChange={(e) => { setWho(e.target.value); setTo(ch.nameOf(c, e.target.value)); }}>
            <option value="">Rename a state…</option>
            {c.delegates.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </Select>
          <label htmlFor="rp-to" className="sr-only">New Name</label>
          <input id="rp-to" className="control" value={to} maxLength={60} onChange={(e) => setTo(e.target.value)} placeholder="New name" />
          <Why why={renameWhy}><button type="submit" className="button secondary" disabled={!!renameWhy}>Rename</button></Why>
        </form>
      </div>
    </details>
    </>
  );
}

/* The keys a chair can use on the console. None of them work while typing in a box. */
export function Shortcuts() {
  const rows: [string, string][] = [
    ["Space", "Start or pause the timer"],
    ["N", "Call the next speaker (or the proposer, co-sponsor or opposer at their turn)"],
    ["E", "End the speech"],
    ["Y", "Yield to the chair"],
    ["Ctrl or \u2318 Z", "Back one step (only your own)"],
  ];
  return (
    <section className={`panel ${s.share}`} aria-labelledby="st-keys">
      <h2 id="st-keys" className={s.h2}>Keyboard Shortcuts</h2>
      <dl className={s.keys}>
        {rows.map(([k, what]) => <div key={k}><dt><kbd>{k}</kbd></dt><dd>{what}</dd></div>)}
      </dl>
    </section>
  );
}

/* Whether this console will open without wifi. */
export function OfflineNote({ st }: { st: OfflineState }) {
  if (st === "none") return null;
  return (
    <section className={`panel ${s.share}`} aria-labelledby="st-offline">
      <h2 id="st-offline" className={s.h2}>Without Wifi</h2>
      <p className={s.hint} role="status" data-tone={st === "ready" ? "ok" : undefined}>
        {st === "ready" ? "Ready to work without wifi" : st === "checking" ? "Checking\u2026" : "Open this page once with wifi to use it offline"}
      </p>
    </section>
  );
}

export function Sound() {
  const [on, setOn] = useState(true);
  useEffect(() => { setOn(soundOn()); }, []);
  return (
    <section className={`panel ${s.share}`} aria-labelledby="st-sound">
      <h2 id="st-sound" className={s.h2}>Sound</h2>
      <label className="check">
        <input type="checkbox" checked={on} onChange={(e) => { setOn(e.target.checked); try { localStorage.setItem(SOUND_KEY, e.target.checked ? "on" : "off"); } catch { /* private window */ } if (e.target.checked) chime(true); }} />
        <span>Play a chime on this device when a speaker&rsquo;s time is up</span>
      </label>
    </section>
  );
}

/* Sounds on the display window, for the room: off unless the chair turns them on. Saved with the committee. */
export function DisplaySounds({ c, act }: { c: Chamber; act: Act }) {
  return (
    <section className={`panel ${s.share}`} aria-labelledby="st-dsound">
      <h2 id="st-dsound" className={s.h2}>Display Sounds</h2>
      <label className="check">
        <input type="checkbox" checked={!!c.chime?.end} onChange={(e) => act((x) => ch.setChime(x, "end", e.target.checked), false)} />
        <span>Chime at the End of a Speech, and again 10 seconds later</span>
      </label>
      <label className="check">
        <input type="checkbox" checked={!!c.chime?.warn} onChange={(e) => act((x) => ch.setChime(x, "warn", e.target.checked), false)} />
        <span>Warning Tone 10 Seconds Before the End</span>
      </label>
      <p className={s.hint}>The display plays these. Browsers need a click on the display before it can make a sound.</p>
    </section>
  );
}

/* Settings, 1: a photo behind the display. */
/* Settings: how long each kind of speech is, for the whole committee. The time the chair changes while someone is speaking is only for that speech. */
export function Times({ c, act }: { c: Chamber; act: Act }) {
  const t = !!c.tr;
  const rows: { k: ch.TimeKey; label: string; min: number; max: number }[] = [
    ...(t ? [{ k: "statement" as const, label: "Opening Statement", min: 5, max: 3600 }] : []),
    { k: "proposer", label: `Proposer, ${ch.roleName(c, "seconder")}, Opposer and Closing`, min: 5, max: 3600 },
    { k: "speaker", label: t ? "Speaker from the List" : "Speaker from the List", min: 5, max: 3600 },
    ...(t ? [{ k: "amendPer" as const, label: "Amendment Debate, per Speaker", min: 5, max: ch.TR.maxCaucus }, { k: "amendTotal" as const, label: "Amendment Debate, Total", min: 10, max: ch.TR.maxCaucus }] : [{ k: "amender" as const, label: "Amendment Proposer\u2019s Speech", min: 5, max: 3600 }]),
    { k: "poi", label: "Point of Information, Question and Reply", min: 5, max: 300 },
  ];
  const set = Object.keys(c.times ?? {}).length > 0;
  return (
    <section className={`panel ${s.share}`} aria-labelledby="st-times">
      <h2 id="st-times" className={s.h2}>Speaking Times</h2>
      <div className={s.timesAll}>
        <Duration id="tm-all" label="All Speeches" value={c.speakSecs} min={5} max={ch.TR.maxCaucus}
          onChange={(v, ok) => { if (ok && v !== null) act((x) => ch.setAllSpeeches(x, v)); }} />
      </div>
      <div className={s.timesGrid}>
        {rows.map((r) => (
          <Duration key={r.k} id={`tm-${r.k}`} label={r.label} value={ch.timeOf(c, r.k)} min={r.min} max={r.max}
            onChange={(v, ok) => { if (ok && v !== null) act((x) => (r.k === "proposer" ? ch.setTime(ch.setTime(ch.setTime(ch.setTime(x, "proposer", v), "seconder", v), "opposer", v), "closer", v) : ch.setTime(x, r.k, v))); }} />
        ))}
      </div>
      <Why why={!set && "Already using the standard times"}><button type="button" className="button secondary block" disabled={!set} onClick={() => act(ch.resetTimes)}>Use the Standard Times</button></Why>
    </section>
  );
}

export function Background({ c, act, say, userId }: { c: Chamber; act: Act; say: (t: string) => void; userId?: string }) {
  const [busy, setBusy] = useState(false);
  const [strength, setStrength] = useState(c.backgroundStrength);
  useEffect(() => { setStrength(c.backgroundStrength); }, [c.backgroundStrength]);
  const commit = () => { if (strength !== c.backgroundStrength) act((x) => ch.setBackgroundStrength(x, strength), false); };
  // Framing follows the drag here at once, and reaches the committee (and the display) once the drag pauses.
  const [at, setAt] = useState<[number, number]>(c.backgroundAt ?? [50, 50]);
  const atKey = (c.backgroundAt ?? [50, 50]).join();
  useEffect(() => { setAt(c.backgroundAt ?? [50, 50]); }, [atKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (at.join() === atKey) return;
    const t = setTimeout(() => act((v) => ch.setBackgroundAt(v, at[0], at[1]), false), 250);
    return () => clearTimeout(t);
  }, [at]); // eslint-disable-line react-hooks/exhaustive-deps

  const choose = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    // Logged in: the picture goes to Collex and the committee keeps its address. Not logged in: a smaller copy travels inside the committee.
    const r = userId ? await uploadBackground(file, userId) : await backgroundData(file);
    setBusy(false);
    if ("error" in r) { say(r.error); return; }
    const bg = "url" in r ? r.url : r.data;
    act((x) => ch.setBackground(x, bg), false);
  };

  return (
    <section className={`panel ${s.share}`} aria-labelledby="st-bg">
      <h2 id="st-bg" className={s.h2}>Display Background</h2>
      {c.background ? (
        <CoverFrame src={c.background} ratio={16 / 9} label="On the display" x={at[0]} y={at[1]} onChange={(x, y) => setAt([x, y])} />
      ) : <div className={s.bgPreview} data-empty><span>No photo</span></div>}
      <div className={s.bgActions} data-one={!c.background}>
        <label className={`button ${s.fileBtn}`} aria-disabled={busy}>
          {busy ? "Uploading…" : c.background ? "Change Photo" : "Choose a Photo"}
          <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={busy} onChange={(e) => { void choose(e.target.files?.[0]); e.target.value = ""; }} />
        </label>
        {c.background && <button type="button" className="button secondary" onClick={() => act((x) => ch.setBackground(x, null), false)}>Remove Photo</button>}
      </div>
      {c.background && (
        <div className={s.strength}>
          <div className={s.strengthHead}>
            <label htmlFor="st-str">Photo Strength</label>
            <output htmlFor="st-str" className="num">{strength}%</output>
          </div>
          <input id="st-str" type="range" min={20} max={100} step={5} value={strength} className={s.range} style={{ "--fill": `${((strength - 20) / 80) * 100}%` } as React.CSSProperties}
            onChange={(e) => setStrength(Number(e.target.value))} onPointerUp={commit} onKeyUp={commit} onBlur={commit} />
        </div>
      )}
    </section>
  );
}

type Member = { user_id: string; name: string; email: string; is_owner: boolean; role?: "owner" | "admin" | "chair" };
export const ROLE = { owner: "Owner", admin: "Admin", chair: "Chair" } as const;

// Who can run this committee. A committee kept in this browser can be shared, which moves it to Collex so the people
// added (by the email on their account) can open the console and the display from their own devices.
export function Share({ c, cloudId, manage, signedIn, meId, say, setLocal }: {
  c: Chamber; cloudId: string | null; manage: boolean; signedIn: boolean; meId?: string; say: (t: string) => void; setLocal: (c: Chamber | null) => void;
}) {
  const router = useRouter();
  const [team, setTeam] = useState<Member[] | null>(null);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const load = async () => {
    if (!cloudId || !supabase) return;
    const { data } = await supabase.rpc("chamber_team", { cid: cloudId });
    setTeam((data as Member[] | null) ?? []);
  };
  useEffect(() => { void load(); }, [cloudId]); // eslint-disable-line react-hooks/exhaustive-deps

  const share = async () => {
    if (!supabase) return;
    setBusy(true);
    // A background carried inside the committee is too big to keep in the shared copy: it goes to Collex and the address is kept instead.
    let initial = c;
    if (c.background?.startsWith("data:")) {
      const blob = dataToBlob(c.background);
      const up = blob && meId ? await uploadBackgroundBlob(blob, meId) : null;
      initial = { ...c, background: up && "url" in up ? up.url : null };
    }
    const { data, error } = await supabase.rpc("create_chamber", { initial });
    setBusy(false);
    if (error) { say(error.message); return; }
    setLocal(null);
    router.replace(`/chambers?c=${data}`);
    say("Committee shared");
  };
  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !cloudId || !email.trim()) return;
    setBusy(true);
    const typed = email.trim();
    // The database answers the same whether or not the email has an account, so nothing it returns is shown.
    const { error } = await supabase.rpc("add_chamber_member", { cid: cloudId, invitee_email: typed });
    setBusy(false);
    if (error) { say(error.message); return; }
    setEmail("");
    say(`If ${typed} has a Collex account, they've been added.`);
    supabase.functions.invoke("chamber-invite").catch(() => {});
    void load();
  };
  const [code, setCode] = useState<string | null>(null);
  useEffect(() => {
    if (!cloudId || !supabase) return;
    supabase.rpc("chamber_code", { cid: cloudId, action: "get" }).then(({ data }) => setCode((data as string | null) ?? null));
  }, [cloudId]);
  const codeDo = async (action: "new" | "off") => {
    if (!supabase || !cloudId) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("chamber_code", { cid: cloudId, action });
    setBusy(false);
    if (error) { say(error.message); return; }
    setCode((data as string | null) ?? null);
    say(action === "off" ? "Join code turned off" : "New join code made");
  };
  const copy = (text: string, done: string) => navigator.clipboard?.writeText(text).then(() => say(done), () => say("Couldn't copy"));
  const drop = async (target: string) => {
    if (!supabase || !cloudId) return;
    const { error } = await supabase.rpc("remove_chamber_member", { cid: cloudId, target });
    if (error) say(error.message); else void load();
  };

  return (
    <>
    <section id="ch-share" className={`panel ${s.share}`} aria-labelledby="st-share">
      <h2 id="st-share" className={s.h2}>{cloudId ? "People" : "Share"}</h2>
      {!cloudId ? (
        <>
          <p className="muted">Share this committee to give other chairs a join code, or add them by the email on their Collex account.</p>
          {signedIn
            ? <Why why={busy && "Sharing…"}><button type="button" className="button block" onClick={share} disabled={busy}>Share This Committee</button></Why>
            : <Link href="/login" className="button block">Log in to Share</Link>}
        </>
      ) : (
        <>
          <ul className={s.team}>
            {(team ?? []).map((m) => {
              const r = m.role ?? (m.is_owner ? "owner" : "chair");
              return (
                <li key={m.user_id}>
                  <span className={s.tname}>{m.name || m.email}{m.user_id === meId && " (you)"}</span>
                  <span className={`badge${r === "admin" ? " accent" : ""}`} title={r === "admin" ? "A Collex admin. Can do everything the owner can, and doesn't take one of the 10 places." : undefined}>{ROLE[r]}</span>
                  {/* An admin leaves on their own, from the Admin page or with Leave; nobody else removes them. */}
                  {manage && r === "chair" ? <IconButton label={`Remove ${m.name || m.email}`} icon={ICONS.close} onClick={() => drop(m.user_id)} /> : manage ? <span className={s.teamGap} aria-hidden="true" /> : null}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
    {cloudId && (
      <div className={s.pair2}>
          <section className={`panel ${s.share}`} aria-labelledby="st-code">
            <h2 id="st-code" className={s.h2}>Join Code</h2>
            {code ? (
              <>
                <CodeBoxes code={code} label="Join code" />
                <p className="muted">Other chairs go to Committees, choose Join, and type this code. They need to be logged in.</p>
                <div className={s.codeActions}>
                  <button type="button" className="button secondary" onClick={() => copy(code, "Code copied")}>{COPY}Copy Code</button>
                  <button type="button" className="button secondary" onClick={() => copy(`${location.origin}/chambers?join=${code}`, "Link copied")}>{COPY}Copy Link</button>
                  {manage && <Why why={busy && "Saving…"}><button type="button" className="button secondary" disabled={busy} onClick={() => codeDo("new")}>New Code</button></Why>}
                  {manage && <Why why={busy && "Saving…"}><button type="button" className="button secondary" disabled={busy} onClick={() => codeDo("off")}>Turn Off</button></Why>}
                </div>
              </>
            ) : manage ? (
              <>
                <Why why={busy && "Saving…"}><button type="button" className="button block" disabled={busy} onClick={() => codeDo("new")}>Make a Join Code</button></Why>
              </>
            ) : <p className="muted">There is no join code. The person who shared it can make one.</p>}
          </section>
          <section className={`panel ${s.share}`} aria-labelledby="st-email">
            <h2 id="st-email" className={s.h2}>Add by Email</h2>
          {manage ? (<>
            <form className={s.addRow2} onSubmit={add}>
              <label htmlFor="ch-inv" className="sr-only">Email on Their Collex Account</label>
              <input id="ch-inv" type="email" className="control" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email on their Collex account" maxLength={254} />
              <Why why={busy ? "Saving…" : !email.trim() && "Type their email first"}><button type="submit" className="button secondary" disabled={busy || !email.trim()}>Add</button></Why>
            </form>
          </>) : <p className="muted">Only the person who shared it can add people.</p>}
          </section>
      </div>
    )}
    </>
  );
}
