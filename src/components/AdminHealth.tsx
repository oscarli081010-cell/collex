"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Placard } from "./Drawings";
import { RowsSkeleton } from "./Skeleton";
import b from "./board.module.css";
import s from "@/app/admin.module.css";
import h from "./AdminHealth.module.css";

type Cron = { job: string; last_run: string | null; ok: boolean };
type Funnel = { slug: string; name: string; views_30d: number; applications: number; accepted: number; confirmed: number; checked_in: number };
type Health = {
  mail_failed: number; mail_waiting: number; oldest_waiting_minutes: number;
  cron: Cron[]; signups_30d: number; committees_started_30d: number; funnel: Funnel[];
};

/** Waiting longer than this means the mailer isn't keeping up. */
const STALE_MINUTES = 30;

const sydney = (iso: string) => new Date(iso).toLocaleString("en-AU", { timeZone: "Australia/Sydney", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const age = (min: number) => (min < 60 ? `${min} min` : min < 1440 ? `${Math.floor(min / 60)} h ${min % 60} min` : `${Math.floor(min / 1440)} days`);
// The RPC's answer is checked on the way in: a missing or odd field reads as zero or empty, never a crash.
const clean = (d: Partial<Health> | null): Health => ({
  mail_failed: n(d?.mail_failed), mail_waiting: n(d?.mail_waiting), oldest_waiting_minutes: n(d?.oldest_waiting_minutes),
  cron: Array.isArray(d?.cron) ? d.cron : [], signups_30d: n(d?.signups_30d), committees_started_30d: n(d?.committees_started_30d),
  funnel: Array.isArray(d?.funnel) ? d.funnel : [],
});

/** How the site is doing: the email queue, the scheduled jobs, new sign-ups, and where each conference's visitors drop off. */
export default function AdminHealth() {
  const [data, setData] = useState<Health | null>(null);
  const [failed, setFailed] = useState(false);
  const [tick, setTick] = useState(0);

  const load = useCallback(() => { setData(null); setFailed(false); setTick((t) => t + 1); }, []);

  useEffect(() => {
    if (!supabase) { setFailed(true); return; }
    let stale = false;
    supabase.rpc("admin_health").then(({ data: d, error }) => {
      if (stale) return;
      setFailed(!!error);
      setData(error ? null : clean(d as Partial<Health> | null));
    });
    return () => { stale = true; };
  }, [tick]);

  if (failed) {
    return (
      <div className={b.empty}>
        <Placard />
        <p className={b.emptyTitle}>Health Isn&apos;t Available Yet</p>
        <span className="muted">The database function admin_health() isn&apos;t there or didn&apos;t answer. Apply the latest migration, then try again.</span>
        <button type="button" className="button secondary" onClick={load}>Try Again</button>
      </div>
    );
  }
  if (!data) return <RowsSkeleton rows={3} height={72} />;

  const stuck = data.mail_waiting > 0 && data.oldest_waiting_minutes > STALE_MINUTES;
  const jobsDown = data.cron.filter((c) => c.last_run && !c.ok);
  const warn = data.mail_failed > 0 || stuck || jobsDown.length > 0;
  const reasons = [
    data.mail_failed > 0 && `${data.mail_failed} ${data.mail_failed === 1 ? "email has" : "emails have"} failed`,
    stuck && `the oldest waiting email is ${age(data.oldest_waiting_minutes)} old`,
    jobsDown.length > 0 && `${jobsDown.length === 1 ? "a scheduled job" : `${jobsDown.length} scheduled jobs`} did not work (${jobsDown.map((c) => c.job).join(", ")})`,
  ].filter(Boolean);

  return (
    <>
      <div className={h.banner} data-state={warn ? "warn" : "ok"} role="status">
        <span className={h.bannerMark} aria-hidden="true" />
        <div className={h.bannerText}>
          <p className={h.bannerTitle}>{warn ? "Needs a Look" : "All Good"}</p>
          <span className="muted">{warn ? `${reasons.join("; ")}.` : "Emails are going out and every scheduled job ran."}</span>
        </div>
        <button type="button" className="button secondary" onClick={load}>Refresh</button>
      </div>

      <section className={`panel ${h.box}`}>
      <h2 className={h.heading}>Emails</h2>
      <dl className={h.figures}>
        <div className={h.figure} data-warn={stuck}><dd><b>{data.mail_waiting}</b></dd><dt>Waiting{data.mail_waiting > 0 ? `, oldest ${age(data.oldest_waiting_minutes)}` : ""}</dt></div>
        <div className={h.figure} data-warn={data.mail_failed > 0}><dd><b>{data.mail_failed}</b></dd><dt>Failed</dt></div>
      </dl>
      </section>

      <h2 className={h.heading}>Scheduled Jobs</h2>
      {data.cron.length === 0 ? (
        <div className={b.empty}><Placard /><p className={b.emptyTitle}>No scheduled jobs found</p></div>
      ) : (
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead><tr><th>Job</th><th>Last Run</th><th>Result</th></tr></thead>
            <tbody>
              {data.cron.map((c) => (
                <tr key={c.job}>
                  <td className={h.job}>{c.job}</td>
                  <td className={h.when}>{c.last_run ? sydney(c.last_run) : "Never"}</td>
                  <td><span className={h.state} data-state={c.last_run ? (c.ok ? "ok" : "bad") : undefined}>{c.last_run ? (c.ok ? "Worked" : "Failed") : "Not run yet"}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <section className={`panel ${h.box}`}>
      <h2 className={h.heading}>Last 30 Days</h2>
      <dl className={h.figures}>
        <div className={h.figure}><dd><b>{data.signups_30d}</b></dd><dt>Sign-ups</dt></div>
        <div className={h.figure}><dd><b>{data.committees_started_30d}</b></dd><dt>Committees Started</dt></div>
      </dl>
      </section>

      <h2 className={h.heading}>Each Conference, Views to Check-in</h2>
      {data.funnel.length === 0 ? (
        <div className={b.empty}><Placard /><p className={b.emptyTitle}>No conferences yet</p></div>
      ) : (
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead><tr><th>Conference</th><th className={h.num}>Views</th><th className={h.num}>Applications</th><th className={h.num}>Accepted</th><th className={h.num}>Confirmed</th><th className={h.num}>Checked In</th></tr></thead>
            <tbody>
              {data.funnel.map((f) => (
                <tr key={f.slug}>
                  <td>{f.name}<span className={h.slug}>{f.slug}</span></td>
                  <td className={h.num}>{n(f.views_30d)}</td>
                  <td className={h.num}>{n(f.applications)}</td>
                  <td className={h.num}>{n(f.accepted)}</td>
                  <td className={h.num}>{n(f.confirmed)}</td>
                  <td className={h.num}>{n(f.checked_in)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
