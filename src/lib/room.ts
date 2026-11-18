// Delegates on their own devices (an option a chair turns on for a shared committee) and the papers a committee writes.
// A delegate never changes the committee: what they ask for waits in the chairs' inbox. This file is the words and
// shapes both sides share; the database functions are in supabase/migrations/0025_chamber_rooms.sql.
import * as ch from "./chamber";
import type { Chamber } from "./chamber";

export type AskKind = "floor" | "point" | "motion" | "amendment" | "sign";
export type Ask = { id: string; delegate_id?: string; kind: AskKind; body: Record<string, unknown>; status: "open" | "done" | "dismissed" | "withdrawn"; created_at: string };
export type Note = { id: string; from_id: string; to_id: string; body: string; created_at: string };
export type RoomFile = { id: string; from_id: string; name: string; path: string; size: number; created_at: string; mine: boolean };
export type PaperStatus = "draft" | "submitted" | "returned" | "approved" | "introduced";
export type PaperRow = { id: string; title: string; status: PaperStatus; number: string | null; sponsors: string[]; signatories: string[]; chair_note: string; version: number; created_at: string; updated_at: string };
export type Clause = { p: string; t: string; subs?: string[] };
export type PaperBody = { pre: Clause[]; op: Clause[] };
export type Paper = PaperRow & { body: PaperBody; chamber_id: string; can_edit: boolean; chair: boolean; seat: string | null };
/** The room's own settings, kept by the chairs: who may pass notes, and a straw poll. */
export type Straw = { id: string; q: string; options: string[]; open: boolean };
export type RoomMeta = { notes?: "on" | "chair" | "off"; straw?: Straw | null };
export type Seat = { user_id: string; delegate_id: string; name: string };
export type DelegateSync = { state: Chamber; version: number; name: string; now: string; seat: string; room: RoomMeta; asks: Ask[]; notes: Note[]; files: RoomFile[]; papers: PaperRow[]; votes: Record<string, string> };
export type ChairSync = { on: boolean; code: string | null; room: RoomMeta; seats: Seat[]; asks: Ask[]; notes: Note[]; files: RoomFile[]; papers: PaperRow[]; votes: { key: string; delegate_id: string; ballot: string }[] };

/** What is being voted on now, as the name delegates' votes are kept under; null when nothing is. */
export const voteKey = (c: Chamber): string | null =>
  c.poll ? `poll|${c.poll.kind}|${c.poll.motion ?? c.amend?.id ?? ""}|${c.amend?.stage ?? ""}`.slice(0, 200)
    : c.step === "vote" ? `res|${c.tr?.current ?? c.topic}`.slice(0, 200) : null;
export const voteTitle = (c: Chamber): string => (c.poll ? c.poll.title : c.step === "vote" ? `${ch.resNoun(c)}: ${ch.currentDoc(c)?.title ?? c.topic}` : "");
export const strawKey = (s: Straw) => `straw|${s.id}`;

export const POINTS = [["order", "Point of Order"], ["privilege", "Point of Personal Privilege"], ["inquiry", "Point of Inquiry"]] as const;
export const HOW_LABEL: Record<ch.AmendHow, string> = { strike: "Strike a clause", amend: "Change a clause", add: "Add a clause" };
export const PAPER_STATUS: Record<PaperStatus, string> = { draft: "Draft", submitted: "With the Chairs", returned: "Sent Back", approved: "Approved", introduced: "Introduced" };
export const PAPER_TONE: Record<PaperStatus, string | undefined> = { draft: undefined, submitted: "warn", returned: "bad", approved: "ok", introduced: "accent" };

const str = (v: unknown) => (typeof v === "string" ? v : "");
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

