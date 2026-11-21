"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import * as ch from "@/lib/chamber";
import type { Chamber } from "@/lib/chamber";
import { supabase } from "@/lib/supabase";
import { ICONS } from "../IconButton";
import PageBand from "../PageBand";
import { GROUPS } from "@/lib/groups";
import PanelTabs from "../PanelTabs";
import s from "../Chambers.module.css";
import Select from "../Select";
import CodeInput from "../CodeInput";
import { Gavel } from "../Drawings";
import board from "../board.module.css";
import { STEP, ago, procName } from "@/lib/chamberLabels";
import Flag from "../Flag";
import { Why } from "../RoomChair";
import { ROLE } from "./settings";
import { STACK, uid, Duration, Seg } from "./shared";

/* Join a shared committee by the code its chair gives out. */
function Join({ signedIn, initial }: { signedIn: boolean; initial: string }) {
  const router = useRouter();
  const [code, setCode] = useState(initial.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [wrong, setWrong] = useState(0);
  const join = async (typed = code) => {
    if (!supabase || typed.length !== 6 || busy) return;
    setBusy(true); setErr("");
    const { data, error } = await supabase.rpc("join_chamber", { code: typed });
    setBusy(false);
    if (error) { setErr(error.message); setWrong((n) => n + 1); return; }
    if (!data) {
      // Not a chairs' code: it may be a delegates' one, which leads to choosing a state.
      const seat = await supabase.rpc("room_peek", { code: typed });
      if (seat.data) { router.push(`/chambers/room?join=${typed}`); return; }
      setErr(seat.error?.message ?? "No committee has that code. Check it with the chair."); setWrong((n) => n + 1); return;
    }
    router.push(`/chambers?c=${data}`);
  };
  return (
    <div id="cs-panel-join" role="tabpanel" aria-labelledby="cs-tab-join" className={s.setupStack}>
      <section className={`panel ${s.setupCard}`} aria-label="Join a Committee">
        {signedIn ? (
          <form className={s.joinForm} onSubmit={(e) => { e.preventDefault(); void join(); }}>
            <div className="field">
              <span id="cs-join-l">Join Code</span>
              <CodeInput letters stretch initial={initial} label="Join code" errors={wrong} disabled={busy}
                onChange={(v) => { setCode(v); if (v) setErr(""); }} onComplete={(v) => void join(v)} />
              <small className={s.codeNote}><span className={s.req} aria-hidden="true">*</span> Chairs and delegates each have their own code.</small>
            </div>
            <Why why={busy ? "Joining…" : code.length !== 6 && "Type the 6-character code"}><button type="submit" className="button lg block" disabled={busy || code.length !== 6}>{busy ? "Joining…" : "Join Committee"}</button></Why>
          </form>
        ) : (
          <div className={s.joinForm}>
            <div className="field">
              <span>Join Code</span>
              <small>Log in, then type the six characters from the chair running the committee.</small>
            </div>
            <Link href={`/login?next=${encodeURIComponent(code ? `/chambers?join=${code}` : "/chambers?join=")}`} className="button lg block">Log in to Join</Link>
          </div>
        )}
        {err && <p className={s.result} data-pass="false" role="alert">{err}</p>}
      </section>
    </div>
  );
}

type Mine = {
  id: string; name: string; is_owner: boolean; owner_name: string; updated_at?: string;
  role?: "owner" | "admin" | "chair"; topic?: string; rules?: string; step?: string; delegates?: number; members?: number;
};

/* Every committee you can open: the ones you started, and the ones shared with you. */
type SeatRow = { id: string; name: string; topic: string; delegate: string; updated_at: string };
function Yours({ signedIn, mine, seats, local }: { signedIn: boolean; mine: Mine[] | null; seats: SeatRow[] | null; local: Chamber | null }) {
  const router = useRouter();
  const started = (mine ?? []).filter((m) => m.is_owner);
  const shared = (mine ?? []).filter((m) => !m.is_owner);
  const card = (m: Mine) => {
    const r = m.role ?? (m.is_owner ? "owner" : "chair");
    const facts = [procName(m.rules), m.step ? STEP[m.step] ?? m.step : "", m.delegates != null ? `${m.delegates} ${m.delegates === 1 ? "state" : "states"}` : "",
      m.members != null ? `${m.members + 1} ${m.members === 0 ? "person" : "people"}` : "", m.updated_at ? `Updated ${ago(m.updated_at).replace(/^Just now$/, "just now")}` : ""].filter(Boolean);
    return (
      <li key={m.id}>
        <button type="button" className={s.yourCard} onClick={() => router.push(`/chambers?c=${m.id}`)}>
          <span className={s.yourTop}>
            <span className={s.yourName}>{m.name}</span>
            <span className={`badge${r === "admin" ? " accent" : ""}`}>{ROLE[r]}</span>
          </span>
          {m.topic ? <span className={s.yourTopic}>{m.topic}</span> : null}
          <span className={s.yourFacts}>{facts.map((f) => <span key={f}>{f}</span>)}</span>
          {!m.is_owner && <small>Run by {m.owner_name}</small>}
        </button>
      </li>
    );
  };
  const group = (id: string, title: string, list: Mine[], emptyTitle: string, emptyText: string) => (
    <section className={`panel ${s.setupCard}`} aria-labelledby={id}>
      <h2 id={id} className={s.groupLabel}>{title}{list.length > 0 && <span className={s.count}>{list.length}</span>}</h2>
      {list.length ? <ul className={s.mine}>{list.map(card)}</ul> : (
        <div className={`${board.empty} ${s.emptyCard}`}>
          <Gavel />
          <p className={board.emptyTitle}>{emptyTitle}</p>
          <p className="muted">{emptyText}</p>
        </div>
      )}
    </section>
  );
  return (
    <div id="cs-panel-yours" role="tabpanel" aria-labelledby="cs-tab-yours" className={s.setupStack}>
      {local && (
        <section className={`panel ${s.setupCard}`} aria-labelledby="cs-local">
          <h2 id="cs-local" className={s.groupLabel}>Open in This Browser</h2>
          <ul className={s.mine}>
            <li>
              <button type="button" className={s.yourCard} onClick={() => router.push("/chambers")}>
                <span className={s.yourTop}><span className={s.yourName}>{local.name}</span><span className="badge">This browser</span></span>
                {local.topic ? <span className={s.yourTopic}>{local.topic}</span> : null}
                <span className={s.yourFacts}>{[ch.procedureName(local), ch.substep(local), `${local.delegates.length} ${local.delegates.length === 1 ? "state" : "states"}`].map((f) => <span key={f}>{f}</span>)}</span>
              </button>
            </li>
          </ul>
        </section>
      )}
      {!signedIn ? (
        <section className={`panel ${s.setupCard}`}>
          <div className={`${board.empty} ${s.emptyCard}`}>
            <Gavel />
            <p className={board.emptyTitle}>Log in to see your committees</p>
            <p className="muted">Committees you share, and ones other chairs share with you, are kept on your Collex account.</p>
            <Link href="/login?next=%2Fchambers%3Ftab%3Dyours" className="button">Log In</Link>
          </div>
        </section>
      ) : mine === null ? (
        <section className={`panel ${s.setupCard}`}><p className="muted">Loading…</p></section>
      ) : (<>
        {group("cs-started", "Started by You", started, "Nothing started yet", "Committees you start appear here, on any device you log in on.")}
        {group("cs-shared", "Shared with You", shared, "Nothing shared yet", "When a chair adds you or you join with a code, the committee appears here.")}
        {seats && seats.length > 0 && (
          <section className={`panel ${s.setupCard}`} aria-labelledby="cs-seats">
            <h2 id="cs-seats" className={s.groupLabel}>Joined as a Delegate<span className={s.count}>{seats.length}</span></h2>
            <ul className={s.mine}>
              {seats.map((m) => (
                <li key={m.id}>
                  <button type="button" className={s.yourCard} onClick={() => router.push(`/chambers/room?c=${m.id}`)}>
                    <span className={s.yourTop}><span className={s.yourName}>{m.name}</span><span className="badge"><Flag name={m.delegate} size={16} />{m.delegate || "Delegate"}</span></span>
                    {m.topic ? <span className={s.yourTopic}>{m.topic}</span> : null}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </>)}
    </div>
  );
}

type Proc = "evatt" | "trinity" | "standard" | "custom";
const PROC_LABEL: Record<Proc, string> = { evatt: "Evatt", trinity: "Trinity Grammar MUN", standard: "Standard", custom: "Custom" };

export function Setup({ onCreate, signedIn, local }: { onCreate: (c: Chamber, devices: boolean) => void; signedIn: boolean; /** The committee kept in this browser, when the home is opened beside it. */ local: Chamber | null }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [resolution, setResolution] = useState("");
  const [speak, setSpeak] = useState<number | null>(120);
  const [speakOk, setSpeakOk] = useState(true);
  const [proc, setProc] = useState<Proc>("evatt");
  const [pass, setPass] = useState<"simple" | "twothirds">("simple");
  const [devices, setDevices] = useState(false);
  const [seats, setSeats] = useState<SeatRow[] | null>(null);
  const [text, setText] = useState("");
  const [res, setRes] = useState(["", ""]); // the committee's resolutions: the seen one, then the unseen one
  const [mine, setMine] = useState<Mine[] | null>(null);
  const params = useSearchParams();
  const joinQ = params.get("join");
  const [tab, setTab] = useState<"start" | "join" | "yours">(joinQ !== null ? "join" : params.get("tab") === "yours" ? "yours" : "start");
  const names = ch.parseNames(text);
  const ok = name.trim().length >= 2 && resolution.trim().length >= 2 && (proc !== "trinity" || res.every((r) => r.trim().length >= 2)) && speakOk && speak !== null && names.length > 0;
  const why = !signedIn ? "Log in to start a committee" : name.trim().length < 2 ? "Name the committee"
    : resolution.trim().length < 2 ? (proc !== "evatt" ? "Add the topic" : "Add the resolution")
    : proc === "trinity" && !res.every((r) => r.trim().length >= 2) ? "Add both resolutions"
    : !speakOk || speak === null ? "Fix the speaking time" : names.length === 0 ? "Add the member states" : null;

  useEffect(() => {
    if (!signedIn || !supabase) return;
    let live = true;
    supabase.rpc("my_chambers").then(({ data }) => { if (live) setMine((data as Mine[] | null) ?? []); });
    supabase.rpc("my_seats").then(({ data }) => { if (live) setSeats((data as SeatRow[] | null) ?? []); });
    return () => { live = false; };
  }, [signedIn]);

  return (
    <main id="top" className={`container ${s.setup}`}>
      <PageBand title="Committees" />
      <div className={s.setupStack}>
        <PanelTabs idPrefix="cs" label="Committees" tab={tab} setTab={setTab}
          tabs={[{ id: "start", label: "Start a Committee", icon: ICONS.manage }, { id: "join", label: "Join a Committee", icon: ICONS.share }, { id: "yours", label: "Your Committees", icon: STACK }]} />
        {tab === "join" ? <Join signedIn={signedIn} initial={joinQ ?? ""} /> : tab === "yours" ? <Yours signedIn={signedIn} mine={mine} seats={seats} local={local} /> : !signedIn ? (
          <section className={`panel ${s.setupCard}`}>
            <div className={`${board.empty} ${s.emptyCard}`}>
              <Gavel />
              <p className={board.emptyTitle}>Log in to start a committee</p>
              <p className="muted">Committees are run from a free Collex account, so yours is kept and can be shared with your co-chairs.</p>
              <div className="btnStack">
                <Link href="/login?next=%2Fchambers" className="button">Log In</Link>
                <Link href="/signup" className="button secondary">Create an Account</Link>
              </div>
            </div>
          </section>
        ) : <>
        <form className={`panel ${s.setupCard}`} onSubmit={(e) => { e.preventDefault(); if (!ok || speak === null) return; const ids = names.map(uid); onCreate(proc === "trinity" ? ch.createTrinity(name, resolution, speak, names, ids, res.map((title, i) => ({ title, week: 1 as const, seen: i === 0 }))) : proc === "standard" ? ch.createStandard(name, resolution, speak, names, ids) : proc === "custom" ? ch.createStandard(name, resolution, speak, names, ids, [], { pass }) : ch.create(name, resolution, speak, names, ids), devices); if (signedIn && supabase) void supabase.rpc("note_chamber_started", { label: name, procedure: PROC_LABEL[proc] }); }}>
          <div className={s.two}>
            <div className="field">
              <label htmlFor="cs-proc">Procedure</label>
              <Select id="cs-proc" className="control" value={proc} onChange={(e) => { const v = e.target.value as Proc; setProc(v); setSpeak(v === "evatt" ? 120 : 60); setSpeakOk(true); }}>
                {(Object.keys(PROC_LABEL) as Proc[]).map((k) => <option key={k} value={k}>{PROC_LABEL[k]}</option>)}
              </Select>
            </div>
            {proc === "custom" && (
              <div className="field">
                <label htmlFor="cs-pass">A Resolution Passes With</label>
                <Select id="cs-pass" className="control" value={pass} onChange={(e) => setPass(e.target.value as "simple" | "twothirds")}>
                  <option value="simple">More For than Against</option>
                  <option value="twothirds">Two-thirds of the votes cast</option>
                </Select>
              </div>
            )}
          </div>
          <div className={s.two}>
            <div className="field">
              <label htmlFor="cs-name">Committee</label>
              <input id="cs-name" className="control" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required list={proc !== "evatt" ? "cs-committees" : undefined} />
              {proc !== "evatt" && <datalist id="cs-committees">{["Security Council", "SPECPOL", "DISEC", "SOCHUM"].map((n) => <option key={n} value={n} />)}</datalist>}
            </div>
            <Duration key={proc} id="cs-sp" label={proc !== "evatt" ? "Time per speaker" : "Speaking time"} value={proc !== "evatt" ? 60 : 120} min={5} max={3600} onChange={(v, good) => { setSpeak(v); setSpeakOk(good); }} />
          </div>
          <div className="field">
            <label htmlFor="cs-res">{proc !== "evatt" ? "Topic" : "Resolution"}</label>
            <input id="cs-res" className="control" value={resolution} onChange={(e) => setResolution(e.target.value)} maxLength={160} required />
          </div>
          {proc === "trinity" && (
            <div className={s.two} style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
              {["Seen Resolution", "Unseen Resolution"].map((label, i) => (
                <div className="field" key={i}>
                  <label htmlFor={`cs-r${i}`}>{label}</label>
                  <input id={`cs-r${i}`} className="control" value={res[i]} onChange={(e) => setRes((r) => r.map((v, j) => (j === i ? e.target.value : v)))} maxLength={160} placeholder="Title" required />
                </div>
              ))}
            </div>
          
          )}
          <div className="field">
            <label htmlFor="cs-names">Member States</label>
            <textarea id="cs-names" className="control" value={text} onChange={(e) => setText(e.target.value)} rows={8} placeholder="One per line, or separated by commas" />
            {names.length > 0 && <small>{names.length} {names.length === 1 ? "state" : "states"}</small>}
          </div>
          <div className="field">
              <Select id="cs-group" className="control" value="" aria-label="Add a group of member states" onChange={(e) => {
              const g = GROUPS.find((x) => x.name === e.target.value);
              if (!g) return;
              const have = new Set(ch.parseNames(text).map((n) => n.toLowerCase()));
              const add = g.states.filter((n) => ![...have].some((h) => ch.sameName(h, n)));
              setText((v) => [v.trim(), ...add].filter(Boolean).join("\n"));
            }}>
              <option value="">Add a Group…</option>
              {GROUPS.map((g) => <option key={g.name} value={g.name}>{g.name} · {g.states.length}</option>)}
            </Select>
          </div>
          <div className="field">
            <span id="sc-dev">Delegates Follow</span>
            <Seg label="How delegates follow the committee" value={devices ? "on" : "off"} className={s.sideSeg} onPick={(v) => setDevices(v === "on")}
              items={[{ id: "off", label: "On the Display" }, { id: "on", label: "On Their Own Devices" }]} />
            <small aria-live="polite">{devices ? "Delegates get a code to follow, ask for the floor, vote and pass notes." : "No phones or laptops needed."}</small>
          </div>
          <Why why={why}><button type="submit" className="button lg block" disabled={!!why}>Open Committee</button></Why>
        </form>
        <section className={`panel ${s.setupCard}`} aria-labelledby="cs-practice">
          <h2 id="cs-practice" className={s.h2}>Try a Practice Committee</h2>
          <p className="muted">A practice run with a sample topic and 12 member states, in the {PROC_LABEL[proc]} procedure chosen above. It counts as one of your committees.</p>
          <button type="button" className="button secondary block" onClick={() => { onCreate(ch.createPractice(proc, Array.from({ length: ch.PRACTICE.states.length }, () => uid()), pass), false); if (supabase) void supabase.rpc("note_chamber_started", { label: ch.PRACTICE.name, procedure: PROC_LABEL[proc] }); }}>Try a Practice Committee</button>
        </section>
        </>}
      </div>
    </main>
  );
}
