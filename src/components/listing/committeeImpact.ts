import { supabase } from "@/lib/supabase";
import type { CommitteeRow } from "../RowEditors";
import { norm, wants } from "./manage/allocate";

/** What renaming or removing committees does to people already placed in them. Applicants' choices are their own and can't
    be changed from here; allocations can. */
export type Impact = {
  renames: { from: string; to: string }[]; removed: string[];
  /** Accepted people placed in a committee being renamed: moved to the new name by "Also Update Allocations". */
  moves: { id: string; country: string; to: string }[];
  /** Accepted people placed in a committee being removed. */
  orphaned: number;
  /** Applicants who chose a committee being renamed or removed. */
  choices: number;
};

/** The renames and removals in an edit, and who they touch. Null when none of it touches anyone (or it can't be told). */
export async function impactOf(conf: string, rows: CommitteeRow[], saved: string[]): Promise<Impact | null> {
  const named = rows.filter((r) => r.name.trim());
  const renames = named.filter((r) => r.was && norm(r.name) !== norm(r.was)).map((r) => ({ from: r.was!, to: r.name.trim() }));
  const kept = new Set(named.filter((r) => r.was).map((r) => norm(r.was!)));
  // A saved name that is still in the list (removed and added again) isn't gone: the people in it stay where they are.
  const removed = saved.filter((n) => n.trim() && !kept.has(norm(n)) && !named.some((r) => norm(r.name) === norm(n)));
  if (!renames.length && !removed.length) return null;
  if (!supabase) return null;
  const { data, error } = await supabase.from("applications").select("id, committee, country, prefs, status").eq("conference_id", conf);
  if (error) return null;
  const apps = (data ?? []) as { id: string; committee: string; country: string; prefs: unknown; status: string }[];
  // A committee kept under its own name is never touched, even when another one with a name that differs only in case or
  // spacing is renamed or removed; otherwise an exact match wins over a loose one.
  const stays = new Set(named.filter((r) => r.was && norm(r.name) === norm(r.was)).map((r) => r.was!.trim()));
  const target = (name: string) => renames.find((r) => r.from.trim() === name.trim())?.to ?? renames.find((r) => norm(r.from) === norm(name))?.to;
  const gone = new Set([...renames.map((r) => norm(r.from)), ...removed.map(norm)]);
  const moves: Impact["moves"] = [];
  let orphaned = 0, choices = 0;
  for (const a of apps) {
    if (a.status === "withdrawn") continue;
    const placed = a.committee && !stays.has(a.committee.trim()) ? a.committee : "";
    const to = placed ? target(placed) : undefined;
    if (to) moves.push({ id: a.id, country: a.country ?? "", to });
    else if (placed && gone.has(norm(placed))) orphaned++;
    if (a.status !== "declined" && wants({ prefs: a.prefs as never }).committees.some((n) => gone.has(norm(n)))) choices++;
  }
  return moves.length || orphaned || choices ? { renames, removed, moves, orphaned, choices } : null;
}

/** Puts the people allocated to a renamed committee in it under its new name. They show as waiting for an allocation email again. */
export async function moveAllocations(conf: string, moves: Impact["moves"]): Promise<boolean> {
  if (!supabase || !moves.length) return true;
  const { error } = await supabase.rpc("allocate_applications", { conf, allocations: moves.map((m) => ({ id: m.id, committee: m.to, country: m.country })) });
  return !error;
}

export { norm };
