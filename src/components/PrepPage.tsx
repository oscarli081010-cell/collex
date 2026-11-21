"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatRange, NA, todayInSydney, type Conference } from "@/lib/conferences";
import { supabase } from "@/lib/supabase";
import { useAuth } from "./AuthProvider";
import { committeeOf, conferencesById, guideFor, nextDate } from "./allocation";
import { Placard } from "./Drawings";
import Flag from "./Flag";
import PageBand from "./PageBand";
import { RowsSkeleton } from "./Skeleton";
import board from "./board.module.css";
import h from "./Hub.module.css";
import p from "./PrepPage.module.css";

// Getting ready for one allocation: the person's own accepted application (only they can read it) and its conference.
// The ticks are kept in this browser only, under "collex:prep:<application id>".

type App = { id: string; kind: string; status: string; committee: string; country: string; conference_id: string };
type State = { app: App; c: Conference | undefined } | "none" | null;

const read = (id: string): string[] => {
  try { const v = JSON.parse(localStorage.getItem(`collex:prep:${id}`) ?? "[]"); return Array.isArray(v) ? v.filter((x) => typeof x === "string") : []; } catch { return []; }
};
const write = (id: string, ticks: string[]) => {
  try { localStorage.setItem(`collex:prep:${id}`, JSON.stringify(ticks)); } catch { /* storage blocked: ticks last until the page closes */ }
};

function paperTemplate(country: string, committee: string, topic: string) {
  return `Country: ${country}
Committee: ${committee}
Topic: ${topic || "[the committee’s topic]"}

Background
[Two or three sentences: what the problem is, and how it affects ${country}.]

Position of ${country}
[What ${country} believes about this topic and what it has already done. Include one or two facts, with where you found them.]

Proposed solutions
[Two or three specific things ${country} wants the committee to do. For each one, say who does it and how it is paid for or checked.]

Sources
[Every source you used.]`;
}

function speechStarter(country: string, topic: string) {
  return `Honourable Chair, fellow delegates.
${country} is here today because ${topic ? topic.charAt(0).toLowerCase() + topic.slice(1) : "[the topic]"} matters to [who in ${country} it affects].
[One fact that shows why.]
${country} asks this committee to [one specific action].
${country} looks forward to working with every delegation on this. Thank you, and ${country} yields to the chair.`;
}

function Copy({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" className="button secondary block" onClick={() => navigator.clipboard?.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 2000); }).catch(() => {})}>
      {done ? "Copied" : label}
    </button>
  );
}

