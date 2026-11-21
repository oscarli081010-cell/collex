import { countryListHtml, namesFrom, placardsHtml } from "./printables.ts";
let checks = 0;
const ok = (v: unknown, m: string) => { checks++; if (!v) { console.error("FAIL", m); process.exit(1); } };
const count = (hay: string, needle: string) => hay.split(needle).length - 1;
const sheet = { conference: "Test MUN", committee: "Security Council", dates: "5 Mar 2027" };

// Typed lists
ok(JSON.stringify(namesFrom("France\r\n  uk \n\nFRANCE\nChina\n")) === '["France","uk","China"]', "trimmed, blanks and repeats (any case) dropped, order kept: " + JSON.stringify(namesFrom("France\r\n  uk \n\nFRANCE\nChina\n")));
ok(namesFrom("").length === 0 && namesFrom("\n\n \n").length === 0, "empty input");
ok(namesFrom("a   b\t c")[0] === "a b c", "inner whitespace collapsed");
ok(namesFrom("x".repeat(200))[0].length === 80, "names are capped at 80 characters");

// Country list: every person once, in order
const rows = ["France", "United Kingdom", "China", "Côte d'Ivoire", "Observer Group"].map((country, i) => ({ country, delegate: `Delegate Number${i}`, school: `School Number${i}` }));
const list = countryListHtml(sheet, rows);
for (const r of rows) {
  ok(count(list, r.delegate) === 1, `${r.delegate} appears exactly once`);
  ok(count(list, r.school) === 1, `${r.school} appears exactly once`);
}
ok(list.indexOf("France") < list.indexOf("China") && list.indexOf("China") < list.indexOf("Observer Group"), "rows keep their order");
for (const r of rows) ok(count(list, r.country.replace("'", "&#39;")) >= 1, `${r.country} is listed`);
ok(typeof countryListHtml(sheet, []) === "string" && typeof countryListHtml({ conference: "", committee: "", dates: "" }, []) === "string", "an empty list still renders");

// Placards: one sheet per country, each country's name on the sheet
const names = ["France", "United Kingdom", "China"];
const cards = placardsHtml(sheet, names);
for (const n of names) ok(count(cards, n) >= 1, `${n} is on a placard`);
ok(!cards.includes("Spain"), "no country that was not asked for");
ok(placardsHtml(sheet, []) === "", "no countries, no sheets");

// Markup in names never reaches the page unescaped
const evil = `<img src=x onerror=alert(1)> & "q" 'a'`;
const html = placardsHtml({ conference: evil, committee: evil, dates: evil }, [evil]) + countryListHtml({ conference: evil, committee: evil, dates: evil }, [{ country: evil, delegate: evil, school: evil }]);
ok(!html.includes("<img src=x") && !html.includes("<script"), "names and titles are escaped");
ok(html.includes("&lt;img src=x onerror=alert(1)&gt; &amp; &quot;q&quot; &#39;a&#39;"), "escaped form present");
console.log(`printables: ${checks} checks passed`);
