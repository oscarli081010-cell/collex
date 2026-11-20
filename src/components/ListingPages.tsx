"use client";

import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useState } from "react";
import ListForm from "./ListForm";
import Workspace from "./listing/Workspace";
import { TABS, tabAt } from "./listing/tabs";
import { FormSkeleton } from "./Skeleton";

// A listing's tabs (Activity, Manage, Edit listing, Organisers) are one page that swaps in place. Each route renders
// this, and the tabs change the address with history.pushState, so moving between them never loads or re-enters a
// page: only the tab's sections swap. /list with no listing named is the blank form for a new one.
export default function ListingPages() {
  const path = usePathname();
  // Which listing the address names; undefined until it has been read (the address isn't known while the page is built).
  const [id, setId] = useState<string | null | undefined>(undefined);
  useLayoutEffect(() => {
    const q = new URLSearchParams(location.search);
    setId(q.get("id") ?? q.get("edit"));
  }, [path]);
  // Leaving these pages ends the no-entrance rule. Done as the new page is built, so it enters normally, once.
  useLayoutEffect(() => () => { delete document.documentElement.dataset.listingSwitch; }, []);
  const fresh = path === "/list" && id === null;
  // The tab's name in the browser's title. Each route has one title of its own, which the page writes back in whenever
  // it is refreshed (after a save, say), so the title is watched and put right again.
  useEffect(() => {
    if (id === undefined) return;
    const title = `${fresh ? "List a conference" : TABS.find((t) => t.path === path)?.label ?? "Your listing"} · Collex`;
    // Only while the address is still this tab's: on the way to another page, the title is that page's to set.
    const set = () => { if (location.pathname === path && document.title !== title) document.title = title; };
    set();
    const watch = new MutationObserver(set);
    watch.observe(document.head, { childList: true, subtree: true, characterData: true });
    return () => watch.disconnect();
  }, [path, fresh, id]);

  if (id === undefined) return <div className="skelWrap"><FormSkeleton fields={6} width={600} grid /></div>;
  if (fresh) return <ListForm />;
  return <Workspace tab={tabAt(path)} id={id} />;
}
