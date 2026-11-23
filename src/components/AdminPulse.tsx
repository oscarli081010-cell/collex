"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Placard } from "./Drawings";
import Select from "./Select";
import { RowsSkeleton } from "./Skeleton";
import chart from "./InterestChart.module.css";
import b from "./board.module.css";
import s from "@/app/admin.module.css";
import p from "./AdminPulse.module.css";

type Day = { day: string; views: number; visits: number };
type PageRow = { path: string; views: number; visits: number };
type Hits = { days: Day[]; pages: PageRow[] };
export type ClientError = { id: number; message: string; path: string; stack: string; agent: string; count: number; first_at: string; last_at: string };

const PERIODS = [7, 30, 90];
const short = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("en-AU", { day: "numeric", month: "short" });
const sydney = (iso: string) => new Date(iso).toLocaleString("en-AU", { timeZone: "Australia/Sydney", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

// "Chrome 126 on Mac" from the long browser string. Order matters: Edge, Opera and Chrome on iPhone all also say "Chrome" or "Safari".
function browser(ua: string) {
  const find = (re: RegExp) => ua.match(re)?.[1]?.split(".")[0];
  const name = /Edg\/(\S+)/.test(ua) ? `Edge ${find(/Edg\/(\S+)/)}`
    : /OPR\/(\S+)/.test(ua) ? `Opera ${find(/OPR\/(\S+)/)}`
    : /(?:CriOS|Chrome)\/(\S+)/.test(ua) ? `Chrome ${find(/(?:CriOS|Chrome)\/(\S+)/)}`
    : /(?:FxiOS|Firefox)\/(\S+)/.test(ua) ? `Firefox ${find(/(?:FxiOS|Firefox)\/(\S+)/)}`
    : /Version\/(\S+).*Safari/.test(ua) ? `Safari ${find(/Version\/(\S+)/)}`
    : ua ? ua.slice(0, 24) : "Unknown";
  const os = /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /Mac OS X/.test(ua) ? "Mac" : /CrOS/.test(ua) ? "ChromeOS" : /Linux/.test(ua) ? "Linux" : "";
  return os ? `${name} on ${os}` : name;
}

function Unset({ what }: { what: string }) {
  return (
    <div className={b.empty}>
      <Placard />
      <p className={b.emptyTitle}>{what} Aren&apos;t Set Up Yet</p>
      <span className="muted">Apply database migration 0032 (supabase/migrations/0032_pulse.sql), then reload this page.</span>
    </div>
  );
}

/** Visits and page views, counted without cookies or anything that identifies a person: figures, a bar chart by day, and the busiest pages. */
export function AdminVisitors() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Hits | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    let stale = false;
    supabase.rpc("admin_hits", { days }).then(({ data: d, error }) => {
      if (stale) return;
      setFailed(!!error);
      setData(error ? null : (d as Hits));
    });
    return () => { stale = true; };
  }, [days]);

  if (failed) return <Unset what="Visitor Counts" />;
  if (!data) return <RowsSkeleton rows={3} height={72} />;

  const views = data.days.reduce((n, d) => n + d.views, 0);
  const visits = data.days.reduce((n, d) => n + d.visits, 0);
  const max = Math.max(1, ...data.days.map((d) => d.visits));
  const n = data.days.length;
  const picker = (
    <div className={s.searchBar}>
      <Select className="control" aria-label="Period" value={String(days)} onChange={(e) => setDays(Number(e.target.value))}>
        {PERIODS.map((k) => <option key={k} value={k}>Last {k} days</option>)}
      </Select>
    </div>
  );
  if (views === 0) {
    return (
      <>
        {picker}
        <div className={b.empty}><Placard /><p className={b.emptyTitle}>No visits counted yet</p></div>
      </>
    );
  }
  return (
    <>
      {picker}
      <dl className={p.figures}>
        <div className={p.figure}><dd><b>{visits}</b></dd><dt>Visits</dt></div>
        <div className={p.figure}><dd><b>{views}</b></dd><dt>Page Views</dt></div>
        <div className={p.figure}><dd><b>{visits ? (views / visits).toFixed(1) : "0"}</b></dd><dt>Views per Visit</dt></div>
      </dl>
      <figure className={`${chart.chart} ${p.chartWrap}`}>
        <div className={chart.bars} aria-hidden="true" style={{ gridTemplateColumns: `repeat(${n}, 1fr)`, height: 120, gap: n > 31 ? 2 : 6 }}>
          {data.days.map((d) => (
            <span key={d.day} className={`${chart.bar} ${p.bar}`} data-empty={d.visits === 0} style={{ "--h": `${Math.round((d.visits / max) * 100)}%`, "--i": 0 } as React.CSSProperties} title={`${short(d.day)}: ${d.visits} ${d.visits === 1 ? "visit" : "visits"}`} />
          ))}
        </div>
        <div className={chart.axis} aria-hidden="true"><span>{short(data.days[0].day)}</span><span>Today</span></div>
        <table className="sr-only">
          <caption>Visits by day</caption>
          <thead><tr><th scope="col">Day</th><th scope="col">Visits</th></tr></thead>
          <tbody>{data.days.map((d) => <tr key={d.day}><td>{short(d.day)}</td><td>{d.visits}</td></tr>)}</tbody>
        </table>
      </figure>
      <div className={s.tableWrap}>
        <table className={s.table}>
          <thead><tr><th>Page</th><th className={p.num}>Views</th><th className={p.num}>Visits</th></tr></thead>
          <tbody>
            {data.pages.map((r) => (
              <tr key={r.path}>
                <td className={p.page}>{r.path}</td>
                <td className={p.num}>{r.views}</td>
                <td className={p.num}>{r.visits}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/** Faults the site's pages reported, newest first, with the stack folded away and a two-click clear. */
// What an error means, in plain words, for the kinds that come up. Anything else shows its own message.
const KINDS: [RegExp, string][] = [
  [/React error #418|React error #423|React error #425|Hydration failed|didn.t match the client/i, "The page drew a little differently in the visitor’s browser than on the server, so the browser redrew it. Visitors don’t see anything wrong."],
  [/ChunkLoadError|Failed to load chunk|Loading chunk|Loading CSS chunk/i, "A visitor had the page open while a new version of Collex went live, so a piece of the old version was gone. Reloading the page fixes it, and nothing needs doing."],
  [/Failed to fetch|NetworkError|Load failed|network error/i, "The visitor’s internet dropped while the page was loading something. Nothing needs doing."],
  [/ResizeObserver loop/i, "A harmless browser warning about layout. Nothing needs doing."],
  [/Minified React error #\d+/i, "Something on this page broke while it was being drawn. The technical details say where."],
];
const meaning = (message: string) => KINDS.find(([re]) => re.test(message))?.[1];

export function AdminErrors({ errors, error, say, reload, query }: { errors: ClientError[]; error: boolean; say: (t: string) => void; reload: () => void; query: string }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => { if (!armed) return; const t = setTimeout(() => setArmed(false), 3000); return () => clearTimeout(t); }, [armed]);

  if (error) return <Unset what="Error Reports" />;
  if (errors.length === 0) return <div className={b.empty}><Placard /><p className={b.emptyTitle}>No errors reported</p></div>;
  const q = query.trim().toLowerCase();
  const shown = errors.filter((e) => !q || `${e.message} ${e.path}`.toLowerCase().includes(q));

  const clear = async () => {
    if (!armed) return setArmed(true);
    setArmed(false);
    const { error: e } = await supabase!.rpc("admin_clear_errors");
    if (e) return say("That didn't clear. Try again.");
    say("Errors cleared");
    reload();
  };
  return (
    <>
      <div className={p.toolbar}>
        <p className={p.intro}>Problems visitors’ browsers ran into on Collex, grouped by kind. Most need nothing doing. Clear them once you’ve read them.</p>
        <button type="button" className={`button secondary ${p.danger}`} data-armed={armed || undefined} onClick={clear}>{armed ? "Click Again to Clear" : "Clear the Errors"}</button>
      </div>
      {shown.length === 0 ? (
        <div className={b.empty}><Placard /><p className={b.emptyTitle}>No matches</p></div>
      ) : (
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead><tr><th>Error</th><th>Page</th><th className={p.num}>Times</th><th>Last Seen</th><th>Browser</th></tr></thead>
            <tbody>
              {shown.map((e) => (
                <tr key={e.id}>
                  <td>
                    <span className={p.msg}>{meaning(e.message) ?? e.message}</span>
                    {(meaning(e.message) || e.stack) && (
                      <details className={p.details}>
                        <summary>Technical Details</summary>
                        <pre className={p.stack}>{meaning(e.message) ? `${e.message}${e.stack ? `\n\n${e.stack}` : ""}` : e.stack}</pre>
                      </details>
                    )}
                  </td>
                  <td className={p.page}>{e.path}</td>
                  <td className={p.num}>{e.count}</td>
                  <td className={p.when}>{sydney(e.last_at)}</td>
                  <td className={p.when}>{browser(e.agent)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
