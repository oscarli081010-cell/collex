import s from "./InterestChart.module.css";

export type Week = { week: string; interested: number };

const WEEKS = 8;
const pad = (n: number) => String(n).padStart(2, "0");
const isoDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const short = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("en-AU", { day: "numeric", month: "short" });

// The Mondays of the last eight weeks (Sydney), oldest first, matching how the database groups them.
function lastWeeks(today: string) {
  const d = new Date(today + "T00:00:00");
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return Array.from({ length: WEEKS }, (_, i) => {
    const w = new Date(d);
    w.setDate(d.getDate() - 7 * (WEEKS - 1 - i));
    return isoDay(w);
  });
}

// Expressions of interest per week, for the people who run a listing. Counts only: never who.
export default function InterestChart({ weeks, total, today }: { weeks: Week[]; total: number; today: string }) {
  const by = new Map(weeks.map((w) => [w.week, w.interested]));
  const days = lastWeeks(today);
  const counts = days.map((d) => by.get(d) ?? 0);
  const max = Math.max(1, ...counts);
  const recent = counts.reduce((a, b) => a + b, 0);

  return (
    <figure className={s.chart}>
      <figcaption className={s.head}>
        <span className={s.total}>{total}</span>
        <span>{total === 1 ? "person interested" : "people interested"}<small>{recent} in the last {WEEKS} weeks</small></span>
      </figcaption>
      <div className={s.bars} aria-hidden="true">
        {counts.map((n, i) => (
          <span key={days[i]} className={s.bar} data-empty={n === 0} style={{ "--h": `${Math.round((n / max) * 100)}%`, "--i": i } as React.CSSProperties} title={`Week of ${short(days[i])}: ${n}`} />
        ))}
      </div>
      <div className={s.axis} aria-hidden="true"><span>{short(days[0])}</span><span>This week</span></div>
      <table className="sr-only">
        <caption>Expressions of interest by week</caption>
        <thead><tr><th scope="col">Week of</th><th scope="col">Interested</th></tr></thead>
        <tbody>{days.map((d, i) => <tr key={d}><td>{short(d)}</td><td>{counts[i]}</td></tr>)}</tbody>
      </table>
    </figure>
  );
}
