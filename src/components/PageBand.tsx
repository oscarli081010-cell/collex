import { formatDate, todayInSydney, type Conference } from "@/lib/conferences";
import s from "./PageBand.module.css";

export type Figure = { label: string; value: string; note?: string; /** The label goes above the value, in bold (a heading for it, not a caption under a number). */ lead?: boolean };

export type BandProps = {
  title: string; accent?: React.ReactNode; lead?: React.ReactNode; media?: React.ReactNode;
  figures?: Figure[]; aside?: React.ReactNode; children?: React.ReactNode;
  /** Centre the title against a taller right-hand side (figures with a button under them), instead of lining their bottoms up. */
  centre?: boolean;
  /** Something of the page's own sits right under the band (a listing's tabs), so the gap below it is small. */
  tight?: boolean;
};

// The headline panel at the top of most pages: a big title, an optional line under it, live figures
// or an action on the right, and whatever control the page needs underneath (season strip, search).
// Every band is the calendar's size and type at least: the same title size, and never shorter than its panel.
export default function PageBand({ title, accent, lead, media, figures = [], aside, children, centre, tight }: BandProps) {
  return (
    <header className={`t-reveal ${s.band} ${tight ? s.tight : ""}`}>
      <div className={`${s.top} ${centre ? s.topCentre : ""}`}>
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
                  <div key={f.label} data-lead={f.lead || undefined}>
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

// A short line of detail beside the title, on the right where other bands keep their figures. Listing pages use it
// instead of a lead under the title, which would make their band taller than the calendar's.
export function BandNote({ children }: { children: React.ReactNode }) {
  return <div className={s.note}>{children}</div>;
}

// The next conference that hasn't started yet, as a figure.
export function nextUp(list: Conference[]): Figure {
  const today = todayInSydney();
  const next = list.filter((c) => c.startDate && c.startDate >= today).sort((a, b) => a.startDate!.localeCompare(b.startDate!))[0];
  return next ? { label: "Next Up:", value: next.shortName, note: formatDate(next.startDate!), lead: true } : { label: "Next Up:", value: "TBA", lead: true };
}
