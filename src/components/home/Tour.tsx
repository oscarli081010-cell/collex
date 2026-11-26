"use client";

import { useEffect, useRef, useState } from "react";
import { Phone, Shot } from "./Devices";
import s from "./home.module.css";

// Finding a conference, in three steps. On a wide screen the phone stays put while the words scroll past it, and its
// screen changes to match the step in the middle of the window. On a phone each step carries its own picture.
const STEPS = [
  { kicker: "Calendar", title: "Every conference,", accent: "one calendar.", text: "Month by month or the whole year, so dates are easy to see and hard to clash.", shot: "phone-calendar", alt: "The Collex calendar for April 2027 on a phone" },
  { kicker: "Conference pages", title: "A page", accent: "for each.", text: "Dates, host, venue, committees and how to apply. Some take applications right on Collex.", shot: "phone-conference", alt: "A conference page on Collex, on a phone" },
  { kicker: "Follow", title: "Never miss", accent: "a deadline.", text: "Follow a conference to hear when applications open, with a reminder before each key date.", shot: "phone-conference", alt: "The Follow button on a conference page" },
];
const FOLLOW = 2;
const SIZES = "(max-width: 900px) 240px, 320px";

export default function Tour() {
  const [on, setOn] = useState(0);
  const [live, setLive] = useState(false);
  const steps = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const els = steps.current?.querySelectorAll<HTMLElement>("[data-step]");
    if (!els) return;
    setLive(true); // the steps dim only once there is a script to light them
    // A step is "on" while it crosses a line across the middle of the window.
    const io = new IntersectionObserver((list) => {
      for (const e of list) if (e.isIntersecting) setOn(Number((e.target as HTMLElement).dataset.step));
    }, { rootMargin: "-50% 0px -50% 0px" });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <div className={s.tourGrid}>
      <ol ref={steps} className={s.steps} data-live={live ? "" : undefined}>
        {STEPS.map((st, i) => (
          <li key={i} data-step={i} className={s.step} data-on={on === i ? "" : undefined}>
            <p className={s.kicker}>{st.kicker}</p>
            <h3 className={`serif ${s.stepTitle}`}>{st.title} <em>{st.accent}</em></h3>
            <p className={s.stepText}>{st.text}</p>
            <div className={s.stepShot}>
              <Phone>
                <Shot name={st.shot} alt={st.alt} kind="phone" sizes={SIZES} />
                {i === FOLLOW && <span className={`${s.ring} ${s.ringOn}`} aria-hidden="true" />}
              </Phone>
            </div>
          </li>
        ))}
      </ol>
      <div className={s.tourStage} aria-hidden="true">
        <div className={s.tourSticky}>
          <Phone>
            {STEPS.map((st, i) => (i === FOLLOW ? null : (
              <div key={i} className={s.tourShot} data-on={on === i || (i === 1 && on === FOLLOW) ? "" : undefined}>
                <Shot name={st.shot} alt="" kind="phone" sizes={SIZES} />
              </div>
            )))}
            <span className={`${s.ring} ${on === FOLLOW ? s.ringOn : ""}`} />
          </Phone>
        </div>
      </div>
    </div>
  );
}
