import h from "../Hub.module.css";
import m from "../Manage.module.css";

export type Toggle = {
  on: boolean; busy?: boolean; flip: () => void;
  /** Why it can't be changed right now; shown on hover, with the switch greyed out. */
  whyNot?: string;
};

// One card of a listing's workspace: a serif title, an on/off switch when the section is something that can be turned
// on, and the section's content. Its id is what the list beside the page jumps to.
export default function Section({ id, title, count, toggle, children }: {
  id: string; title: string; count?: number; toggle?: Toggle; children?: React.ReactNode;
}) {
  const heading = (
    <h2 id={`${id}-h`} className={m.cardTitle}>
      {title}
      {count ? <span className={h.count}>{count}</span> : null}
      {toggle && <><span className={m.dot} data-on={toggle.on} aria-hidden="true" /><span className="sr-only" aria-live="polite">{toggle.on ? "On" : "Off"}</span></>}
    </h2>
  );
  const button = toggle && (
    <button type="button" className={`button ${toggle.on ? "secondary" : ""} ${m.switchBtn}`} onClick={toggle.flip} disabled={toggle.busy || Boolean(toggle.whyNot)} aria-pressed={toggle.on}>
      <span key={String(toggle.on)} className="t-swap">{toggle.on ? "Turn Off" : "Turn On"}</span>
    </button>
  );
  return (
    <section id={id} className={`panel ${m.card}`} aria-labelledby={`${id}-h`}>
      {toggle ? (
        <div className={m.cardTop}>
          <div className={m.cardHead}>{heading}</div>
          {toggle.whyNot ? <span className={`tip ${m.switchTip}`} data-tip={toggle.whyNot}>{button}</span> : button}
        </div>
      ) : heading}
      {children}
    </section>
  );
}
