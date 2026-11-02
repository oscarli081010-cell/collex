"use client";

import type { Conference } from "@/lib/conferences";
import { useToast } from "./useToast";
import s from "@/app/inner.module.css";

// The two things people come to a conference page to do, at the top and hard to miss.
export default function ApplyBand({ c }: { c: Conference }) {
  const { say, node } = useToast();
  const options = [
    { title: "Register a delegation", who: "For schools", url: c.delegationUrl, cta: "Register" },
    { title: "Apply to chair", who: "For chairs", url: c.chairUrl, cta: "Apply" },
  ];

  return (
    <section id="apply" className={s.applyBand} aria-label="Apply">
      {options.map((o) => (
        <div key={o.title} className={s.applyOption}>
          <div>
            <span className={s.applyWho}>{o.who}</span>
            <h2 className={s.applyTitle}>{o.title}</h2>
            <span className={s.applyStatus} data-open={Boolean(o.url)}>
              {o.url ? "Applications open" : "Applications not open yet"}
            </span>
          </div>
          {o.url ? (
            <a href={o.url} className={`button ${s.applyBtn}`} target="_blank" rel="noreferrer">{o.cta} →</a>
          ) : (
            <button
              className={`button ${s.applyBtn}`}
              aria-disabled="true"
              data-closed
              onClick={() => say(o.title === "Apply to chair" ? "Chair applications haven't opened yet. Check back soon." : "Delegate registration hasn't opened yet. Check back soon.")}
            >
              {o.cta} →
            </button>
          )}
        </div>
      ))}
      {node}
    </section>
  );
}
