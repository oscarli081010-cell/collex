import { flagCode } from "./flags";

// Placards and country lists for a committee, printed from the browser (which can also save them as a PDF).
// Each is a small page of its own, built here as text and printed from a frame, so nothing of the site is on the paper.

export type Sheet = { conference: string; committee: string; dates: string };
export type ListRow = { country: string; delegate: string; school: string };

const esc = (t: string) => t.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);

/** The lines of a typed list as names: trimmed, blanks and repeats dropped, in the order typed. */
export function namesFrom(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const name = line.replace(/\s+/g, " ").trim().slice(0, 80);
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key); out.push(name);
  }
  return out;
}

const flag = (name: string, cls: string) => {
  const code = flagCode(name);
  return code ? `<img class="${cls}" src="/flags/${code}.svg" alt="">` : "";
};
const footer = (s: Sheet) => [s.committee, s.conference].filter(Boolean).map(esc).join(" &middot; ");

const BASE = `
*,*::before,*::after{box-sizing:border-box}
html,body{margin:0;padding:0;background:#fff;color:#111;font-family:var(--sans);-webkit-print-color-adjust:exact;print-color-adjust:exact}
img{display:block}
`;

/* A placard is one A4 sheet folded across the middle into a tent: the country's name on both faces, the top one
   upside down on the paper so it reads the right way up once folded. */
export const PLACARD_CSS = `${BASE}
@page{size:A4 portrait;margin:0}
.sheet{width:210mm;height:296.5mm;display:grid;grid-template-rows:1fr 1fr;page-break-after:always;break-after:page;overflow:hidden}
.sheet:last-child{page-break-after:auto;break-after:auto}
.face{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7mm;padding:12mm 16mm;min-height:0}
.face.back{transform:rotate(180deg)}
.face.front{border-top:0.2mm dashed #c9c9c9}
.flag{height:17mm;width:auto;border-radius:1mm;box-shadow:0 0 0 0.2mm #d9d9d9}
.fit{width:178mm;height:60mm;display:grid;place-items:center}
.name{display:block;max-width:100%;font-family:var(--serif),"Noto Sans","Noto Sans CJK SC","Noto Sans Arabic","Noto Sans Thai","Noto Sans Devanagari","Segoe UI",system-ui,sans-serif;font-weight:400;font-size:150pt;line-height:1.12;padding:0.02em 0;letter-spacing:-0.01em;text-align:center;text-wrap:balance;overflow-wrap:normal}
.name.broken{overflow-wrap:anywhere}
.foot{font-size:11pt;color:#666;letter-spacing:0.02em;text-align:center}
`;
export function placardsHtml(sheet: Sheet, countries: string[]): string {
  return countries.map((c) => {
    const face = `${flag(c, "flag")}<div class="fit"><span class="name">${esc(c)}</span></div><div class="foot">${footer(sheet)}</div>`;
    return `<section class="sheet"><div class="face back">${face}</div><div class="face front">${face}</div></section>`;
  }).join("");
}

/* A country list is a roll for the chair: every country, who represents it, and a box to tick when they are present. */
export const LIST_CSS = `${BASE}
@page{size:A4 portrait;margin:16mm 14mm}
h1{margin:0;font-family:var(--serif);font-weight:400;font-size:30pt;line-height:1.05;letter-spacing:-0.01em}
.sub{margin:2mm 0 7mm;font-size:10.5pt;color:#666}
table{width:100%;border-collapse:collapse;font-size:10.5pt}
thead{display:table-header-group}
th{text-align:left;font-weight:500;font-size:8.5pt;color:#666;padding:0 2mm 2mm;border-bottom:0.3mm solid #111}
td{padding:2.4mm 2mm;border-bottom:0.2mm solid #d9d9d9;vertical-align:middle}
tr{break-inside:avoid;page-break-inside:avoid}
.grp{padding:5mm 2mm 1.5mm;border-bottom:0.3mm solid #111;font-size:9pt}
.n{width:9mm;color:#666;font-variant-numeric:tabular-nums}
.c{font-weight:500}
.c span{display:inline-flex;align-items:center;gap:2.2mm}
.mini{height:3.6mm;width:auto;border-radius:0.4mm;box-shadow:0 0 0 0.15mm #d9d9d9}
.p{width:18mm;text-align:center}
.box{display:inline-block;width:4.4mm;height:4.4mm;border:0.3mm solid #111;border-radius:0.6mm;vertical-align:middle}
`;
/** `later` are delegates who have no country yet: they follow the countries, under a heading of their own. */
export function countryListHtml(sheet: Sheet, rows: ListRow[], later: ListRow[] = []): string {
  const sub = [sheet.conference, sheet.dates, `${rows.length} ${rows.length === 1 ? "country" : "countries"}`].filter(Boolean).map(esc).join(" &middot; ");
  const body = rows.map((r, i) => `<tr><td class="n">${i + 1}</td><td class="c"><span>${flag(r.country, "mini")}${esc(r.country)}</span></td><td>${esc(r.delegate)}</td><td>${esc(r.school)}</td><td class="p"><i class="box"></i></td></tr>`).join("");
  const more = later.length
    ? `<tr><th class="grp" colspan="5">No country yet</th></tr>` + later.map((r, i) => `<tr><td class="n">${rows.length + i + 1}</td><td class="c"><span>&ndash;</span></td><td>${esc(r.delegate)}</td><td>${esc(r.school)}</td><td class="p"><i class="box"></i></td></tr>`).join("")
    : "";
  return `<h1>${esc(sheet.committee || "Country list")}</h1><p class="sub">${sub}</p>`
    + `<table><thead><tr><th class="n">#</th><th>Country</th><th>Delegate</th><th>School</th><th class="p">Present</th></tr></thead><tbody>${body}${more}</tbody></table>`;
}