/** A request in the chairs' inbox, in words. */
export function askText(c: Chamber, a: Ask): { title: string; detail: string } {
  const b = a.body;
  switch (a.kind) {
    case "floor": return { title: "Asks for the floor", detail: ch.sided(c) && (b.side === "for" || b.side === "against") ? (b.side === "for" ? "In Favour" : "Against") : "" };
    case "point": return { title: POINTS.find(([k]) => k === b.kind)?.[1] ?? "Point", detail: str(b.text) };
    case "motion": {
      const kind = str(b.kind) as ch.MotionKind;
      const bits = [ch.MOTION_LABEL[kind] ?? "Motion", str(b.topic), num(b.total) ? ch.clock(num(b.total) * 1000) : "", num(b.per) ? `${num(b.per)}s each` : ""].filter(Boolean);
      return { title: "Proposes a motion", detail: bits.join(" · ") };
    }
    case "amendment": return { title: "Hands in an amendment", detail: [HOW_LABEL[(str(b.how) || "amend") as ch.AmendHow], str(b.clause), str(b.text)].filter(Boolean).join(" · ") };
    case "sign": {
      const am = c.amendments.find((x) => x.id === b.amendment);
      return { title: "Asks to sign an amendment", detail: am ? `From ${ch.nameOf(c, am.by)}${am.clause ? ` (${am.clause})` : ""}` : "That amendment is no longer waiting" };
    }
  }
}

/** Carry out a delegate's request on the committee. Returns the committee unchanged (the same object) when it can't be done now, with why. */
export function acceptAsk(c: Chamber, a: Ask, newId: string): { next: Chamber; why?: string } {
  const who = a.delegate_id ?? "";
  const b = a.body;
  if (!ch.has(c, who)) return { next: c, why: "That state is no longer in the committee." };
  let next = c;
  let why = "That can't be done at this point in the debate.";
  switch (a.kind) {
    case "floor": {
      const side: ch.Side = b.side === "against" ? "against" : "for";
      if (c.debate.list.some((x) => x.id === who)) return { next: c, why: "They are already on the list." };
      next = ch.listOpen(c) && ch.canAdd(c, who, side) ? ch.addToList(c, who, side, !ch.sided(c) && (b.side === "for" || b.side === "against")) : c;
      if (next === c) why = "The speakers' list isn't open, or they have already spoken on that side.";
      break;
    }
    case "point":
      next = c.tr && (b.kind === "order" || b.kind === "privilege" || b.kind === "inquiry") ? ch.logPoint(c, b.kind) : ch.note(c, `${POINTS.find(([k]) => k === b.kind)?.[1] ?? "Point"} from ${ch.nameOf(c, who)}`);
      break;
    case "motion": {
      const m: ch.MotionInput = { kind: str(b.kind) as ch.MotionKind, by: who, topic: str(b.topic), total: num(b.total), per: num(b.per) };
      const err = ch.motionsOpen(c) ? ch.motionError(c, m) : "Motions aren't being taken now.";
      if (err) return { next: c, why: err };
      next = ch.addMotion(c, newId, m);
      break;
    }
    case "amendment": {
      const how = (["strike", "amend", "add"].includes(str(b.how)) ? str(b.how) : "amend") as ch.AmendHow;
      next = ch.submitAmendment(c, newId, who, str(b.clause), str(b.text), [], str(b.seconder) || null, false, how);
      if (next === c) why = c.tr ? "Amendments aren't open, it needs a seconder, or that clause was already amended." : "Amendments aren't open now.";
      break;
    }
    case "sign":
      next = ch.signAmendment(c, str(b.amendment), who);
      if (next === c) why = "That amendment is no longer waiting, or they have already signed it.";
      break;
  }
  return next === c ? { next: c, why } : { next };
}

export const fileSize = (n: number) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
export const FILE_TYPES = ".pdf,.png,.jpg,.jpeg,.webp,.txt,.doc,.docx";
export const shortTime = (iso: string) => new Date(iso).toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" });

