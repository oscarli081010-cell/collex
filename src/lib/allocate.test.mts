import { allocateByPreference, wants } from "../components/listing/manage/allocate.ts";
let checks = 0;
const ok = (v: unknown, m: string) => { checks++; if (!v) { console.error("FAIL", m); process.exit(1); } };
let n = 0;
const app = (o: Record<string, unknown> = {}) => ({ id: `a${++n}`, kind: "delegate", status: "accepted", committee: "", country: "", prefs: {}, created_at: `2027-01-01T00:00:${String(n).padStart(2, "0")}Z`, ...o }) as never;
const run = (apps: unknown[], committees: string[]) => allocateByPreference(apps as never[], committees);

// Preferences honoured
let a = app({ prefs: { committees: ["SC"], countries: ["France", "UK"] } });
let r = run([a], ["GA", "SC"]);
ok(r[(a as { id: string }).id]?.committee === "SC" && r[(a as { id: string }).id]?.country === "France", "first choices honoured");
// A committee that doesn't exist is skipped for the next choice
a = app({ prefs: { committees: ["Nope", "GA"], countries: ["Chad"] } });
r = run([a], ["GA", "SC"]);
ok(r[(a as { id: string }).id]?.committee === "GA", "unknown committee skipped");
// No preference goes to the emptiest committee
const fill = app({ committee: "GA", country: "Peru" });
const none = app();
r = run([fill, none], ["GA", "SC"]);
ok(r[(none as { id: string }).id]?.committee === "SC", "no choice goes to the emptiest committee");

// Nobody allocated twice; the already-placed are left alone
const placed = app({ committee: "GA", country: "Peru" });
r = run([placed], ["GA"]);
ok(Object.keys(r).length === 0, "already allocated delegates are not touched");
const many = Array.from({ length: 12 }, (_, i) => app({ prefs: { committees: ["GA"], countries: ["France", "UK"] }, created_at: `2027-01-02T00:00:${String(i).padStart(2, "0")}Z` }));
r = run(many, ["GA", "SC"]);
ok(Object.keys(r).length === 12 && new Set(Object.keys(r)).size === 12, "everyone gets exactly one allocation");

// No country twice in a committee (case-insensitive), even when everyone wants the same one
const same = Array.from({ length: 4 }, () => app({ prefs: { committees: ["GA"], countries: ["France", "france", "FRANCE"] } }));
r = run(same, ["GA"]);
const got = Object.values(r).map((x) => x.country).filter(Boolean);
ok(got.length === 1 && got[0] === "France", "only one delegate gets France: " + JSON.stringify(got));
ok(Object.values(r).every((x) => x.committee === "GA"), "all in GA");
// A country already given to a placed delegate, in a different case, can't be given again
const holder = app({ committee: "GA", country: "france" });
const wantsIt = app({ prefs: { committees: ["GA"], countries: ["FRANCE", "Chad"] } });
r = run([holder, wantsIt], ["GA"]);
ok(r[(wantsIt as { id: string }).id]?.country === "Chad", "taken country (any case) skipped");
// The same country in two committees is fine
const x1 = app({ prefs: { committees: ["GA"], countries: ["Peru"] } }), x2 = app({ prefs: { committees: ["SC"], countries: ["Peru"] } });
r = run([x1, x2], ["GA", "SC"]);
ok(r[(x1 as { id: string }).id]?.country === "Peru" && r[(x2 as { id: string }).id]?.country === "Peru", "same country in different committees");

// Earlier applications are served first
const first = app({ prefs: { committees: ["GA"], countries: ["Peru"] }, created_at: "2027-01-01T00:00:00Z" });
const second = app({ prefs: { committees: ["GA"], countries: ["Peru", "Chad"] }, created_at: "2027-01-03T00:00:00Z" });
r = run([second, first], ["GA"]);
ok(r[(first as { id: string }).id]?.country === "Peru" && r[(second as { id: string }).id]?.country === "Chad", "first come, first served");

