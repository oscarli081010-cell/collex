import { fromRow } from "./data";
import { supabase } from "./supabase";
import type { Entry, Loaded } from "@/components/ActivityView";
import type { Member } from "@/components/Team";

// What a listing's Activity page and edit form load. Both are separate pages, so each load is kept for a short while:
// moving from one to the other then shows the page at once instead of an empty frame while it loads again. The loads
// are also started in the background from the other page, so the first switch is quick too. A saved edit drops the copies.

const FRESH = 60_000;
// A kept copy is shown however old it is (up to KEEP), and refreshed in the background once it is past FRESH.
// Showing nothing while a stale copy reloads is what made the pages flash a skeleton when you'd been on one a while.
const KEEP = 600_000;
type Kept<T> = { at: number; value: T };
const activity = new Map<string, Kept<Loaded | "missing">>();
const editing = new Map<string, Kept<EditingData>>();

export type EditingData = { row: Record<string, unknown> | null; members: Member[] };

const kept = <T,>(m: Map<string, Kept<T>>, id: string) => {
  const k = m.get(id);
  return k && Date.now() - k.at < KEEP ? k.value : undefined;
};
const stale = <T,>(m: Map<string, Kept<T>>, id: string) => {
  const k = m.get(id);
  return !k || Date.now() - k.at >= FRESH;
};

export const keptActivity = (id: string) => kept(activity, id);
export const keptEditing = (id: string) => kept(editing, id);
export const staleEditing = (id: string) => stale(editing, id);
// The form's copy is dropped (it must never show old values); the Activity copy is only marked old, so that page still
// opens on what it had and fills in the new numbers a moment later.
export const forgetListing = (id: string) => {
  editing.delete(id);
  const a = activity.get(id);
  if (a) activity.set(id, { ...a, at: Math.min(a.at, Date.now() - FRESH) });
};

/** The Activity page's numbers for one listing, or "missing" when it isn't one the caller can see. */
export async function loadActivity(id: string, uid: string): Promise<Loaded | "missing" | null> {
  const db = supabase;
  if (!db) return null;
  const { data: row } = await db.from("conferences").select("*").eq("id", id).maybeSingle();
  if (!row) { activity.set(id, { at: Date.now(), value: "missing" }); return "missing"; } // not yours (or not there): the database only shows a listing to the people who edit it
  const [counts, weekly, followers, team, history] = await Promise.all([
    db.rpc("interest_counts"), db.rpc("interest_weekly"),
    db.rpc("listing_followers", { conf: id }), db.rpc("organisers_of", { conf: id }), db.rpc("listing_history", { conf: id }),
  ]);
  const total = Number(((counts.data ?? []) as { conference_id: string; interested: number }[]).find((r) => r.conference_id === id)?.interested ?? 0);
  const weeks = ((weekly.data ?? []) as { conference_id: string; week: string; interested: number }[])
    .filter((w) => w.conference_id === id).map((w) => ({ week: w.week, interested: Number(w.interested) }));
  const me = ((team.data ?? []) as { user_id: string; is_owner: boolean; role: string }[]).find((m) => m.user_id === uid);
  const value: Loaded = {
    c: fromRow(row), status: row.status, createdAt: row.created_at, canEdit: !me || me.is_owner || me.role === "editor",
    interest: { total, weeks }, followers: followers.error || followers.data == null ? null : Number(followers.data),
    team: ((team.data ?? []) as { accepted: boolean }[]).filter((m) => m.accepted).length,
    history: history.error ? null : ((history.data ?? []) as (Omit<Entry, "fields"> & { fields: string[] | null })[]).map((h) => ({ ...h, fields: h.fields ?? [] })),
  };
  activity.set(id, { at: Date.now(), value });
  return value;
}

/** The edit form's row and team for one listing. */
export async function loadEditing(id: string): Promise<EditingData | null> {
  const db = supabase;
  if (!db) return null;
  const [{ data }, team] = await Promise.all([
    db.from("conferences")
      .select("id, slug, status, name, host, start_date, end_date, venue, level, contact, fee, delegation_url, chair_url, delegation_opens_at, chair_opens_at, interest_url, overview, committees, guides, secretariat, roles, key_dates, cover_path")
      .eq("id", id).in("status", ["pending", "published"]).maybeSingle(),
    db.rpc("organisers_of", { conf: id }),
  ]);
  const value: EditingData = { row: (data as Record<string, unknown> | null) ?? null, members: (team.data as Member[] | null) ?? [] };
  editing.set(id, { at: Date.now(), value });
  return value;
}

/** Starts the other page's load quietly, so it is ready by the time someone switches to it. */
export const warmActivity = (id: string, uid: string) => { if (stale(activity, id)) loadActivity(id, uid).catch(() => {}); };
export const warmEditing = (id: string) => { if (stale(editing, id)) loadEditing(id).catch(() => {}); };