export default function PrepPage() {
  const { ready, session } = useAuth();
  const [id, setId] = useState<string | null>(null);
  const [state, setState] = useState<State>(null);
  const [ticks, setTicks] = useState<string[]>([]);

  // Read from the address after the page loads, so the page needs no search-params boundary.
  useEffect(() => { setId(new URLSearchParams(location.search).get("app") ?? ""); }, []);

  useEffect(() => {
    if (!ready || id === null) return;
    if (!session || !supabase || !id || !/^[0-9a-f-]{36}$/i.test(id)) { setState("none"); return; }
    let live = true;
    (async () => {
      const { data, error } = await supabase!.from("applications").select("id, kind, status, committee, country, conference_id")
        .eq("id", id).eq("user_id", session.user.id).maybeSingle();
      if (!live) return;
      const app = data as App | null;
      if (error || !app || app.status !== "accepted") { setState("none"); return; }
      const c = (await conferencesById([app.conference_id])).get(app.conference_id);
      if (!live) return;
      setTicks(read(app.id));
      setState({ app, c });
    })().catch(() => { if (live) setState("none"); });
    return () => { live = false; };
  }, [ready, session, id]);

  if (!ready || id === null || (session && state === null)) return <div style={{ marginTop: 32 }}><RowsSkeleton rows={3} height={120} /></div>;

  if (!session || state === "none" || state === null) {
    const next = `/prepare${id ? `?app=${encodeURIComponent(id)}` : ""}`;
    return (
      <>
        <PageBand title="Prepare" accent="for your committee" />
        <div className={board.empty}>
          <Placard />
          <p className={board.emptyTitle}>{session ? "No allocation here" : "Log in to prepare"}</p>
          <p className="muted">{session ? "This page opens from an accepted place under My allocation on your account." : "Your preparation page uses your allocation, so it needs your account."}</p>
          {session
            ? <Link href="/account#conferences" className="button secondary">See My Allocation</Link>
            : <Link href={`/login?next=${encodeURIComponent(next)}`} className="button">Log In</Link>}
        </div>
      </>
    );
  }

  const { app, c } = state;
  const country = app.country || "Your country";
  const committee = app.committee || "Your committee";
  const listed = committeeOf(c, app.committee)?.topic?.trim() ?? "";
  const topic = listed === NA ? "" : listed; // "N/A" is the stored "not given" marker
  const guide = guideFor(c, app.committee);
  const next = nextDate(c);
  const paperDue = c?.keyDates.find((d) => /position/i.test(d.label) && d.date && d.date >= todayInSydney());
  const toggle = (k: string) => setTicks((t) => { const n = t.includes(k) ? t.filter((x) => x !== k) : [...t, k]; write(app.id, n); return n; });
  const box = (k: string, children: React.ReactNode) => (
    <label key={k} className="check"><input type="checkbox" checked={ticks.includes(k)} onChange={() => toggle(k)} /><span>{children}</span></label>
  );
  const q = encodeURIComponent(`${app.country} ${topic}`.trim());

  return (
    <>
      <PageBand
        title={country}
        accent={committee}
        media={app.country ? <Flag name={app.country} size={48} /> : undefined}
        lead={c ? <><Link href={`/conferences/${c.slug}`} className="link">{c.name}</Link> · {formatRange(c)}</> : undefined}
        figures={next ? [{ label: "Next", value: next.split(" · ")[1] ?? "", note: next.split(" · ")[0] }] : undefined}
      />
      <div className={p.wrap}>
        <section className={`panel ${h.card}`} aria-labelledby="pp-topic">
          <h2 id="pp-topic" className={h.h2}>Topic and background guide</h2>
          <p className={p.topic}>{topic || "The organisers haven’t listed this committee’s topic yet. It will be in the background guide."}</p>
          {guide
            ? <a href={guide} target="_blank" rel="noreferrer" className="button block">Open the Background Guide</a>
            : <span className="tip" data-tip="The organisers haven’t released it yet" data-tip-align="start" style={{ display: "flex" }}><button type="button" className="button block" disabled>Open the Background Guide</button></span>}
        </section>

        <section className={`panel ${h.card}`} aria-labelledby="pp-research">
          <h2 id="pp-research" className={h.h2}>Research</h2>
          <p className={h.note}>Tick each one off as you go. The ticks stay in this browser only.</p>
          <div className={p.checks}>
            {box("r-guide", <>Read the {guide ? <a className="link" href={guide} target="_blank" rel="noreferrer">background guide</a> : "background guide"} twice, and mark every question it asks.</>)}
            {box("r-un", <>Find {country} on the <a className="link" href="https://www.un.org/en/about-us/member-states" target="_blank" rel="noreferrer">UN member states list</a>: when it joined and its mission’s website.</>)}
            {box("r-factbook", <>Look up its region, government and economy in the <a className="link" href="https://www.cia.gov/the-world-factbook/countries/" target="_blank" rel="noreferrer">World Factbook</a>.</>)}
            {box("r-library", <>Search the <a className="link" href={`https://digitallibrary.un.org/search?ln=en&p=${q}`} target="_blank" rel="noreferrer">UN Digital Library for {country}{topic ? " and this topic" : ""}</a>: its speeches, and how it voted.</>)}
            {box("r-friends", <>Write down three countries likely to agree with {country}, and one likely to disagree.</>)}
          </div>
          <p className={h.note}>More help: <Link href="/guides/position-paper" className="link">Research your country and write a position paper</Link>.</p>
        </section>

        <section className={`panel ${h.card}`} aria-labelledby="pp-paper">
          <h2 id="pp-paper" className={h.h2}>Position paper template</h2>
          <p className={h.note}>Copy it into a document and replace each part in brackets. Check the conference’s handbook for its own format and length.{paperDue?.date ? ` ${paperDue.label}: ${new Date(paperDue.date + "T00:00:00").toLocaleDateString("en-AU", { day: "numeric", month: "long" })}.` : ""}</p>
          <pre className={p.pre}>{paperTemplate(country, committee, topic)}</pre>
          <Copy text={paperTemplate(country, committee, topic)} label="Copy the Template" />
        </section>

        <section className={`panel ${h.card}`} aria-labelledby="pp-speech">
          <h2 id="pp-speech" className={h.h2}>Speech starter</h2>
          <p className={h.note}>A 60-second opening speech. Fill in the brackets, then time it out loud.</p>
          <pre className={p.pre}>{speechStarter(country, topic)}</pre>
          <div className={h.btnRow}>
            <Copy text={speechStarter(country, topic)} label="Copy the Speech" />
            <Link href="/practice" className="button">Practise with the Timer</Link>
          </div>
        </section>

        <section className={`panel ${h.card}`} aria-labelledby="pp-before">
          <h2 id="pp-before" className={h.h2}>Before the day</h2>
          <div className={p.checks}>
            {box("b-paper", <>Position paper written{paperDue ? " and handed in" : ""}, if the conference asks for one.</>)}
            {box("b-speech", "Opening speech written and timed at under a minute.")}
            {box("b-clauses", "Two or three clause ideas ready for the first caucus.")}
            {box("b-confirm", <>Place confirmed under <Link href="/account#conferences" className="link">My allocation</Link>.</>)}
            {box("b-times", <>Start time, venue and dress code checked{c ? <> on the <Link href={`/conferences/${c.slug}`} className="link">conference page</Link></> : ""}.</>)}
            {box("b-pack", <>Bag packed: see <Link href="/guides/what-to-wear-bring-cost" className="link">what to bring</Link>.</>)}
            {box("b-permission", "Permission note signed, if your school needs one.")}
          </div>
        </section>
      </div>
    </>
  );
}
