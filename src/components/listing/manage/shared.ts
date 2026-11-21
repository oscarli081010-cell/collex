import { supabase } from "@/lib/supabase";
import { ICONS } from "../../IconButton";

// What the Manage tab's sections share: the answers an organiser can give, and how dates and spreadsheets are written.

export type Answer = "new" | "accepted" | "waitlisted" | "declined";
/** Said once near the status buttons: decisions are emailed after a short wait. */
export const EMAIL_DELAY = "People are emailed 10 minutes after a decision, so you can fix a misclick.";
/** One round button per answer, instead of three words. */
export const FACES: { id: Exclude<Answer, "new">; label: string; icon: React.ReactNode }[] = [
  { id: "accepted", label: "Accept", icon: ICONS.check }, { id: "waitlisted", label: "Waitlist", icon: ICONS.clock }, { id: "declined", label: "Decline", icon: ICONS.close },
];

/** Every time in Manage is shown in Sydney. */
export const SYDNEY = "Times are Sydney time.";
export const when = (iso: string) => new Date(iso).toLocaleString("en-AU", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Australia/Sydney" });

/** One spreadsheet cell, always in quotes (so commas, quotes and line breaks stay inside it, with quotes doubled). A cell
    that starts with = + - @ or a tab or return would be run as a formula, so text like that gets an apostrophe in front.
    Real numbers are left as they are. */
export const cell = (v: string | number | null | undefined) => {
  if (typeof v === "number" && Number.isFinite(v)) return `"${v}"`;
  const t = v == null ? "" : String(v);
  return `"${(/^[=+\-@\t\r]/.test(t) ? `'${t}` : t).replaceAll('"', '""')}"`;
};
export const csv = (head: string[], rows: (string | number | null | undefined)[][]) => [head, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
/** Saves text as a spreadsheet file. The mark at the start makes Excel read accents correctly. */
export const saveCsv = (name: string, text: string) => {
  const url = URL.createObjectURL(new Blob(["﻿" + text], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
};

/** Sends whatever emails are waiting. */
export const sendMail = () => { supabase?.functions.invoke("mailer").catch(() => {}); };
