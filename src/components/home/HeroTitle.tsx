"use client";

import { useRef } from "react";
import s from "./home.module.css";

const LINE = "Sydney Model UN,";
const ACCENT = "in one place.";
const LAST = LINE.length + 1 + ACCENT.length - 1; // the index of the last letter, which starts its wave last
const RUN_MS = LAST * 26 + 720 + 60; // the stagger, one letter's wave, and a little slack

// The headline, letter by letter, so pointing at it sends a wave through it. Once started the wave plays to the end,
// even if the pointer leaves at once; pointing again while it plays does nothing. Words stay whole (no break inside one).
function letters(text: string, from: number) {
  let i = from;
  return text.split(" ").map((w, wi, all) => (
    <span key={wi}>
      <span className={s.word}>{[...w].map((ch) => <span key={i} className={s.ch} style={{ "--i": i++ } as React.CSSProperties}>{ch}</span>)}</span>
      {wi < all.length - 1 ? (i++, " ") : null}
    </span>
  ));
}

export default function HeroTitle() {
  const h1 = useRef<HTMLHeadingElement>(null);
  const playing = useRef(false);

  function wave(e: React.PointerEvent) {
    if (e.pointerType === "touch" || playing.current || !h1.current) return;
    playing.current = true;
    h1.current.dataset.wave = "";
    setTimeout(() => {
      playing.current = false;
      if (h1.current) delete h1.current.dataset.wave;
    }, RUN_MS);
  }

  return (
    <h1 ref={h1} className={`serif ${s.title}`} aria-label={`${LINE} ${ACCENT}`} onPointerEnter={wave}>
      <span aria-hidden="true">{letters(LINE, 0)} <em>{letters(ACCENT, LINE.length + 1)}</em></span>
    </h1>
  );
}
