import type { AppRow } from "../../ConferenceHub";

/** Committees and countries for the accepted delegates who have none yet, from what each asked for: their first choice
    of committee that exists (else the emptiest one), and their first choice of country nobody in that committee has. */
export function allocateByPreference(apps: AppRow[], committees: string[]): Record<string, { committee: string; country: string }> {
  const out: Record<string, { committee: string; country: string }> = {};
  const size = new Map(committees.map((c) => [c, 0]));
  const taken = new Map(committees.map((c) => [c, new Set<string>()]));
  const accepted = apps.filter((a) => a.status === "accepted" && a.kind !== "role").sort((a, b) => a.created_at.localeCompare(b.created_at));
  for (const a of accepted) if (a.committee && a.kind === "delegate") { size.set(a.committee, (size.get(a.committee) ?? 0) + 1); if (a.country) taken.get(a.committee)?.add(a.country.toLowerCase()); }
  for (const a of accepted) {
    if (a.committee || !committees.length) continue;
    const wanted = (a.prefs.committees ?? []).find((c) => committees.includes(c));
    const committee = wanted ?? [...committees].sort((x, y) => (size.get(x) ?? 0) - (size.get(y) ?? 0))[0];
    let country = "";
    if (a.kind === "delegate") {
      size.set(committee, (size.get(committee) ?? 0) + 1);
      country = (a.prefs.countries ?? []).find((c) => !taken.get(committee)?.has(c.toLowerCase())) ?? "";
      if (country) taken.get(committee)?.add(country.toLowerCase());
    }
    out[a.id] = { committee, country };
  }
  return out;
}
