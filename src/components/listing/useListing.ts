"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { keptActivity, loadActivity, warmEditing } from "@/lib/listingData";
import type { Loaded } from "./types";

/** One listing for the people who run it. undefined while it loads, "missing" when it isn't theirs to open. */
export function useListing(id: string | null, userId: string | undefined) {
  const [data, setData] = useState<Loaded | "missing" | undefined>(undefined);
  const [version, setVersion] = useState(0);
  // Layout effect, so a listing that was loaded a moment ago shows on the first paint instead of a skeleton.
  useLayoutEffect(() => {
    const kept = id ? keptActivity(id) : undefined;
    setData(kept);
  }, [id]);
  useEffect(() => {
    if (!id || !userId) return;
    let live = true;
    loadActivity(id, userId).then((r) => { if (live && r) { setData(r); if (r !== "missing") warmEditing(id); } });
    return () => { live = false; };
  }, [id, userId, version]);
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { data, reload };
}