/* Papers: the standard phrases, and the paper set out the way a resolution is written. */
export const PRE_PHRASES = ["Acknowledging", "Affirming", "Alarmed by", "Aware of", "Bearing in mind", "Believing", "Concerned by", "Convinced", "Deeply concerned", "Emphasising", "Expressing its appreciation", "Guided by", "Having considered", "Keeping in mind", "Noting", "Noting with concern", "Reaffirming", "Recalling", "Recognising", "Welcoming"];
export const OP_PHRASES = ["Accepts", "Affirms", "Approves", "Authorises", "Calls for", "Calls upon", "Condemns", "Confirms", "Decides", "Declares", "Encourages", "Endorses", "Further invites", "Further requests", "Invites", "Notes", "Reaffirms", "Recommends", "Requests", "Strongly condemns", "Supports", "Urges"];
export const emptyBody = (): PaperBody => ({ pre: [], op: [] });
export const cleanBody = (b: unknown): PaperBody => {
  const o = (b ?? {}) as Partial<PaperBody>;
  const cl = (x: unknown): Clause[] => (Array.isArray(x) ? x.slice(0, 60).map((c) => ({ p: str((c as Clause)?.p).slice(0, 60), t: str((c as Clause)?.t).slice(0, 1200), subs: Array.isArray((c as Clause)?.subs) ? (c as Clause).subs!.slice(0, 12).map((v) => str(v).slice(0, 600)) : [] })) : []);
  return { pre: cl(o.pre), op: cl(o.op) };
};
const esc = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const sub = (i: number) => String.fromCharCode(97 + (i % 26));
/** The paper as a page of HTML, set out as a resolution: for printing (or saving as PDF) and for the Word file. */
export function paperHtml(o: { committee: string; topic: string; title: string; number: string | null; sponsors: string[]; signatories: string[]; body: PaperBody }): string {
  const pre = o.body.pre.filter((c) => c.p || c.t).map((c) => `<p class="pre"><i>${esc(c.p)}</i> ${esc(c.t.replace(/[,;.\s]+$/, ""))},</p>`).join("\n");
  const ops = o.body.op.filter((c) => c.p || c.t);
  const op = ops.map((c, i) => {
    const subs = (c.subs ?? []).filter(Boolean);
    const end = i === ops.length - 1 ? "." : ";";
    const body = `${esc(c.t.replace(/[,;.:\s]+$/, ""))}${subs.length ? ":" : end}`;
    const list = subs.length ? `<div class="subs">${subs.map((v, j) => `<p>(${sub(j)}) ${esc(v.replace(/[,;.\s]+$/, ""))}${j === subs.length - 1 ? end : ";"}</p>`).join("")}</div>` : "";
    return `<p class="op">${i + 1}. <u>${esc(c.p)}</u> ${body}</p>${list}`;
  }).join("\n");
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(o.title)}</title><style>
body{font-family:"Times New Roman",Times,serif;font-size:12pt;line-height:1.5;color:#000;max-width:17cm;margin:2cm auto;padding:0 1cm}
h1{font-size:14pt;text-align:center;margin:0 0 4pt}.meta{margin:0}.meta b{display:inline-block;min-width:3cm}
.lead{margin:14pt 0 8pt}.pre,.op{margin:0 0 8pt}.op{padding-left:1cm;text-indent:-0.6cm}.subs{padding-left:2cm}.subs p{margin:0 0 4pt}
hr{border:0;border-top:1px solid #000;margin:10pt 0}
@media print{body{margin:0 auto}}
</style></head><body>
<h1>${esc(o.number ? `Draft Resolution ${o.number}` : o.title)}</h1>
${o.number ? `<p class="meta"><b>Title:</b> ${esc(o.title)}</p>` : ""}
<p class="meta"><b>Committee:</b> ${esc(o.committee)}</p>
<p class="meta"><b>Topic:</b> ${esc(o.topic)}</p>
<p class="meta"><b>Sponsors:</b> ${esc(o.sponsors.join(", ") || "None yet")}</p>
<p class="meta"><b>Signatories:</b> ${esc(o.signatories.join(", ") || "None yet")}</p>
<hr>
<p class="lead"><i>The ${esc(o.committee)},</i></p>
${pre}
${op}
</body></html>`;
}
