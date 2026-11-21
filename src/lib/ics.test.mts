import { ics, googleCalendarUrl } from "./ics.ts";
let checks = 0;
const ok = (v: unknown, m: string) => { checks++; if (!v) { console.error("FAIL", m); process.exit(1); } };
const conf = (o: Record<string, unknown> = {}) => ({ slug: "test-mun", name: "Test MUN", host: "Test School", startDate: "2027-03-05", endDate: "2027-03-06", venue: "Hall", isTemplate: false, ...o }) as never;
const lines = (s: string) => s.split("\r\n");
const unfold = (s: string) => s.replace(/\r\n /g, "");
const prop = (s: string, name: string) => unfold(s).split("\r\n").find((l) => l.startsWith(name + ":") || l.startsWith(name + ";"));

// Escaping
let out = ics([conf({ name: "A, B; C \\ D\nE", host: "H" })]);
ok(prop(out, "SUMMARY") === "SUMMARY:A\\, B\\; C \\\\ D\\nE", "escapes comma, semicolon, backslash, newline: " + prop(out, "SUMMARY"));
out = ics([conf({ name: "Line1\r\nLine2" })]);
ok(prop(out, "SUMMARY") === "SUMMARY:Line1\\nLine2", "CRLF becomes \\n");
// A lone carriage return must not start a new property
out = ics([conf({ name: "Evil\rATTENDEE:mailto:x@y.z" })]);
ok(!/^ATTENDEE/m.test(unfold(out).replace(/\r\n/g, "\n")), "lone CR can't inject a property");
ok(!/\r(?!\n)/.test(out), "no bare CR anywhere in the output");
out = ics([conf({ name: "Tab\there\u0000nul" })]);
ok(!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(out), "control characters stripped");
// Every line break in the file is CRLF
ok(/\r\n$/.test(out) && !/[^\r]\n/.test(out), "CRLF line endings");

// Folding
const long = "Ünïcödé ".repeat(20) + "日本語の会議".repeat(10) + "😀".repeat(15);
out = ics([conf({ name: long })]);
const raw = lines(out);
ok(raw.every((l) => new TextEncoder().encode(l).length <= 75), "no line over 75 octets: " + Math.max(...raw.map((l) => new TextEncoder().encode(l).length)));
ok(prop(out, "SUMMARY") === "SUMMARY:" + long, "unfolding gives the original text back");
ok(raw.some((l) => l.startsWith(" ")), "long line was folded");
ok(!unfold(out).includes("�"), "multi-byte characters never split");
const exact = "x".repeat(75 - "SUMMARY:".length);
out = ics([conf({ name: exact })]);
ok(lines(out).includes("SUMMARY:" + exact), "a line of exactly 75 octets is not folded");
out = ics([conf({ name: exact + "y" })]);
ok(lines(out).includes("SUMMARY:" + exact) && lines(out).includes(" y"), "76 octets folds");

// Dates
out = ics([conf()]);
ok(prop(out, "DTSTART;VALUE=DATE") === "DTSTART;VALUE=DATE:20270305", "start");
ok(prop(out, "DTEND;VALUE=DATE") === "DTEND;VALUE=DATE:20270307", "multi-day end is the day after the last day (exclusive)");
out = ics([conf({ endDate: null })]);
ok(prop(out, "DTEND;VALUE=DATE") === "DTEND;VALUE=DATE:20270306", "no end date means one day");
out = ics([conf({ startDate: "2027-12-31", endDate: "2028-01-02" })]);
ok(prop(out, "DTEND;VALUE=DATE") === "DTEND;VALUE=DATE:20280103", "ends across a year");
out = ics([conf({ startDate: "2028-02-28", endDate: "2028-02-29" })]);
ok(prop(out, "DTEND;VALUE=DATE") === "DTEND;VALUE=DATE:20280301", "leap day");
out = ics([conf({ startDate: "2027-03-05", endDate: "2027-03-01" })]);
ok(prop(out, "DTEND;VALUE=DATE") === "DTEND;VALUE=DATE:20270306", "an end before the start is treated as one day");
ok(googleCalendarUrl(conf({ endDate: null })).includes("dates=20270305%2F20270306"), "google link, one day");
ok(googleCalendarUrl(conf()).includes("dates=20270305%2F20270307"), "google link, two days");

// Which events appear
out = ics([conf(), conf({ slug: "b", startDate: null }), conf({ slug: "tpl", isTemplate: true })]);
ok((out.match(/BEGIN:VEVENT/g) ?? []).length === 1, "undated and template listings are left out");
out = ics([]);
ok(out.startsWith("BEGIN:VCALENDAR\r\n") && out.endsWith("END:VCALENDAR\r\n") && !out.includes("VEVENT"), "empty calendar is still valid");
ok(prop(ics([conf()], "Collex, all"), "X-WR-CALNAME") === "X-WR-CALNAME:Collex\\, all", "calendar name escaped");
ok(prop(ics([conf()]), "UID") === "UID:test-mun@collex.au", "uid");
ok(prop(ics([conf({ venue: "N/A" })]), "LOCATION") === "LOCATION:Test School", "N/A venue is left out of the location");
console.log(`ics: ${checks} checks passed`);
