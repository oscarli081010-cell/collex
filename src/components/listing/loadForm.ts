import type { EditingData } from "@/lib/listingData";
import { supabase } from "@/lib/supabase";
import type { Member } from "./organisers";

/** A listing as the edit form needs it, read fresh every time: the whole row (any status, with its review note and when it
    was last saved) and the team. `my_listings` is what gives the people who run a listing the columns the table hides, and
    it still returns a listing that was rejected or taken down. A row of null means it isn't theirs (any more). */
export async function loadForm(id: string): Promise<EditingData | null> {
  const db = supabase;
  if (!db) return null;
  const [mine, team] = await Promise.all([db.rpc("my_listings").eq("id", id).maybeSingle(), db.rpc("organisers_of", { conf: id })]);
  if (mine.error || team.error) return null;
  return { row: (mine.data as Record<string, unknown> | null) ?? null, members: (team.data as Member[] | null) ?? [] };
}
