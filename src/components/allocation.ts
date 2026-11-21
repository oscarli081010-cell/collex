import { todayInSydney, type Conference } from "@/lib/conferences";
import { fromRow, PUBLIC_COLUMNS } from "@/lib/data";
import { supabase } from "@/lib/supabase";

// Shared by My allocation (account) and the Prepare page: the published listings an allocation belongs to, read in the
// browser, and the facts each needs from them. A failed read is an empty map, never an error on the page.
export async function conferencesById(ids: string[]): Promise<Map<string, Conference>> {
  const out = new Map<string, Conference>();
  if (!supabase || ids.length === 0) return out;
  try {
    const { data, error } = await supabase.from("conferences").select(PUBLIC_COLUMNS).eq("status", "published").in("id", ids);
    if (error || !data) return out;
    for (const r of data) { const c = fromRow(r as never); if (c.id) out.set(c.id, c); }
  } catch { /* offline or not reachable: shown without the listing's details */ }
  return out;
}

/** The committee's background guide, once it is released. Links were checked to be web addresses when read. */
export function guideFor(c: Conference | undefined, committee: string): string | null {
  if (!c || !committee) return null;
  const today = todayInSydney();
  const key = committee.trim().toLowerCase();
  return c.guides.find((g) => g.url && g.committee.trim().toLowerCase() === key && (!g.released || g.released <= today))?.url ?? null;
}

/** The committee as listed, for its topic. */
export const committeeOf = (c: Conference | undefined, committee: string) =>
  c?.committees.find((k) => k.name.trim().toLowerCase() === committee.trim().toLowerCase()) ?? null;

const short = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("en-AU", { day: "numeric", month: "short" });

/** The next key date still to come, or the conference itself: "Position papers due · 3 Feb". */
export function nextDate(c: Conference | undefined): string | null {
  if (!c) return null;
  const today = todayInSydney();
  const k = c.keyDates.filter((d) => d.date && d.date >= today).sort((a, b) => a.date!.localeCompare(b.date!))[0];
  if (k) return `${k.label} · ${short(k.date!)}`;
  return c.startDate && c.startDate >= today ? `Conference · ${short(c.startDate)}` : null;
}
