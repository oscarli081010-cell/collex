"use client";

import { useEffect, useRef, useState } from "react";

// A single bottom-centre toast: say("…") shows it, it hides itself after a moment.
export function useToast() {
  const [toast, setToast] = useState<{ text: string; hiding: boolean } | null>(null);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const say = (text: string) => {
    timers.current.forEach(clearTimeout);
    setToast({ text, hiding: false });
    timers.current = [
      window.setTimeout(() => setToast((t) => t && { ...t, hiding: true }), 2600),
      window.setTimeout(() => setToast(null), 2950),
    ];
  };

  const node = toast && <div role="status" className={`t-toast${toast.hiding ? " is-hiding" : ""}`}>{toast.text}</div>;
  return { say, node };
}
