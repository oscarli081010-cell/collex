"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { refreshSite } from "@/lib/refresh";
import { formatRange, todayInSydney, type Conference } from "@/lib/conferences";
import { forgetListing, keptActivity, loadActivity, warmEditing } from "@/lib/listingData";
import { supabase } from "@/lib/supabase";
import { useAuth } from "./AuthProvider";
import InterestChart, { type Week } from "./InterestChart";
import PageBand, { BandNote, type BandProps } from "./PageBand";
import SearchBox from "./SearchBox";
import { ConfirmIconButton, ICONS } from "./IconButton";
import ListingNav from "./ListingNav";
import { useToast } from "./useToast";
import { ActivitySkeleton } from "./Skeleton";
import auth from "@/app/auth.module.css";
import s from "./Activity.module.css";

const STATUS: Record<string, string> = { pending: "In review", published: "Live", rejected: "Not approved", unpublished: "Taken down" };

export type Entry = { id: number; at: string; who: string; action: string; fields: string[]; note: string | null; subject: string | null; role: string | null; can_undo: boolean };
export type Loaded = {
  c: Conference; status: string; createdAt: string;
  interest: { total: number; weeks: Week[] }; followers: number | null; team: number; history: Entry[] | null;
  /** False for a co-organiser who can only view. */
  canEdit?: boolean;
};

// What a changed column is called to a person.
const FIELD: Record<string, string> = {
  name: "the name", short_name: "the short name", host: "the host school", start_date: "the first day", end_date: "the last day",
  venue: "the venue", level: "the level", contact: "the contact email", fee: "the delegate fee", delegates: "the delegate count",
  delegation_url: "the registration link", collex_registration: "registering on Collex", chair_url: "the chair application link", interest_url: "the interest form link",
  overview: "the overview", committees: "the committees", guides: "the background guides", cover_path: "the cover photo", cover_x: "the cover photo position", cover_y: "the cover photo position",
  key_dates: "the key dates", delegation_opens_at: "when registration opens", chair_opens_at: "when chair applications open", roles: "the help wanted", secretariat: "the secretariat", submitter_role: "the submitter's role", verified: "the Verified badge",
};
const fieldName = (k: string) => FIELD[k] ?? `the ${k.replaceAll("_", " ")}`;
const list = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

