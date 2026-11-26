import s from "./home.module.css";

// The statement: the page holds still while the sentence lights up word by word, then the two places people used to
// hunt through are struck out. Each word gets its own stretch of the scroll (its animation range); without scroll-driven
// animations, or with reduced motion, it is simply the finished sentence.

type Part = string | { em: string } | { chip: string; icon: "web" | "chat"; tail?: string };

const FIRST: Part[] = ["Dates,", "committees", "and", "the", "links", "to", "apply", "for", { em: "every" }, { em: "conference," }, "in", "the", "same", "clear", "format."];
const SECOND: Part[] = ["No", "more", "hunting", "through", { chip: "school websites", icon: "web" }, "and", { chip: "group chats", icon: "chat", tail: "." }];

const COUNT = FIRST.length + SECOND.length;
const START = 2; // where the first word starts lighting, as a share of the time the page holds still
const SPAN = 66; // over how much of it the words light up
const range = (i: number) => {
  const a = START + (i / COUNT) * SPAN;
  return { animationRange: `contain ${a.toFixed(1)}% contain ${(a + 9).toFixed(1)}%` };
};

const ICONS = {
  web: <svg width="1em" height="1em" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.3" /><path d="M2 8h12M8 2c1.8 1.7 2.6 3.7 2.6 6S9.8 12.3 8 14C6.2 12.3 5.4 10.3 5.4 8S6.2 3.7 8 2z" fill="none" stroke="currentColor" strokeWidth="1.3" /></svg>,
  chat: <svg width="1em" height="1em" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3.5h10a1 1 0 011 1v6a1 1 0 01-1 1H7l-3 2.5v-2.5H3a1 1 0 01-1-1v-6a1 1 0 011-1z" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /></svg>,
};

function Words({ parts, from }: { parts: Part[]; from: number }) {
  return parts.map((p, j) => {
    const i = from + j;
    const space = j < parts.length - 1 ? " " : null;
    if (typeof p === "string") return <span key={i}><span className={s.w} style={range(i)}>{p}</span>{space}</span>;
    if ("em" in p) return <span key={i}><em className={s.w} style={range(i)}>{p.em}</em>{space}</span>;
    return (
      <span key={i}>
        <span className={s.w} style={range(i)}>
          <span className={s.chip}>
            <span className={s.chipIcon}>{ICONS[p.icon]}</span>
            <span className={s.chipText}>{p.chip}</span>
            <span className={s.strike} aria-hidden="true" />
          </span>
          {p.tail}
        </span>
        {space}
      </span>
    );
  });
}

export default function Statement() {
  return (
    <section id="why" className={s.statement} aria-label="Why Collex">
      <div className={s.statementHold}>
        <p className={`container serif ${s.statementText}`}>
          <span className={s.line}><Words parts={FIRST} from={0} /></span>{" "}
          <span className={s.line}><Words parts={SECOND} from={FIRST.length} /></span>
        </p>
      </div>
    </section>
  );
}
