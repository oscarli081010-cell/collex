import { supabase } from "@/lib/supabase";
import { ICONS } from "../../IconButton";

// What the Manage tab's sections share: the answers an organiser can give, and how dates and spreadsheets are written.

export type Answer = "new" | "accepted" | "waitlisted" | "declined";
/** One round button per answer, instead of three words. */
export const FACES: { id: Exclude<Answer, "new">; label: string; icon: React.ReactNode }[] = [
  { id: "accepted", label: "Accept", icon: ICONS.check }, { id: "waitlisted", label: "Waitlist", icon: ICONS.clock }, { id: "declined", label: "Decline", icon: ICONS.close },
];

export const when = (iso: string) => new Date(iso).toLocaleString("en-AU", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Australia/Sydney" });

/** A spreadsheet runs a cell that starts with = + - or @ as a formula, so such text gets a quote in front. */
export const cell = (v: string | number) => {
  const t = String(v);
  return `"${(/^[=+\-@\t\r]/.test(t) ? `'${t}` : t).replaceAll('"', '""')}"`;
};
export const csv = (head: string[], rows: (string | number)[][]) => [head, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
/** Saves text as a spreadsheet file. The mark at the start makes Excel read accents correctly. */
export const saveCsv = (name: string, text: string) => {
  const url = URL.createObjectURL(new Blob(["﻿" + text], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
};

/** Sends whatever emails are waiting. */
export const sendMail = () => { supabase?.functions.invoke("mailer").catch(() => {}); };
