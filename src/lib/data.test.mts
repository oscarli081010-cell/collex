import { fromRow, summaryFromRow } from "./data.ts";
let checks = 0;
const ok = (v: unknown, m: string) => { checks++; if (!v) { console.error("FAIL", m); process.exit(1); } };
const base = { id: "1", slug: "s", name: "N", short_name: "", host: "H", start_date: "2027-03-05", end_date: null, venue: "", level: "Open", key_dates: [], delegation_url: null, chair_url: null, fee: "", delegates: "", overview: "", contact: "", committees: [], guides: [], secretariat: [] };
const row = (o: Record<string, unknown> = {}) => ({ ...base, ...o }) as never;
const run = (o: Record<string, unknown>, label: string) => { try { return fromRow(row(o)); } catch (e) { ok(false, `fromRow threw for ${label}: ${e}`); throw e; } };

// A good row
const c = run({}, "good row");
ok(c.shortName === "N" && c.venue === "N/A" && c.fee === "N/A" && c.overview === "N/A" && c.contact === "N/A", "empty text shows N/A, short name falls back to name");
ok(c.claimable === false || c.claimable === true, "claimable is a boolean");
ok(c.schedule.length === 0 && c.roles?.length === 0, "missing schedule and roles are empty");

// Every jsonb column given something that isn't an array
for (const bad of [null, undefined, "text", 7, true, {}, { a: 1 }]) {
  const x = run({ key_dates: bad, committees: bad, guides: bad, secretariat: bad, schedule: bad, roles: bad }, `non-array ${JSON.stringify(bad)}`);
  ok(x.keyDates.length === 0 && x.committees.length === 0 && x.guides.length === 0 && x.secretariat.length === 0 && x.schedule.length === 0 && x.roles?.length === 0, `non-array jsonb reads as empty: ${JSON.stringify(bad)}`);
}
// Entries that aren't objects are dropped
const junk = [null, 5, "s", [], [1], undefined, true];
const j = run({ key_dates: junk, committees: junk, guides: junk, secretariat: junk, schedule: junk, roles: junk }, "junk entries");
ok(j.keyDates.length === 0 && j.committees.length === 0 && j.guides.length === 0 && j.secretariat.length === 0 && j.schedule.length === 0 && j.roles?.length === 0, "non-object entries dropped");
// Fields of the wrong type read as empty
const w = run({
  key_dates: [{ label: 5, date: 7 }], committees: [{ name: null, topic: 3, level: {}, chairs: [] }],
  guides: [{ committee: 1, released: 2, url: 3 }], secretariat: [{ role: 1, name: 2, photo: 3 }],
}, "wrong-typed fields");
ok(w.keyDates[0].label === "" && w.keyDates[0].date === null, "key date fields");
ok(w.committees[0].name === "" && w.committees[0].topic === "" && w.committees[0].level === "" && w.committees[0].chairs === "", "committee fields");
ok(w.guides[0].url === null && w.guides[0].released === null, "guide fields");
ok(w.secretariat[0].name === "" && !("photo" in w.secretariat[0]), "secretariat fields, bad photo dropped");
// Links that aren't plain web addresses are dropped
const l = run({ delegation_url: "javascript:alert(1)", chair_url: "ftp://x", interest_url: "  https://ok.example/a  ", guides: [{ committee: "GA", released: null, url: "data:text/html,x" }], roles: [{ kind: "tech", title: "T", note: "", url: "javascript:x" }] }, "links");
ok(l.delegationUrl === null && l.chairUrl === null, "non-web links dropped");
ok(l.interestUrl === "https://ok.example/a", "web link trimmed");
ok(l.guides[0].url === null, "guide link dropped");
ok(l.roles?.[0].url === null, "role link dropped");
// Roles with an unknown kind are dropped
ok(run({ roles: [{ kind: "wizard", title: "x" }, { kind: "tech", title: "T" }, { title: "none" }] }, "roles").roles?.length === 1, "unknown role kinds dropped");
// Whitespace-only text counts as empty
ok(run({ fee: "   ", venue: "\n", overview: " " }, "blank").fee === "N/A", "whitespace is empty");
// Dates and level pass through as given (the database types them)
ok(run({ start_date: null, end_date: null }, "no dates").startDate === null, "no dates");
// Cover positions
ok(run({ cover_path: null, cover_x: null, cover_y: null }, "no cover").coverPos === null, "no cover position");
ok(summaryFromRow(row({ cover_x: 10, cover_y: null })).coverPos === "10% 50%", "half a cover position");
// claimable defaults from the submitter
ok(run({ submitted_by: null }, "claimable").claimable === true && run({ submitted_by: "u" }, "owned").claimable === false, "claimable follows the submitter");
ok(run({ claimable: false, submitted_by: null }, "explicit").claimable === false, "explicit claimable wins");
// Missing optional columns
ok(run({ verified: undefined, collex_registration: undefined, collex_applications: undefined }, "flags").verified === false, "missing flags are false");
// A null in a text column never reaches a page as a non-string
for (const [what, o] of [["a number in a text column (fee)", { fee: 5 }], ["a null name", { name: null }], ["a null host", { host: null }], ["a null slug", { slug: null }]] as const) {
  const x = run(o as Record<string, unknown>, what);
  ok(typeof x.name === "string" && typeof x.host === "string" && typeof x.slug === "string" && typeof x.fee === "string", what + " is made safe");
}
console.log(`data: ${checks} checks passed`);
