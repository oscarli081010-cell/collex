"use client";

import { useEffect, useState } from "react";
import * as ch from "@/lib/chamber";
import type { Chamber } from "@/lib/chamber";
import { supabase } from "@/lib/supabase";
import { ICONS } from "../IconButton";
import PanelTabs from "../PanelTabs";
import s from "../Chambers.module.css";
import Select from "../Select";
import Flag from "../Flag";
import { ArmedButton, Why } from "../RoomChair";
import { COPY, type Act, Stats } from "./shared";

const PER_PAGE = 10;
// The activity can be narrowed to what is worth looking at when marking; the three opening speeches and the closing ones are already in the table.
const FILTERS: ch.StatKind[] = ["speaker", "amender", "poi", "reply", "amendment"];

/* Analytics: what each state did and for how long, to help with marking. */
export function Analytics({ c, say, act, cloudId }: { c: Chamber; say: (t: string) => void; act: Act; cloudId?: string | null }) {
  const [tab, setTab] = useState<"states" | "activity" | "scores">("states");
  const [kind, setKind] = useState<"" | ch.StatKind>("");
  const [sat, setSat] = useState(0);
  const [aat, setAat] = useState(0);
  const t = c.tr;
  const name = (id: string) => ch.nameOf(c, id) || "A removed state";
  const roleOf = (id: string) => (["proposer", "seconder", "opposer"] as const).filter((k) => c.roles[k] === id).map((k) => ch.ROLE_LABEL[k]);
  const rows = ch.summary(c).sort((a, b) => b.secs - a.secs || b.speeches - a.speeches || a.name.localeCompare(b.name));
  const feed = [...c.stats].reverse().filter((x) => (!kind || x.kind === kind));
  const sPages = Math.max(1, Math.ceil(rows.length / PER_PAGE));
  const aPages = Math.max(1, Math.ceil(feed.length / PER_PAGE));
  const sp = Math.min(sat, sPages - 1);
  const ap = Math.min(aat, aPages - 1);
  const when = (t: number) => new Date(t).toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit", timeZone: "Australia/Sydney" });
  const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
  const csv = () => {
    const q = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const lines = [["Time", "State", "What", "Seconds", "With", "Resolution"].join(","), ...c.stats.map((x) => [when(x.at), q(name(x.who)), q(ch.statLabel(c, x.kind)), x.secs, q(x.with ? name(x.with) : ""), q(x.res)].join(","))];
    navigator.clipboard?.writeText(lines.join("\n")).then(() => say("Copied as CSV"), () => say("Couldn't copy"));
  };

  return (
    <section id="chv-panel-analytics" role="tabpanel" aria-labelledby="chv-tab-analytics" className={`panel ${s.log}`}>
      <div className={s.head}>
        <h2 className={s.h2}>Analytics</h2>
        <Why why={!c.stats.length && "Nothing recorded yet"}><button type="button" className={`button secondary ${s.csvBtn}`} onClick={csv} disabled={!c.stats.length}>{COPY}Copy as CSV</button></Why>
      </div>
      <PanelTabs idPrefix="cha" label="Analytics Views" tab={tab} setTab={setTab}
        tabs={[{ id: "states", label: "By State", icon: ICONS.chart }, { id: "activity", label: "Activity", icon: ICONS.clock }, { id: "scores", label: "Scores", icon: ICONS.verify }]} />
      {tab === "scores" ? <Scores c={c} act={act} cloudId={cloudId} say={say} /> : tab === "states" ? (
        <div id="cha-panel-states" role="tabpanel" aria-labelledby="cha-tab-states" className={s.panelBody}>
          <div className={s.tableWrap}>
            <table className={s.aTable}>
              <thead>
                <tr><th scope="col">State</th><th scope="col">Speeches</th><th scope="col">Speaking time</th><th scope="col">POI asked</th><th scope="col">POI answered</th><th scope="col">Amendments</th><th scope="col">Signed</th></tr>
              </thead>
              <tbody>
                {rows.slice(sp * PER_PAGE, (sp + 1) * PER_PAGE).map((r) => (
                  <tr key={r.id}>
                    <th scope="row">
                      <span className={s.aName}>{r.name}</span>
                      {roleOf(r.id).map((x) => <span key={x} className={s.pbadge}>{x}</span>)}
                    </th>
                    <td>{r.speeches}</td>
                    <td className="num">{ch.clock(r.secs * 1000)}</td>
                    <td>{r.asked}</td>
                    <td>{r.answered}</td>
                    <td>{r.amendments}</td>
                    <td>{r.signed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {sPages > 1 && <Pager at={sp} pages={sPages} go={setSat} label="By State Pages" />}
          {t && (() => {
            const rep = t.replies;
            return (
              <Stats label="Chair's Totals" items={[
                { label: "Motions Passed", value: t.motions.filter((m) => m.status === "passed").length, tone: "ok" },
                { label: "Motions Failed", value: t.motions.filter((m) => m.status === "failed").length, tone: "bad" },
                { label: "Rights of Reply", value: rep.length },
              ]} />
            );
          })()}
        </div>
      ) : (
        <div id="cha-panel-activity" role="tabpanel" aria-labelledby="cha-tab-activity" className={s.panelBody}>
          <div className="field">
            <label htmlFor="an-kind" className="sr-only">Show</label>
            <Select id="an-kind" className="control" value={kind} onChange={(e) => { setKind(e.target.value as "" | ch.StatKind); setAat(0); }}>
              <option value="">Everything</option>
              {FILTERS.map((k) => <option key={k} value={k}>{ch.statLabel(c, k)}</option>)}
            </Select>
          </div>
          {feed.length === 0 ? <p className={s.empty}>Nothing yet.</p> : (
            <ol className={s.entries}>
              {feed.slice(ap * PER_PAGE, (ap + 1) * PER_PAGE).map((x, i) => (
                <li key={`${x.at}-${i}`} className={s.statRow}>
                  <span className={s.statMain}>
                    <strong><Flag name={name(x.who)} size={18} />{name(x.who)}</strong>
                    <small>{ch.statLabel(c, x.kind)}{x.with ? (x.kind === "signatory" ? ` on ${name(x.with)}'s` : ` to ${name(x.with)}`) : ""} · {when(x.at)}</small>
                  </span>
                  <span className={`${s.statTime} num`}>{x.kind === "amendment" || x.kind === "signatory" ? "" : ch.clock(x.secs * 1000)}</span>
                </li>
              ))}
            </ol>
          )}
          {aPages > 1 && <Pager at={ap} pages={aPages} go={setAat} label="Activity Pages" />}
        </div>
      )}
    </section>
  );
}

/* The chairs' own marks for each state, out of 10 for each of four things. Only chairs see these. */
function Scores({ c, act, cloudId, say }: { c: Chamber; act: Act; cloudId?: string | null; say: (t: string) => void }) {
  const [open, setOpen] = useState<string | null>(null);
  const stats = new Map(ch.summary(c).map((r) => [r.id, r]));
  const rows = c.delegates.map((d) => ({ d, sc: ch.scoreOf(c, d.id), st: stats.get(d.id) }))
    .sort((a, b) => ch.scoreTotal(b.sc) - ch.scoreTotal(a.sc) || (b.st?.secs ?? 0) - (a.st?.secs ?? 0) || a.d.name.localeCompare(b.d.name));
  return (
    <div id="cha-panel-scores" role="tabpanel" aria-labelledby="cha-tab-scores" className={s.panelBody}>
      <div className={s.tableWrap}>
        <table className={s.aTable}>
          <thead>
            <tr><th scope="col">State</th>{ch.SCORE_KEYS.map((k) => <th key={k} scope="col">{ch.SCORE_LABEL[k]}</th>)}<th scope="col">Total</th><th scope="col">Speeches</th><th scope="col"><span className="sr-only">Mark</span></th></tr>
          </thead>
          <tbody>
            {rows.map(({ d, sc, st }) => (
              <tr key={d.id}>
                <th scope="row"><span className={s.aName}><Flag name={d.name} />{d.name}</span></th>
                {ch.SCORE_KEYS.map((k) => <td key={k}>{sc[k]}</td>)}
                <td><strong>{ch.scoreTotal(sc)}</strong> / 40</td>
                <td>{st?.speeches ?? 0}</td>
                <td><button type="button" className="button secondary sm" aria-expanded={open === d.id} onClick={() => setOpen(open === d.id ? null : d.id)}>{open === d.id ? "Done" : "Mark"}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {open && ch.has(c, open) && (() => {
        const sc = ch.scoreOf(c, open);
        return (
          <section className={`${s.procedure} ${s.scoreBox}`} aria-labelledby="sc-h">
            <h3 id="sc-h" className={s.h2}>Marks for {ch.nameOf(c, open)}</h3>
            <div className={s.scoreGrid}>
              {ch.SCORE_KEYS.map((k) => (
                <div className="field" key={k}>
                  <label htmlFor={`sc-${k}`}>{ch.SCORE_LABEL[k]} <span className="num">{sc[k]} / 10</span></label>
                  <input id={`sc-${k}`} type="range" min={0} max={10} step={1} value={sc[k]} onChange={(e) => act((x) => ch.setScore(x, open, { [k]: Number(e.target.value) }), false)} />
                </div>
              ))}
            </div>
            <div className="field">
              <label htmlFor="sc-note">Chair&rsquo;s Note</label>
              <textarea id="sc-note" className="control" rows={2} maxLength={400} defaultValue={sc.note} key={open} onBlur={(e) => { if (e.target.value !== sc.note) act((x) => ch.setScore(x, open, { note: e.target.value }), false); }} placeholder="What stood out" />
            </div>
          </section>
        );
      })()}
      {cloudId && <ReleaseMarks cid={cloudId} act={act} say={say} />}
    </div>
  );
}

/* For a committee linked to a conference: the chairs can release their marks, so each delegate sees their own mark
   (out of 10) and note, privately, on their account page. A copy is taken at that moment; it can be taken back. */
function ReleaseMarks({ cid, act, say }: { cid: string; act: Act; say: (t: string) => void }) {
  const [linked, setLinked] = useState(false);
  const [out, setOut] = useState<{ released_at: string | null; states: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const load = async () => {
    if (!supabase) return;
    const { data, error } = await supabase.rpc("marks_released", { cid });
    if (!error && data) setOut(data as { released_at: string | null; states: number });
  };
  useEffect(() => {
    if (!supabase) return;
    let live = true;
    supabase.rpc("chamber_link", { cid }).then(({ data }) => {
      if (!live) return;
      const ok = !!(data as { conference_id: string | null } | null)?.conference_id;
      setLinked(ok);
      if (ok) void load();
    });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cid]);
  if (!linked) return null;
  const released = !!out?.released_at;
  const fail = (code?: string) => say(code === "PGRST202" ? "Releasing marks isn't available yet." : "Couldn't do that. Try again.");
  const release = async () => {
    if (!supabase || busy) return;
    setBusy(true);
    await act((x) => x, false); // the latest marks reach the database first
    const { data, error } = await supabase.rpc("release_marks", { cid });
    setBusy(false);
    if (error) return fail(error.code);
    say(`Marks released to ${data as number} ${data === 1 ? "state" : "states"}.`);
    void load();
  };
  const withdraw = async () => {
    if (!supabase || busy) return;
    setBusy(true);
    const { error } = await supabase.rpc("withdraw_marks", { cid });
    setBusy(false);
    if (error) return fail(error.code);
    say("Marks taken back.");
    void load();
  };
  return (
    <section className={`${s.procedure} ${s.scoreBox}`} aria-labelledby="rm-h">
      <h3 id="rm-h" className={s.h2}>Release Marks to Delegates</h3>
      <p className={s.hint}>Each delegate sees only their own mark out of 10 and your note for them, privately on their account page. They&rsquo;re matched by their accepted application or their seat. No one sees anyone else&rsquo;s.</p>
      {released && <p className={s.hint} role="status">Released {new Date(out!.released_at!).toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" })} to {out!.states} {out!.states === 1 ? "state" : "states"}. Changes since then stay with the chairs until you release again.</p>}
      <ArmedButton className="button block" disabled={busy} label={released ? "Release the Latest Marks" : "Release Marks to Delegates"} again="Press Again to Release" onConfirm={() => void release()} />
      {released && <ArmedButton className="button secondary block" disabled={busy} label="Take Marks Back" again="Press Again to Take Them Back" onConfirm={() => void withdraw()} />}
    </section>
  );
}

function Pager({ at, pages, go, label }: { at: number; pages: number; go: (n: number) => void; label: string }) {
  return (
    <nav className={s.pager} aria-label={label}>
      <Why why={at === 0 && "You're on the first page"}><button type="button" className="button secondary" onClick={() => go(at - 1)} disabled={at === 0}>Previous</button></Why>
      <span className="muted" aria-live="polite">Page {at + 1} of {pages}</span>
      <Why why={at === pages - 1 && "You're on the last page"}><button type="button" className="button secondary" onClick={() => go(at + 1)} disabled={at === pages - 1}>Next</button></Why>
    </nav>
  );
}
