import type { Entry } from "../types";

// How the audit log reads: what each recorded action is called, who did it, and when.

export const STATUS: Record<string, string> = { pending: "In review", published: "Live", rejected: "Not approved", unpublished: "Taken down" };

/** The chip in a listing's header. */
export const STATUS_CHIP: Record<string, string> = { pending: "Waiting for Review", published: "Live", rejected: "Rejected", unpublished: "Unpublished" };

// What a changed column is called to a person.
const FIELD: Record<string, string> = {
  name: "the name", short_name: "the short name", host: "the host school", start_date: "the first day", end_date: "the last day",
  venue: "the venue", level: "the level", contact: "the contact email", fee: "the delegate fee", delegates: "the delegate count",
  delegation_url: "the registration link", collex_registration: "registering on Collex", chair_url: "the chair application link", interest_url: "the interest form link",
  overview: "the overview", committees: "the committees", guides: "the background guides", cover_path: "the cover photo", cover_x: "the cover photo position", thumb_path: "the photo in the lists", thumb_x: "the list photo position", thumb_y: "the list photo position", cover_y: "the cover photo position",
  key_dates: "the key dates", schedule: "the schedule", delegation_opens_at: "when registration opens", chair_opens_at: "when chair applications open", roles: "the help wanted", secretariat: "the secretariat", submitter_role: "the submitter's role", verified: "the Verified badge",
};
const fieldName = (k: string) => FIELD[k] ?? `the ${k.replaceAll("_", " ")}`;
const list = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

// The Collex team does the reviewing, whichever admin it was.
export const STAFF = new Set(["approved", "rejected", "unpublished", "reopened"]);
export const SENTENCE: Record<string, (e: Entry) => string> = {
  submitted: () => "sent the listing for review",
  approved: () => "approved the listing, and it went live",
  rejected: () => "didn’t approve the listing",
  unpublished: () => "took the listing down",
  reopened: () => "reopened the listing for review",
  edited: (e) => (e.fields.length ? `changed ${list(e.fields.map(fieldName))}` : "saved the listing"),
  "invited organiser": (e) => `invited ${e.subject ?? "someone"} to ${e.role === "viewer" ? "see its activity" : "help run it"}`,
  "changed organiser role": (e) => `made ${e.subject ?? "someone"} ${e.role === "viewer" ? "view only" : "able to edit"}`,
  "accepted organiser invite": () => "joined the team",
  "removed organiser": (e) => `removed ${e.subject ?? "someone"} from the team`,
  "left organisers": () => "left the team",
  "registration received": () => "registered a delegation",
  "registration accepted": () => "accepted a registration",
  "registration waitlisted": () => "waitlisted a registration",
  "registration declined": () => "declined a registration",
  "registration new": () => "moved a registration back to new",
  "registration withdrawn": () => "withdrew their registration",
};
export const TONE: Record<string, string> = { approved: "ok", rejected: "bad", unpublished: "warn", submitted: "accent", reopened: "warn", "removed organiser": "bad", "left organisers": "warn" };

export const when = (iso: string) => {
  const d = new Date(iso);
  const sameYear = d.toLocaleDateString("en-AU", { year: "numeric", timeZone: "Australia/Sydney" }) === new Date().toLocaleDateString("en-AU", { year: "numeric", timeZone: "Australia/Sydney" });
  return d.toLocaleString("en-AU", { day: "numeric", month: "short", ...(sameYear ? {} : { year: "numeric" }), hour: "numeric", minute: "2-digit", timeZone: "Australia/Sydney" });
};

/** The groups the audit log can be narrowed to. */
export const KIND: Record<string, string> = {
  edited: "Edits", submitted: "Review", approved: "Review", rejected: "Review", unpublished: "Review", reopened: "Review",
  "invited organiser": "Organisers", "changed organiser role": "Organisers", "accepted organiser invite": "Organisers", "removed organiser": "Organisers", "left organisers": "Organisers",
  "registration received": "Registrations", "registration accepted": "Registrations", "registration waitlisted": "Registrations", "registration declined": "Registrations", "registration new": "Registrations", "registration withdrawn": "Registrations",
};
export const KINDS = ["Edits", "Review", "Organisers", "Registrations"];

/** What undoing an entry puts back, in words. */
export const undoWhat = (e: Entry) =>
  e.action === "edited" && e.fields.length ? `puts back ${list(e.fields.map(fieldName))} as they were before` : "puts the listing back as it was before this change";
