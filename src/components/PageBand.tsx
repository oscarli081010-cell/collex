import { formatDate, todayInSydney, type Conference } from "@/lib/conferences";
import s from "./PageBand.module.css";

export type Figure = { label: string; value: string; note?: string };

export type BandProps = {
  title: string; accent?: React.ReactNode; lead?: React.ReactNode; media?: React.ReactNode;
  figures?: Figure[]; aside?: React.ReactNode; size?: "md"; children?: React.ReactNode;
};

// The headline panel at the top of most pages: a big title, an optional line under it, live figures
// or an action on the right, and whatever control the page needs underneath (season strip, search).
export default function PageBand({ title, accent, lead, media, figures = [], aside, size, children }: BandProps) {
  return (
    <header className={`t-reveal ${s.band} ${size === "md" ? s.md : ""}`}>
      <div className={s.top}>
        <div className={s.head}>
          {media}
          <div className={s.headText}>
            <h1 className={s.title}>{title}{accent && <> <em>{accent}</em></>}</h1>
            {lead && <div className={s.lead}>{lead}</div>}
          </div>
        </div>
        {(figures.length > 0 || aside) && (
          <div className={s.side}>
            {figures.length > 0 && (
              <dl className={s.figures}>
                {figures.map((f) => (
                  <div key={f.label}>
                    <dt>{f.label}</dt>
                    <dd>{f.value}{f.note && <small>{f.note}</small>}</dd>
                  </div>
                ))}
              </dl>
            )}
            {aside}
          </div>
        )}
      </div>
      {children && <div className={s.foot}>{children}</div>}
    </header>
  );
}

// The next conference that hasn't started yet, as a figure.
export function nextUp(list: Conference[]): Figure {
  const today = todayInSydney();
  const next = list.filter((c) => c.startDate && c.startDate >= today).sort((a, b) => a.startDate!.localeCompare(b.startDate!))[0];
  return next ? { label: "Next up", value: next.shortName, note: formatDate(next.startDate!) } : { label: "Next up", value: "TBA" };
}
