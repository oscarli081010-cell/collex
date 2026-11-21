import type { AppRow } from "../../ConferenceHub";

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
/** What an application asked for. Malformed or missing choices count as none, so one bad row can't break the panel. */
export const wants = (a: Pick<AppRow, "prefs">) => {
  const p = (a.prefs ?? {}) as { committees?: unknown; countries?: unknown };
  return { committees: strings(p.committees), countries: strings(p.countries) };
};

/** Committee names are compared without regard to case or stray spaces: "security council " is "Security Council". */
export const norm = (name: string) => name.trim().replace(/\s+/g, " ").toLowerCase();
/** The listing's own spelling of a committee, for a name typed or saved any way. */
export const committeeNamed = (committees: string[], name: string) => { const k = norm(name); return k ? committees.find((c) => norm(c) === k) : undefined; };

/** Applicants who chose, or were allocated to, a committee the listing no longer has. Applications that are over
    (declined or withdrawn) aren't counted: nothing more will happen to them. */
export function missingCommittees(apps: AppRow[], committees: string[]) {
  const names = new Map<string, string>();
  let people = 0;
  for (const a of apps) {
    if (a.status === "declined" || a.status === "withdrawn") continue;
    const gone = [...wants(a).committees, ...(a.committee ? [a.committee] : [])].filter((n) => n.trim() && !committeeNamed(committees, n));
    if (!gone.length) continue;
    people++;
    for (const n of gone) if (!names.has(norm(n))) names.set(norm(n), n.trim());
  }
  return { people, names: [...names.values()] };
}

/** Committees and countries for the accepted delegates who have none yet, from what each asked for: their first choice
    of committee that exists (else the emptiest one), and their first choice of country nobody in that committee has. A delegate who has a committee but no country is given a country. */
export function allocateByPreference(apps: AppRow[], committees: string[]): Record<string, { committee: string; country: string }> {
  const out: Record<string, { committee: string; country: string }> = {};
  const size = new Map(committees.map((c) => [c, 0]));
  const taken = new Map(committees.map((c) => [c, new Set<string>()]));
  const accepted = apps.filter((a) => a.status === "accepted" && a.kind !== "role").sort((a, b) => String(a.created_at ?? "").localeCompare(String(b.created_at ?? "")));
  for (const a of accepted) {
    const have = committeeNamed(committees, a.committee);
    if (have && a.kind === "delegate") { size.set(have, (size.get(have) ?? 0) + 1); if (a.country) taken.get(have)?.add(a.country.toLowerCase()); }
  }
  for (const a of accepted) {
    const placed = a.committee.trim();
    // Already placed: a delegate with a committee but no country still gets a country (and keeps the committee).
    if (placed && (a.kind !== "delegate" || a.country.trim())) continue;
    if (!placed && !committees.length) continue;
    if (placed) {
      const have = committeeNamed(committees, a.committee);
      const country = wants(a).countries.find((c) => !(have && taken.get(have)?.has(c.trim().toLowerCase()))) ?? "";
      if (!country) continue;
      if (have) taken.get(have)?.add(country.trim().toLowerCase());
      out[a.id] = { committee: a.committee, country };
      continue;
    }
    const wanted = wants(a).committees.map((c) => committeeNamed(committees, c)).find(Boolean);
    const committee = wanted ?? [...committees].sort((x, y) => (size.get(x) ?? 0) - (size.get(y) ?? 0))[0];
    let country = "";
    if (a.kind === "delegate") {
      size.set(committee, (size.get(committee) ?? 0) + 1);
      country = wants(a).countries.find((c) => !taken.get(committee)?.has(c.trim().toLowerCase())) ?? "";
      if (country) taken.get(committee)?.add(country.trim().toLowerCase());
    }
    out[a.id] = { committee, country };
  }
  return out;
}
