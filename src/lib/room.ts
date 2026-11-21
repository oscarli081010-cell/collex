// Delegates on their own devices: an option a chair turns on for a shared committee.
// A delegate never changes the committee: what they ask for waits in the chairs' inbox. This file is the words and
// shapes both sides share; the database functions are in supabase/migrations/0025_chamber_rooms.sql.
import * as ch from "./chamber";
import type { Chamber } from "./chamber";

export type AskKind = "floor" | "point" | "motion" | "amendment" | "sign";
export type Ask = { id: string; delegate_id?: string; kind: AskKind; body: Record<string, unknown>; status: "open" | "done" | "dismissed" | "withdrawn"; created_at: string };
export type Note = { id: string; from_id: string; to_id: string; body: string; created_at: string };
export type RoomFile = { id: string; from_id: string; name: string; path: string; size: number; created_at: string; mine: boolean };
/** The room's own settings, kept by the chairs: who may pass notes, and a straw poll. */
export type Straw = { id: string; q: string; options: string[]; open: boolean };
// approveSeats: a seat waits for a chair to approve it before the person sees anything (off unless a chair turns it on).
export type RoomMeta = { notes?: "on" | "chair" | "off"; straw?: Straw | null; approveSeats?: boolean };
// `approved` is missing from a database older than migration 0041, where every seat counts as approved.
export type Seat = { user_id: string; delegate_id: string; name: string; approved?: boolean };
// A seat still waiting for the chair gets only { pending: true, name, seat, now }: nothing of the committee.
export type DelegateSync = { pending?: boolean; seat_name?: string; state: Chamber; version: number; name: string; now: string; seat: string; room: RoomMeta; asks: Ask[]; notes: Note[]; files: RoomFile[]; votes: Record<string, string> };
export type ChairSync = { on: boolean; code: string | null; room: RoomMeta; seats: Seat[]; asks: Ask[]; notes: Note[]; files: RoomFile[]; votes: { key: string; delegate_id: string; ballot: string }[] };

/** What is being voted on now, as the name delegates' votes are kept under; null when nothing is. */
export const voteKey = (c: Chamber): string | null =>
  // An amendment to the amendment is its own vote (a second one on the same amendment must not take the first's votes).
  c.poll ? `poll|${c.poll.kind}|${c.poll.motion ?? c.amend?.id ?? ""}|${c.amend?.stage ?? ""}${!c.poll.motion && c.amend?.sub ? `|sub|${c.amend.sub.id}` : ""}`.slice(0, 200)
    : c.step === "vote" ? `res|${c.tr?.current ?? c.topic}${c.divide ? `|p${c.divide.at}` : ""}`.slice(0, 200) : null; // each part of a divided question is its own vote
export const voteTitle = (c: Chamber): string => (c.poll ? c.poll.title : c.step === "vote" ? `${ch.resNoun(c)}: ${ch.currentDoc(c)?.title ?? c.topic}${ch.partText(c) ? ` (${ch.partText(c)})` : ""}` : "");
export const strawKey = (s: Straw) => `straw|${s.id}`;

export const POINTS = [["order", "Point of Order"], ["privilege", "Point of Personal Privilege"], ["inquiry", "Point of Inquiry"]] as const;
export const HOW_LABEL: Record<ch.AmendHow, string> = { strike: "Strike a clause", amend: "Change a clause", add: "Add a clause" };
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
