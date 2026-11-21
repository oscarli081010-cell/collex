"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { formatRange } from "@/lib/conferences";
import { supabase } from "@/lib/supabase";
import { forgetListing } from "@/lib/listingData";
import { refreshSite } from "@/lib/refresh";
import { useAuth } from "../AuthProvider";
import { BandNote, type BandProps, type Figure } from "../PageBand";
import { ActivitySkeleton } from "../Skeleton";
import auth from "@/app/auth.module.css";
import { useToast } from "../useToast";
import { STATUS_CHIP } from "./activity/words";
import { MODULES } from "./registry";
import Shell from "./Shell";
import s from "./Workspace.module.css";
import { CLOSED, VIEW_ONLY, tabOf, type TabDef } from "./tabs";
import type { ListingCtx, Loaded, TabId } from "./types";
import { useListing } from "./useListing";

// One listing, for the people who run it: loaded once, then shown through whichever tab the address names. The band,
// the tabs and the list of sections stay where they are while the tabs swap.
export default function Workspace({ tab, id }: { tab: TabDef; id: string | null }) {
  const { ready, session } = useAuth();
  const userId = session?.user.id;
  const { data, reload } = useListing(id, userId);
  const title = MODULES[tab.id];
  const gate = (band: BandProps, body?: React.ReactNode) => <Shell band={band} sections={[]}>{body}</Shell>;

  // The whole loading state waits a beat before showing, so a listing that arrives quickly replaces it unseen.
  if (!ready || (id && session && data === undefined)) return <div className="skelWrap">{gate({ title: title.title, accent: title.accent }, <ActivitySkeleton />)}</div>;
  if (!session) {
    return gate({
      title: title.title, accent: title.accent, lead: "Log in to run your listing.",
      aside: <div className="btnStack one"><Link href="/login" className="button lg">Log In</Link></div>,
    });
  }
  if (!id || !data || data === "missing") {
    return gate({
      title: "Can’t open", accent: "that", lead: "Only the people who run a listing can open it. Pick one from your conferences.",
      aside: <div className="btnStack one"><Link href="/listings" className="button lg">Your Conferences</Link></div>,
    });
  }
  return <Open key={id} tab={tab} id={id} userId={userId!} data={data} reload={reload} />;
}

function Open({ tab, id, userId, data, reload }: { tab: TabDef; id: string; userId: string; data: Loaded; reload: () => void }) {
  const { say, node } = useToast();
  const router = useRouter();
  const [figures, setFigures] = useState<{ tab: TabId; list: Figure[] } | null>(null);
  const { c, status } = data;
  const live = status === "published";
  const open = live || status === "pending";
  const canEdit = open && data.canEdit !== false;
  const whyNot = canEdit ? "" : data.canEdit === false ? VIEW_ONLY : CLOSED;
  // A listing that wasn't approved, or was taken down, is not a dead end: its editors can change it and send it again.
  const closed = status === "rejected" || status === "unpublished";
  const reopenable = closed && data.canEdit !== false;
  // What the Collex team wrote when they sent it back. The table hides it; the person's own listings list gives it.
  const [note, setNote] = useState("");
  useEffect(() => {
    if (!closed || !supabase) return;
    let on = true;
    supabase.rpc("my_listings").eq("id", id).maybeSingle().then(({ data: row }) => { if (on) setNote(((row as { review_note?: string } | null)?.review_note ?? "").trim()); });
    return () => { on = false; };
  }, [closed, id, status]);

  const changed = useCallback(() => {
    forgetListing(id);
    // A live listing's public pages show a change straight away, including pages this browser already has.
    if (live) refreshSite().then(() => router.refresh());
    reload();
  }, [id, live, reload, router]);
  const put = useCallback((list: Figure[]) => setFigures({ tab: tab.id, list }), [tab.id]);
  const ctx: ListingCtx = useMemo(
    () => ({ data, c, id, userId, status, live, canEdit, whyNot, reopenable, say, changed, reload, setFigures: put }),
    [data, c, id, userId, status, live, canEdit, whyNot, reopenable, changed, reload, put], // eslint-disable-line react-hooks/exhaustive-deps -- say is new on every render and always does the same thing
  );

  // A tab for editors, opened by someone who can only look: Activity is theirs.
  const shown = tab.editors && !canEdit && !(tab.id === "edit" && reopenable) ? tabOf("activity") : tab;
  // The address then says where they are, so a reload or a shared link opens the same thing.
  useEffect(() => { if (shown.id !== tab.id) window.history.replaceState(null, "", shown.href(id)); }, [shown, tab.id, id]);
  const mod = MODULES[shown.id];
  const aside = (
    <BandNote>
      {c.name}<br />{c.startDate ? formatRange(c) : "Dates not set"}<br />
      <span className={auth.status} data-status={status}>{STATUS_CHIP[status] ?? status}</span>
    </BandNote>
  );
  return (
    <Shell
      band={{ title: mod.title, accent: mod.accent, aside, figures: figures?.tab === shown.id ? figures.list : mod.figures?.(ctx) ?? [] }}
      nav={{ id, slug: c.slug, current: shown.id, live, whyNot, editOpen: reopenable }}
      sections={mod.sections(ctx)}
    >
      {closed && (
        <section className={`panel ${s.banner}`} aria-label="Review">
          <h2 className={s.bannerTitle}>{status === "rejected" ? "The Collex team didn’t approve this listing" : "The Collex team took this listing down"}</h2>
          {note && <p className={s.bannerNote}>&ldquo;{note}&rdquo;</p>}
          <p className="muted">{reopenable ? "Fix what they mention, then send it for review again." : "The person who listed it can change it and send it for review again."}</p>
          {reopenable && shown.id !== "edit" && <Link href={tabOf("edit").href(id)} className="button block">Edit and Send Again</Link>}
        </section>
      )}
      <mod.Body key={shown.id} ctx={ctx} />
      {node}
    </Shell>
  );
}