// The site's own typefaces, so the paper matches the screen: their @font-face rules and the names they go by here.
function fonts() {
  const faces: string[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    // A rule's addresses are written relative to its own stylesheet, so they are made whole before moving to another page.
    const from = sheet.href ?? location.href;
    const whole = (css: string) => css.replace(/url\((["']?)([^"')]+)\1\)/g, (all, _q, u: string) => { try { return `url("${new URL(u, from).href}")`; } catch { return all; } });
    try { for (const rule of Array.from(sheet.cssRules)) if (rule instanceof CSSFontFaceRule) faces.push(whole(rule.cssText)); } catch { /* a stylesheet from somewhere else can't be read */ }
  }
  const style = getComputedStyle(document.body);
  const serif = style.getPropertyValue("--font-serif").trim();
  const sans = style.getPropertyValue("--font-sans").trim();
  return { faces: faces.join("\n"), serif: [serif, "Georgia", "serif"].filter(Boolean).join(", "), sans: [sans, "Helvetica", "Arial", "sans-serif"].filter(Boolean).join(", ") };
}

const soon = <T,>(p: Promise<T>, ms: number) => Promise.race([p, new Promise<void>((r) => setTimeout(r, ms))]);

/** Builds the page in a frame off the screen, ready to print: typefaces and flags loaded, and every name on a placard
    shrunk until it fits its face. */
export async function buildFrame(title: string, css: string, body: string): Promise<HTMLIFrameElement> {
  const f = fonts();
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.tabIndex = -1;
  frame.style.cssText = "position:fixed;left:-10000px;top:0;width:210mm;height:297mm;border:0;opacity:0;pointer-events:none";
  document.body.appendChild(frame);
  const doc = frame.contentDocument!;
  doc.open();
  doc.write(`<!doctype html><html lang="en"><head><meta charset="utf-8"><base href="${location.origin}/"><title>${esc(title)}</title><style>${f.faces}\n:root{--serif:${f.serif};--sans:${f.sans}}\n${css}</style></head><body>${body}</body></html>`);
  doc.close();
  // Nothing is measured or printed before the typefaces and flags are in, or a name would be sized for the wrong letters.
  await soon(Promise.all([doc.fonts.load(`100px ${f.serif}`), doc.fonts.load(`500 12px ${f.sans}`)]).then(() => doc.fonts.ready).catch(() => {}), 3000);
  await soon(Promise.all(Array.from(doc.images).map((img) => img.decode().catch(() => {}))), 3000);
  for (const sheet of Array.from(doc.querySelectorAll<HTMLElement>(".sheet"))) {
    const names = Array.from(sheet.querySelectorAll<HTMLElement>(".name"));
    const first = names[0], box = first?.parentElement;
    if (!first || !box) continue;
    // A name may take two lines (or more at the smallest size), so it shrinks until the longest word fits across and all of
    // it fits down. Only when even the smallest size doesn't fit does a word get broken.
    let size = 150;
    const over = () => first.scrollWidth > first.clientWidth + 1 || first.offsetHeight > box.clientHeight + 1;
    while (size > 10 && over()) { size -= size > 60 ? 6 : size > 30 ? 3 : 1; first.style.fontSize = `${size}pt`; }
    const broken = over();
    for (const n of names) { n.style.fontSize = `${size}pt`; if (broken) n.classList.add("broken"); }
  }
  return frame;
}

/** Opens the browser's print window for a page built here. The frame is taken away once printing is over. */
export async function printHtml(title: string, css: string, body: string) {
  const frame = await buildFrame(title, css, body);
  const win = frame.contentWindow;
  if (!win) { frame.remove(); return; }
  const done = () => frame.remove();
  win.addEventListener("afterprint", done, { once: true });
  window.setTimeout(done, 10 * 60 * 1000); // some browsers never say printing is over
  win.focus();
  win.print();
}
