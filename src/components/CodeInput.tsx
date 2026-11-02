"use client";

import { useEffect, useRef, useState } from "react";
import s from "./CodeInput.module.css";

// One rounded box per digit. Typing moves forward, Backspace moves back, pasting fills every box,
// and the code is handed to onComplete once the last box is filled.
// `errors` counts wrong attempts; each new one shakes and clears the boxes.
export default function CodeInput({ length = 6, onComplete, errors = 0, disabled }: {
  length?: number; onComplete: (code: string) => void; errors?: number; disabled?: boolean;
}) {
  const [digits, setDigits] = useState<string[]>(() => Array(length).fill(""));
  const [shake, setShake] = useState(0);
  const boxes = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (!errors) return;
    setShake(errors);
    setDigits(Array(length).fill(""));
  }, [errors, length]);
  // The row remounts to replay the shake, so focus the fresh first box afterwards.
  useEffect(() => { if (shake) boxes.current[0]?.focus(); }, [shake]);

  const fill = (from: number, chars: string) => {
    const next = [...digits];
    let i = from;
    for (const c of chars.replace(/\D/g, "")) { if (i >= length) break; next[i++] = c; }
    setDigits(next);
    boxes.current[Math.min(i, length - 1)]?.focus();
    if (next.every(Boolean)) onComplete(next.join(""));
  };

  const onKey = (i: number) => (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      e.preventDefault();
      const next = [...digits];
      next[i - 1] = "";
      setDigits(next);
      boxes.current[i - 1]?.focus();
    } else if (e.key === "ArrowLeft" && i > 0) boxes.current[i - 1]?.focus();
    else if (e.key === "ArrowRight" && i < length - 1) boxes.current[i + 1]?.focus();
  };

  return (
    <div key={shake} className={`${s.row} ${shake ? s.shake : ""}`} role="group" aria-label={`${length}-digit code`}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => { boxes.current[i] = el; }}
          className={s.box}
          data-filled={Boolean(d)}
          data-error={errors > 0 && digits.every((x) => !x) ? true : undefined}
          value={d}
          disabled={disabled}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={length}
          aria-label={`Digit ${i + 1}`}
          onFocus={(e) => e.target.select()}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, "");
            if (!v) { const next = [...digits]; next[i] = ""; setDigits(next); return; }
            fill(i, d && v.length === 2 ? v.slice(-1) : v);
          }}
          onPaste={(e) => { e.preventDefault(); fill(0, e.clipboardData.getData("text")); }}
          onKeyDown={onKey(i)}
        />
      ))}
    </div>
  );
}