// Chairs and others get a committee but no country; roles and the unaccepted are skipped
const chair = app({ kind: "chair", prefs: { committees: ["SC"], countries: ["France"] } });
const role = app({ kind: "role" }), waiting = app({ status: "new" }), declined = app({ status: "declined" });
r = run([chair, role, waiting, declined], ["GA", "SC"]);
ok(r[(chair as { id: string }).id]?.committee === "SC" && r[(chair as { id: string }).id]?.country === "", "chair: committee, no country");
ok(Object.keys(r).length === 1, "roles and unaccepted applications are skipped");
// A chair does not use up a country
const ch2 = app({ kind: "chair", prefs: { committees: ["GA"], countries: ["France"] }, created_at: "2027-01-01T00:00:00Z" });
const d2 = app({ prefs: { committees: ["GA"], countries: ["France"] }, created_at: "2027-01-02T00:00:00Z" });
r = run([ch2, d2], ["GA"]);
ok(r[(d2 as { id: string }).id]?.country === "France", "a chair doesn't take a country");

// Malformed preferences
for (const bad of [null, undefined, "x", 5, [], { committees: "GA", countries: "France" }, { committees: [1, null, {}], countries: [null, 3] }, { committees: null, countries: null }]) {
  const m = app({ prefs: bad });
  let res: ReturnType<typeof run> = {};
  try { res = run([m], ["GA"]); } catch (e) { ok(false, "malformed prefs threw: " + JSON.stringify(bad) + " " + e); }
  ok(res[(m as { id: string }).id]?.committee === "GA" && res[(m as { id: string }).id]?.country === "", "malformed prefs count as none: " + JSON.stringify(bad));
}
ok(JSON.stringify(wants({ prefs: { committees: ["A", 2], countries: "B" } as never })) === '{"committees":["A"],"countries":[]}', "wants() filters non-strings");
// Edge cases
ok(Object.keys(run([app()], [])).length === 0, "no committees, no allocation");
ok(Object.keys(run([], ["GA"])).length === 0, "no applications");
const nodate = app({ created_at: null as never });
ok(Object.keys(run([nodate], ["GA"])).length === 1, "missing created_at tolerated");
// Delegate with a placed committee but no country does not lose the committee count
const bal = Array.from({ length: 6 }, () => app());
r = run(bal, ["GA", "SC", "AC"]);
const sizes = ["GA", "SC", "AC"].map((c) => Object.values(r).filter((x) => x.committee === c).length);
ok(Math.max(...sizes) - Math.min(...sizes) <= 1, "unpreferred delegates spread evenly: " + sizes);
// Known behaviour that may be a defect (recorded, not asserted: this file belongs to someone else)
{
  const lower = app({ prefs: { committees: ["sc"], countries: ["Chad"] } });
  const got = run([lower], ["GA", "SC"])[(lower as { id: string }).id];
  if (got.committee !== "SC") console.warn(`NOTE allocate.ts: committee choices are matched case-sensitively ("sc" did not match "SC"; got ${got.committee}), but countries are not`);
}
// A delegate with a committee but no country is given a country, and keeps the committee
{
  const placed = app({ committee: "GA", country: "", prefs: { countries: ["France"] } });
  const got = run([placed], ["GA"])[(placed as { id: string }).id];
  ok(got?.committee === "GA" && got?.country === "France", "committee but no country: given a country");
  const none = app({ committee: "GA", country: "" });
  ok(!run([none], ["GA"])[(none as { id: string }).id], "committee, no country, no preference: left alone");
  const other = app({ committee: "GA", country: "France" });
  const second = app({ committee: "GA", country: "", prefs: { countries: ["France", "Chad"] } });
  ok(run([other, second], ["GA"])[(second as { id: string }).id]?.country === "Chad", "a taken country is skipped");
}
console.log(`allocate: ${checks} checks passed`);
