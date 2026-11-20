"use client";

import { useEffect, useState } from "react";
import type { Conference } from "@/lib/conferences";
import { fromRow } from "@/lib/data";
import { supabase } from "@/lib/supabase";

export type Listing = { c: Conference; status: string; note: string; mine: boolean; canEdit: boolean };

// The listings you sent or help run, with their review status. null while they load.
export function useMyListings(userId: string, version = 0) {
  const [rows, setRows] = useState<Listing[] | null>(null);
  useEffect(() => {
    // Nobody is signed in yet, so there is nothing to ask for.
    if (!supabase || !userId) return;
    const db = supabase;
    // Only the latest request may answer: an older one that comes back late must not replace what is shown.
    let current = true;
    (async () => {
      const { data: team } = await db.from("organisers").select("conference_id, role").eq("user_id", userId).not("accepted_at", "is", null);
      const ids = (team ?? []).map((t) => t.conference_id);
      const roleOf = new Map((team ?? []).map((t) => [t.conference_id as string, t.role as string]));
      const base = db.from("conferences").select("*");
      const { data } = await (ids.length ? base.or(`submitted_by.eq.${userId},id.in.(${ids.join(",")})`) : base.eq("submitted_by", userId))
        .order("created_at", { ascending: false });
      const list = ((data ?? []) as (Parameters<typeof fromRow>[0] & { status: string; review_note: string; submitted_by: string | null })[])
        .map((r) => ({ c: fromRow(r), status: r.status, note: r.review_note, mine: r.submitted_by === userId, canEdit: r.submitted_by === userId || roleOf.get(r.id) === "editor" }));
      if (current) setRows(list);
    })();
    return () => { current = false; };
  }, [userId, version]);
  return rows;
}