// The Collex team does the reviewing, whichever admin it was.
const STAFF = new Set(["approved", "rejected", "unpublished", "reopened"]);
const SENTENCE: Record<string, (e: Entry) => string> = {
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
const TONE: Record<string, string> = { approved: "ok", rejected: "bad", unpublished: "warn", submitted: "accent", reopened: "warn", "removed organiser": "bad", "left organisers": "warn" };

const when = (iso: string) => {
  const d = new Date(iso);
  const sameYear = d.toLocaleDateString("en-AU", { year: "numeric", timeZone: "Australia/Sydney" }) === new Date().toLocaleDateString("en-AU", { year: "numeric", timeZone: "Australia/Sydney" });
  return d.toLocaleString("en-AU", { day: "numeric", month: "short", ...(sameYear ? {} : { year: "numeric" }), hour: "numeric", minute: "2-digit", timeZone: "Australia/Sydney" });
};
const mondayOf = (today: string) => {
  const d = new Date(today + "T00:00:00");
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// One listing's page for the people who run it: how many are interested and following, and who changed what.
export default function ActivityView() {
  const [version, setVersion] = useState(0);
  const { ready, session } = useAuth();
  const [id, setId] = useState<string | null | undefined>(undefined);
  const [data, setData] = useState<Loaded | "missing" | null>(null);
  // Layout effect, so a page whose numbers are already kept shows them on its first paint instead of a skeleton.
  useLayoutEffect(() => {
    const v = new URLSearchParams(location.search).get("id");
    setId(v);
    const kept = v ? keptActivity(v) : undefined;
    if (kept) setData(kept);
  }, []);

  const uid = session?.user.id;
  useEffect(() => {
    if (!id || !uid || !supabase) return;
    let live = true;
    loadActivity(id, uid).then((r) => { if (live && r) { setData(r); warmEditing(id); } });
    return () => { live = false; };
  }, [id, uid, version]);

  const page = (band: BandProps, body: React.ReactNode) => (
    <>
      <PageBand {...band} />
      <div className={auth.body}>{body}</div>
    </>
  );

  // The whole loading state waits a beat before showing, so numbers that arrive quickly replace it unseen.
  if (!ready || id === undefined || (id && session && data === null)) return <div className="skelWrap">{page({ title: "Activity", lead: " " }, <ActivitySkeleton />)}</div>;
  if (!session) {
    return page({
      title: "Activity", lead: "Log in to see how your listing is doing.",
      aside: <div className="btnStack one"><Link href="/login" className="button lg">Log in</Link></div>,
    }, null);
  }
  if (!id || data === "missing" || !data) {
    return page({
      title: "Can’t open", accent: "that", lead: "Only the people who run a listing can see its activity. Pick one from your account.",
      aside: <div className="btnStack one"><Link href="/listings" className="button lg">Your listings</Link></div>,
    }, null);
  }

  return <ActivityBody data={data} onChanged={() => setVersion((v) => v + 1)} />;
}

// The page once its numbers are in. Kept apart from the loading so it can be looked at on its own.
export function ActivityBody({ data, onChanged }: { data: Loaded; onChanged?: () => void }) {
  const { c, status, interest, followers, team, history } = data;
  const { say, node } = useToast();
  const router = useRouter();
  const today = todayInSydney();
  const page = (band: BandProps, body: React.ReactNode) => (
    <>
      <PageBand {...band} />
      <div className={auth.body}>{body}</div>
    </>
  );
  const thisWeek = interest.weeks.find((w) => w.week === mondayOf(today))?.interested ?? 0;
  const ownForm = Boolean(c.interestUrl);
  const live = status === "published";
  const canEdit = (live || status === "pending") && data.canEdit !== false;
  const num = (n: number | null) => (n === null ? "–" : String(n));

  const tiles: { label: string; value: React.ReactNode; note?: string }[] = [
    { label: "Interested", value: ownForm ? "–" : num(interest.total), note: ownForm ? "Goes to your own form" : undefined },
    { label: "Interested this week", value: ownForm ? "–" : num(thisWeek) },
    { label: "Following", value: num(followers) },
    { label: "Running it", value: <>{team}<small> {team === 1 ? "person" : "people"}</small></> },
    { label: "Status", value: <span className={s.statusValue}><span className={s.statusDot} data-status={status} aria-hidden="true" />{STATUS[status] ?? status}</span> },
    { label: "Last edited", value: <span style={{ fontSize: "0.5em" }}>{c.updatedAt ? when(c.updatedAt) : "–"}</span> },
  ];

  return page({
    title: "Activity",
    aside: <BandNote>{c.name}<br />{c.startDate ? formatRange(c) : "Dates not set"}</BandNote>,
    figures: [
      { label: "Interested", value: ownForm ? "–" : num(interest.total) },
      { label: "Following", value: num(followers) },
    ],
    children: <ListingNav id={c.id!} slug={c.slug} current="activity" live={live} canEdit={canEdit} />,
  },
    <div className={`t-stagger ${s.wrap}`}>
      <Link href="/listings" className={`link ${s.back}`}>&larr; Your listings</Link>

      <div className={s.stats} style={{ "--i": 0 } as React.CSSProperties}>
        {tiles.map((t) => (
          <div key={t.label} className={`panel ${s.stat}`}>
            <span className={s.statLabel}>{t.label}</span>
            <span className={s.statValue}>{t.value}</span>
            {t.note && <span className={s.statNote}>{t.note}</span>}
          </div>
        ))}
      </div>

      <section className={`panel ${s.card}`} style={{ "--i": 1 } as React.CSSProperties} aria-labelledby="interest-h">
        <div className={s.cardHead}>
          <h2 id="interest-h" className={s.cardTitle}>Interest over time</h2>
        </div>
        {ownForm
          ? <p className={s.note}>People are sent to your own interest form, so Collex has no count to show. Clear the link in the listing to use Collex&rsquo;s button instead.</p>
          : live
            ? <InterestChart weeks={interest.weeks} total={interest.total} today={today} />
            : <p className={s.note}>Interest starts counting once the listing is live.</p>}
      </section>

      <section className={`panel ${s.card}`} style={{ "--i": 2 } as React.CSSProperties} aria-labelledby="history-h">
        <div className={s.cardHead}>
          <h2 id="history-h" className={s.cardTitle}>Audit log</h2>
        </div>
        <AuditLog history={history} onUndo={async (e) => {
          const { error } = await supabase!.rpc("undo_edit", { entry: e.id });
          if (error) return say(error.message.includes("any more") ? "That change can\u2019t be undone any more." : "Couldn\u2019t undo that. Try again.");
          say("Change undone");
          forgetListing(c.id!);
          // A live listing's public pages show it straight away, including pages this browser already has.
          if (data.status === "published") refreshSite().then(() => router.refresh());
          onChanged?.();
        }} />
      </section>
      {node}
    </div>);
}

const PER_PAGE = 10;

// The history, newest first, ten to a page, with a search over who did it, what they did and when.
function AuditLog({ history, onUndo }: { history: Entry[] | null; onUndo: (e: Entry) => void }) {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const rows = useMemo(() => (history ?? []).map((h) => {
    const who = STAFF.has(h.action) ? "The Collex team" : h.who;
    const say = SENTENCE[h.action]?.(h) ?? h.action;
    return { h, who, say, hay: `${who} ${say} ${h.note ?? ""} ${when(h.at)}`.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") };
  }), [history]);
  if (history === null) return <p className={s.note}>Couldn&rsquo;t load the history. Try again in a moment.</p>;
  if (history.length === 0) return <p className={s.note}>Nothing recorded yet.</p>;

  const words = q.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(/\s+/).filter(Boolean);
  const shown = rows.filter((r) => words.every((w) => r.hay.includes(w)));
  const pages = Math.max(1, Math.ceil(shown.length / PER_PAGE));
  const at = Math.min(page, pages - 1);
  const slice = shown.slice(at * PER_PAGE, (at + 1) * PER_PAGE);
  const go = (n: number) => { setPage(n); document.getElementById("history-h")?.scrollIntoView({ block: "start", behavior: "smooth" }); };

  return (
    <>
      <div className={s.logSearch} role="search">
        <SearchBox label="Search the audit log" placeholder="Search by who, what or when" value={q} onChange={(v) => { setQ(v); setPage(0); }} />
        <span className={`muted ${s.logCount}`} aria-live="polite">{q ? `${shown.length} of ${rows.length}` : `${rows.length} ${rows.length === 1 ? "entry" : "entries"}`}</span>
      </div>
      {shown.length === 0 ? (
        <p className={s.note}>No matches. Try a different word, or clear the search.</p>
      ) : (
        <ol className={s.history}>
          {slice.map(({ h, who, say }, i) => (
            <li key={`${h.at}-${i}`}>
              <span className={s.dot} data-tone={TONE[h.action] ?? (h.action === "edited" ? undefined : "accent")} aria-hidden="true" />
              <div>
                <p className={s.what}><strong>{who}</strong> {say}.</p>
                <time className={s.when} dateTime={h.at}>{when(h.at)}</time>
                {h.note && <span className={s.quote}>&ldquo;{h.note}&rdquo;</span>}
              </div>
              {h.can_undo && (
                <span className={s.undo}>
                  <ConfirmIconButton label="Undo this change" confirm="Click again to undo this change" icon={ICONS.undo} onConfirm={() => onUndo(h)} />
                </span>
              )}
            </li>
          ))}
        </ol>
      )}
      {pages > 1 && (
        <nav className={s.pager} aria-label="Audit log pages">
          <button type="button" className="button secondary" onClick={() => go(at - 1)} disabled={at === 0}>Previous</button>
          <span className="muted" aria-live="polite">Page {at + 1} of {pages}</span>
          <button type="button" className="button secondary" onClick={() => go(at + 1)} disabled={at === pages - 1}>Next</button>
        </nav>
      )}
    </>
  );
}
