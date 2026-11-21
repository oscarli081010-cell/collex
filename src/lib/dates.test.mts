import { clashesNear, formatDate, formatRange, isPast, monthLabel, onDay, todayInSydney } from "./conferences.ts";
import { isoToSydney, shortOpens, sydneyToIso, whenOpens } from "./schedule.ts";
let checks = 0;
const ok = (v: unknown, m: string) => { checks++; if (!v) { console.error("FAIL", m); process.exit(1); } };

// A fake clock: `new Date()` with no arguments gives this instant; dates made from arguments are untouched.
const RealDate = Date;
let frozen: string | null = null;
class FakeDate extends RealDate {
  constructor(...a: unknown[]) { if (a.length === 0 && frozen) super(frozen); else super(...(a as [string])); }
  static now() { return frozen ? new RealDate(frozen).getTime() : RealDate.now(); }
}
globalThis.Date = FakeDate as unknown as DateConstructor;
const at = (iso: string) => { frozen = iso; };

// Viewers in different time zones all see the same Sydney "today" and the same results.
for (const tz of ["Australia/Sydney", "UTC", "America/Los_Angeles", "Pacific/Pago_Pago", "Pacific/Kiritimati", "Europe/London", "Asia/Kolkata", "America/Havana"]) {
  process.env.TZ = tz;
  ok(new RealDate(2027, 0, 15).getTimezoneOffset() === {
    "Australia/Sydney": -660, UTC: 0, "America/Los_Angeles": 480, "Pacific/Pago_Pago": 660, "Pacific/Kiritimati": -840, "Europe/London": 0, "Asia/Kolkata": -330, "America/Havana": 300,
  }[tz], `[${tz}] the process really is in that time zone`);
  const t = (iso: string, want: string) => { at(iso); const got = todayInSydney(); ok(got === want, `[${tz}] todayInSydney at ${iso} = ${want}, got ${got}`); };
  // An ordinary summer day (AEDT, UTC+11) and winter day (AEST, UTC+10)
  t("2027-01-14T12:59:00Z", "2027-01-14"); t("2027-01-14T13:00:00Z", "2027-01-15");
  t("2027-07-14T13:59:00Z", "2027-07-14"); t("2027-07-14T14:00:00Z", "2027-07-15");
  // Daylight saving ends Sunday 4 April 2027 at 3am (clocks back to 2am)
  t("2027-04-03T12:59:00Z", "2027-04-03"); t("2027-04-03T13:00:00Z", "2027-04-04"); t("2027-04-03T16:00:00Z", "2027-04-04");
  t("2027-04-04T13:59:00Z", "2027-04-04"); t("2027-04-04T14:00:00Z", "2027-04-05");
  // Daylight saving starts Sunday 3 October 2027 at 2am (clocks forward to 3am)
  t("2027-10-02T13:59:00Z", "2027-10-02"); t("2027-10-02T14:00:00Z", "2027-10-03"); t("2027-10-02T16:00:00Z", "2027-10-03");
  t("2027-10-03T12:59:00Z", "2027-10-03"); t("2027-10-03T13:00:00Z", "2027-10-04");
  // New Year and a leap day
  t("2026-12-31T12:59:00Z", "2026-12-31"); t("2026-12-31T13:00:00Z", "2027-01-01");
  t("2028-02-28T13:00:00Z", "2028-02-29"); t("2028-02-29T13:00:00Z", "2028-03-01");

  // isPast: a conference is past only after its last day (Sydney time)
  at("2027-03-06T14:00:00Z"); // 7 Mar 2027 01:00 in Sydney
  ok(isPast({ startDate: "2027-03-05", endDate: "2027-03-06" }), `[${tz}] ended yesterday is past`);
  at("2027-03-06T12:00:00Z"); // 6 Mar 23:00 in Sydney: its last day is still today
  ok(!isPast({ startDate: "2027-03-05", endDate: "2027-03-06" }), `[${tz}] still on its last day`);
  ok(!isPast({ startDate: null, endDate: null }), `[${tz}] undated is never past`);
  ok(isPast({ startDate: "2027-03-05", endDate: null }) && !isPast({ startDate: "2027-03-06", endDate: null }), `[${tz}] one-day event`);

  // Formatting uses the date as written, in any viewer's zone
  ok(formatDate("2027-03-05") === new RealDate(2027, 2, 5).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short", year: "numeric" }), `[${tz}] formatDate`);
  ok(formatDate("2027-03-05").includes("5") && formatDate("2027-03-05").includes("Mar") && formatDate("2027-03-05").includes("Fri"), `[${tz}] 5 Mar 2027 is a Friday: ${formatDate("2027-03-05")}`);
  ok(formatDate("2027-10-03").includes("Sun") && formatDate("2027-04-04").includes("Sun"), `[${tz}] DST changeover days are Sundays`);
  ok(formatDate(null) === "Date to be announced", `[${tz}] no date`);
  ok(!formatRange({ startDate: "2027-03-05", endDate: "2027-03-05" }).includes(" to ") && formatRange({ startDate: "2027-03-05", endDate: "2027-03-06" }).includes(" to "), `[${tz}] formatRange`);
  ok(formatRange({ startDate: null, endDate: null }) === "Date to be announced", `[${tz}] range with no start`);

  // The date-clash weekend (Friday to Sunday), across months and years and DST days
  const list = [
    { startDate: "2027-01-01", endDate: "2027-01-01" }, // Fri
    { startDate: "2027-01-03", endDate: "2027-01-03" }, // Sun
    { startDate: "2027-01-04", endDate: "2027-01-04" }, // Mon
    { startDate: "2026-12-28", endDate: "2027-01-01" }, // runs up to the Friday
    { startDate: null, endDate: null },
    { startDate: "2027-10-03", endDate: "2027-10-03" }, // Sun, DST starts
    { startDate: "2027-04-04", endDate: "2027-04-04" }, // Sun, DST ends
    { startDate: "2027-04-02", endDate: "2027-04-05" }, // Good Friday to Easter Monday
  ];
  const near = (iso: string) => clashesNear(list, iso).map((x) => list.indexOf(x));
  ok(JSON.stringify(near("2027-01-02")) === "[0,1,3]", `[${tz}] weekend of Sat 2 Jan 2027, across the new year: ${near("2027-01-02")}`);
  ok(JSON.stringify(near("2027-01-01")) === "[0,1,3]" && JSON.stringify(near("2027-01-03")) === "[0,1,3]", `[${tz}] Fri and Sun give the same weekend`);
  ok(JSON.stringify(near("2027-01-04")) === "[0,1,3]", `[${tz}] Monday belongs to the weekend before it: ${near("2027-01-04")}`);
  ok(JSON.stringify(near("2027-10-03")) === "[5]", `[${tz}] DST start weekend: ${near("2027-10-03")}`);
  ok(JSON.stringify(near("2027-04-03")) === "[6,7]", `[${tz}] DST end weekend: ${near("2027-04-03")}`);
  ok(JSON.stringify(near("2027-04-04")) === "[6,7]", `[${tz}] DST end Sunday`);
  ok(clashesNear(list, "2027-06-12").length === 0, `[${tz}] an empty weekend`);

  // onDay
  ok(onDay(list, "2027-01-01").length === 2 && onDay(list, "2027-01-02").length === 0, `[${tz}] onDay`);
  ok(onDay(list, "2027-04-05").length === 1, `[${tz}] onDay inclusive of the last day`);
  ok(monthLabel("2027-03") === "March 2027" && monthLabel("2026-12") === "December 2026", `[${tz}] monthLabel`);

  // Sydney wall-clock times and the instants they mean
  ok(sydneyToIso("2027-01-15T09:00") === "2027-01-14T22:00:00.000Z", `[${tz}] summer time is UTC+11`);
  ok(sydneyToIso("2027-07-15T09:00") === "2027-07-14T23:00:00.000Z", `[${tz}] winter time is UTC+10`);
  ok(sydneyToIso("2027-04-03T09:00") === "2027-04-02T22:00:00.000Z", `[${tz}] day before DST ends is +11`);
  ok(sydneyToIso("2027-04-04T09:00") === "2027-04-03T23:00:00.000Z", `[${tz}] day DST ends is +10 by morning`);
  ok(sydneyToIso("2027-10-02T09:00") === "2027-10-01T23:00:00.000Z", `[${tz}] day before DST starts is +10`);
  ok(sydneyToIso("2027-10-03T09:00") === "2027-10-02T22:00:00.000Z", `[${tz}] day DST starts is +11 by morning`);
  const amb = sydneyToIso("2027-04-04T02:30"); // happens twice
  ok(amb === "2027-04-03T15:30:00.000Z" || amb === "2027-04-03T16:30:00.000Z", `[${tz}] ambiguous time picks one of the two: ${amb}`);
  const gap = sydneyToIso("2027-10-03T02:30"); // never happens
  ok(typeof gap === "string" && !Number.isNaN(Date.parse(gap)), `[${tz}] a time that doesn't exist still gives an instant: ${gap}`);
  for (const local of ["2027-01-15T09:00", "2027-07-15T23:59", "2027-04-04T09:00", "2027-10-03T09:00", "2027-12-31T23:59", "2028-02-29T00:00", "2027-04-03T23:30", "2027-10-02T23:30"]) {
    ok(isoToSydney(sydneyToIso(local)) === local, `[${tz}] round trip ${local} -> ${isoToSydney(sydneyToIso(local))}`);
  }
  ok(sydneyToIso("") === null && sydneyToIso("2027-13-40T09:00") === null && sydneyToIso("2027-01-15 09:00") === null && sydneyToIso("2027-01-15T9:00") === null, `[${tz}] bad input gives null`);
  ok(sydneyToIso("2027-02-30T09:00") === null || typeof sydneyToIso("2027-02-30T09:00") === "string", `[${tz}] impossible date does not throw`);
  ok(isoToSydney(null) === "" && isoToSydney("") === "" && isoToSydney("nonsense") === "", `[${tz}] isoToSydney with nothing or nonsense`);
  ok(isoToSydney("2027-01-14T22:00:00Z") === "2027-01-15T09:00", `[${tz}] isoToSydney`);
  ok(isoToSydney("2027-01-14T13:00:00Z") === "2027-01-15T00:00" && !isoToSydney("2027-01-14T13:00:00Z").includes("T24"), `[${tz}] midnight is 00:00, never 24:00`);

  at("2027-03-01T00:00:00Z");
  ok(/Sun/.test(whenOpens("2027-04-03T23:00:00Z")) && /\b4\b/.test(whenOpens("2027-04-03T23:00:00Z")) && /Apr/.test(whenOpens("2027-04-03T23:00:00Z")) && /9:00/.test(whenOpens("2027-04-03T23:00:00Z")), `[${tz}] whenOpens this year, in Sydney time: ${whenOpens("2027-04-03T23:00:00Z")}`);
  ok(whenOpens("2028-04-03T23:00:00Z").includes("2028"), `[${tz}] whenOpens another year shows the year`);
  ok(shortOpens("2027-04-03T23:00:00Z") === "4 Apr", `[${tz}] shortOpens: ${shortOpens("2027-04-03T23:00:00Z")}`);
  // New Year's Eve in the viewer's zone is already the next year in Sydney
  at("2026-12-31T14:00:00Z"); // 1 Jan 2027 01:00 in Sydney
  ok(!whenOpens("2027-02-03T22:00:00Z").includes("2027"), `[${tz}] the year is Sydney's year, not the viewer's: ${whenOpens("2027-02-03T22:00:00Z")}`);
}
console.log(`dates: ${checks} checks passed`);
