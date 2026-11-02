import { formatDate, type Conference } from "@/lib/conferences";
import s from "./PageBand.module.css";

export type Figure = { label: string; value: string; note?: string };

// The headline panel at the top of Calendar and Conferences: a big title, three live figures,
// and whatever control the page needs underneath (season strip, search).
export default function PageBand({ title, accent, figures, children }: {
  title: string; accent?: React.ReactNode; figures: Figure[]; children?: React.ReactNode;
}) {
  return (
    <header className={`t-reveal ${s.band}`}>
      <div className={s.top}>
        <h1 className={s.title}>{title}{accent && <> <em>{accent}</em></>}</h1>
        <dl className={s.figures}>
          {figures.map((f) => (
            <div key={f.label}>
              <dt>{f.label}</dt>
              <dd>{f.value}{f.note && <small>{f.note}</small>}</dd>
            </div>
          ))}
        </dl>
      </div>
      {children && <div className={s.foot}>{children}</div>}
    </header>
  );
}

// The next conference that hasn't started yet, as a figure.
export function nextUp(list: Conference[]): Figure {
  const today = new Date().toISOString().slice(0, 10);
  const next = list.filter((c) => c.startDate && c.startDate >= today).sort((a, b) => a.startDate!.localeCompare(b.startDate!))[0];
  return next ? { label: "Next up", value: next.shortName, note: formatDate(next.startDate!) } : { label: "Next up", value: "TBA" };
}
