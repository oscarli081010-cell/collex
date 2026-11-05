"use client";

import { useEffect, useState } from "react";

// Whether a button scheduled to open at `at` is open. Pages are cached, so this is worked out in the browser, and it
// flips by itself when the time arrives. "unknown" is the moment before the browser has checked the clock.
export function useOpen(at: string | null | undefined): "open" | "closed" | "unknown" {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    if (!at) return;
    const wait = Date.parse(at) - Date.now();
    if (!(wait > 0) || wait > 2 ** 31 - 1) return;
    const t = setTimeout(() => setNow(Date.now()), wait + 250);
    return () => clearTimeout(t);
  }, [at]);
  if (!at) return "open";
  if (now === null) return "unknown";
  return Date.parse(at) <= now ? "open" : "closed";
}
