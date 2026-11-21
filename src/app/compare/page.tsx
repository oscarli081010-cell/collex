import type { Metadata } from "next";
import Link from "next/link";
import { formatRange, isPast, monthLabel, shown, todayInSydney, type Conference } from "@/lib/conferences";
import { getPublished } from "@/lib/data";
import { shortOpens } from "@/lib/schedule";
import { Placard } from "@/components/Drawings";
import PageBand from "@/components/PageBand";
import board from "@/components/board.module.css";
import h from "@/components/Hub.module.css";
import x from "@/components/InfoPages.module.css";

export const metadata: Metadata = {
  alternates: { canonical: "/compare" },
  title: "Compare conferences · Collex",
  description: "Upcoming Sydney Model UN conferences side by side: dates, length, level, host, committees, and whether registration and guides are out.",
};
export const revalidate = 60;

type Tone = "ok" | "warn" | undefined;

// How many days it runs, from the listing's dates.
function length(c: Conference) {
  if (!c.startDate) return null;
  const days = Math.round((Date.parse(`${c.endDate ?? c.startDate}T00:00:00Z`) - Date.parse(`${c.startDate}T00:00:00Z`)) / 86_400_000) + 1;
  return days <= 1 ? "One day" : `${days} days`;
}

// Whether a form is open now, the same way the conference page decides: a link or Collex's own form, and its opening
// time (if one was set) has passed.
function openState(has: boolean, opensAt: string | null | undefined, now: number): [string, Tone] {
  if (!has) return ["Not open yet", undefined];
  if (opensAt && Date.parse(opensAt) > now) return [`Opens ${shortOpens(opensAt)}`, "warn"];
  return ["Open", "ok"];
}

function guidesState(c: Conference, today: string): [string, Tone] {
  const out = c.guides.filter((g) => g.url && (!g.released || g.released <= today)).length;
  if (out === 0) return ["Not yet", undefined];
  const total = Math.max(c.committees.length, c.guides.length);
  return out >= total ? ["Released", "ok"] : [`${out} of ${total}`, "warn"];
}

// A committee the organisers marked for beginners. Only what the listing says; nothing is guessed.
const forBeginners = (c: Conference) => c.committees.some((k) => /beginner|novice|first[- ]time/i.test(`${k.level} ${k.name}`));

// The time of this request, for whether a form has opened yet.
const nowMs = () => Date.now();

export default async function ComparePage() {
  const today = todayInSydney();
  const now = nowMs();
  const list = (await getPublished()).filter((c) => !c.isTemplate && !isPast(c, today))
    .sort((a, b) => (a.startDate ?? "9999").localeCompare(b.startDate ?? "9999") || a.name.localeCompare(b.name));
  const groups = new Map<string, Conference[]>();
  for (const c of list) {
    const key = c.startDate ? monthLabel(c.startDate.slice(0, 7)) : "Dates to be announced";
    groups.set(key, [...(groups.get(key) ?? []), c]);
  }

  return (
    <main id="top" className="container">
      <PageBand
        title="Compare"
        accent="conferences"
        lead="Upcoming conferences side by side, soonest first: when, how long, who it suits and what is open."
        figures={list.length ? [{ label: "Upcoming", value: String(list.length) }] : undefined}
      />
      {list.length === 0 ? (
        <div className={board.empty} style={{ marginTop: 32 }}>
          <Placard />
          <p className={board.emptyTitle}>No upcoming conferences yet</p>
          <p className="muted">When a conference is listed for the coming months, it shows here.</p>
          <Link href="/past" className="button secondary">See Past Conferences</Link>
        </div>
      ) : (
        <div className={x.wrap}>
          <p className={x.legend}>New to Model UN? Read <Link href="/start" className="link">Start here</Link> first. A conference is marked Beginner committees only when its organisers say a committee suits beginners. Check details with the conference before you commit.</p>
          {[...groups].map(([month, cs]) => (
            <section key={month} aria-labelledby={`m-${month}`}>
              <h2 id={`m-${month}`} className={x.groupHead}>{month}</h2>
              <div className={x.cards}>
                {cs.map((c) => {
                  const reg = openState(Boolean(c.delegationUrl || c.collexRegistration), c.delegationOpensAt, now);
                  const chair = openState(Boolean(c.chairUrl || c.collexApplications), c.chairOpensAt, now);
                  const guides = guidesState(c, today);
                  const len = length(c);
                  return (
                    <article key={c.slug} className={`panel ${x.card}`} aria-labelledby={`c-${c.slug}`}>
                      <div className={x.cardTop}>
                        <h3 id={`c-${c.slug}`} className={x.cardName}><Link href={`/conferences/${c.slug}`}>{c.name}</Link></h3>
                        <span className={x.cardWhen}>{formatRange(c)}</span>
                      </div>
                      <div className={x.tags}>
                        {len && <span className={h.chip}>{len}</span>}
                        {c.level && <span className={h.chip}>{c.level}</span>}
                        {forBeginners(c) && <span className={h.chip} data-tone="accent">Beginner committees</span>}
                        {c.verified && <span className={h.chip} data-tone="ok">Verified</span>}
                      </div>
                      <dl className={x.facts}>
                        <dt>Host</dt><dd>{shown(c.host)}</dd>
                        <dt>Venue</dt><dd>{shown(c.venue)}</dd>
                        <dt>Committees</dt><dd>{c.committees.length || "To be announced"}</dd>
                        <dt>Delegate fee</dt><dd>{shown(c.fee)}</dd>
                      </dl>
                      <div className={x.status}>
                        <div className={x.statusRow}><span>Registration</span><span className={h.chip} data-tone={reg[1]}>{reg[0]}</span></div>
                        <div className={x.statusRow}><span>Chair applications</span><span className={h.chip} data-tone={chair[1]}>{chair[0]}</span></div>
                        <div className={x.statusRow}><span>Background guides</span><span className={h.chip} data-tone={guides[1]}>{guides[0]}</span></div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
