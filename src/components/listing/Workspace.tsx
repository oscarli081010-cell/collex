"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { formatRange } from "@/lib/conferences";
import { forgetListing } from "@/lib/listingData";
import { refreshSite } from "@/lib/refresh";
import { useAuth } from "../AuthProvider";
import { BandNote, type BandProps, type Figure } from "../PageBand";
import { ActivitySkeleton } from "../Skeleton";
import { useToast } from "../useToast";
import { MODULES } from "./registry";
import Shell from "./Shell";
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
      aside: <div className="btnStack one"><Link href="/login" className="button lg">Log in</Link></div>,
    });
  }
  if (!id || !data || data === "missing") {
    return gate({
      title: "Can’t open", accent: "that", lead: "Only the people who run a listing can open it. Pick one from your listings.",
      aside: <div className="btnStack one"><Link href="/listings" className="button lg">Your listings</Link></div>,
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

  const changed = useCallback(() => {
    forgetListing(id);
    // A live listing's public pages show a change straight away, including pages this browser already has.
    if (live) refreshSite().then(() => router.refresh());
    reload();
  }, [id, live, reload, router]);
  const put = useCallback((list: Figure[]) => setFigures({ tab: tab.id, list }), [tab.id]);
  const ctx: ListingCtx = useMemo(
    () => ({ data, c, id, userId, status, live, canEdit, whyNot, say, changed, reload, setFigures: put }),
    [data, c, id, userId, status, live, canEdit, whyNot, changed, reload, put], // eslint-disable-line react-hooks/exhaustive-deps -- say is new on every render and always does the same thing
  );

  // A tab for editors, opened by someone who can only look: Activity is theirs.
  const shown = tab.editors && !canEdit ? tabOf("activity") : tab;
  // The address then says where they are, so a reload or a shared link opens the same thing.
  useEffect(() => { if (shown.id !== tab.id) window.history.replaceState(null, "", shown.href(id)); }, [shown, tab.id, id]);
  const mod = MODULES[shown.id];
  const note = <BandNote>{c.name}<br />{c.startDate ? formatRange(c) : "Dates not set"}</BandNote>;
  return (
    <Shell
      band={{ title: mod.title, accent: mod.accent, aside: note, figures: figures?.tab === shown.id ? figures.list : mod.figures?.(ctx) ?? [] }}
      nav={{ id, slug: c.slug, current: shown.id, live, whyNot }}
      sections={mod.sections(ctx)}
    >
      <mod.Body key={shown.id} ctx={ctx} />
      {node}
    </Shell>
  );
}
