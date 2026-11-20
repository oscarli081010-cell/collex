import { todayInSydney } from "@/lib/conferences";
import type { ListingCtx } from "../types";
import { STATUS, when } from "./words";
import s from "../../Activity.module.css";

export const mondayOf = (today: string) => {
  const d = new Date(today + "T00:00:00");
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export const num = (n: number | null) => (n === null ? "–" : String(n));

// The listing's numbers, one tile each.
export default function Numbers({ ctx }: { ctx: ListingCtx }) {
  const { c, status, interest, followers, team } = ctx.data;
  const ownForm = Boolean(c.interestUrl);
  const thisWeek = interest.weeks.find((w) => w.week === mondayOf(todayInSydney()))?.interested ?? 0;
  const tiles: { label: string; value: React.ReactNode; note?: string }[] = [
    { label: "Interested", value: ownForm ? "–" : num(interest.total), note: ownForm ? "Goes to your own form" : undefined },
    { label: "Interested this week", value: ownForm ? "–" : num(thisWeek) },
    { label: "Following", value: num(followers) },
    { label: "Running it", value: <>{team}<small> {team === 1 ? "person" : "people"}</small></> },
    { label: "Status", value: <span className={s.statusValue}><span className={s.statusDot} data-status={status} aria-hidden="true" />{STATUS[status] ?? status}</span> },
    { label: "Last edited", value: <span style={{ fontSize: "0.5em" }}>{c.updatedAt ? when(c.updatedAt) : "–"}</span> },
  ];
  return (
    <section id="sec-numbers" className={s.stats} aria-label="Numbers">
      {tiles.map((t) => (
        <div key={t.label} className={`panel ${s.stat}`}>
          <span className={s.statLabel}>{t.label}</span>
          <span className={s.statValue}>{t.value}</span>
          {t.note && <span className={s.statNote}>{t.note}</span>}
        </div>
      ))}
    </section>
  );
}
