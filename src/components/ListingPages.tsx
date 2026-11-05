"use client";

import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect } from "react";
import ActivityView from "./ActivityView";
import ListForm from "./ListForm";
import ManageView from "./ManageView";

// A listing's Activity, Manage and edit form are one page that swaps in place. Each route renders this, and the tabs change the
// address with history.pushState, so moving between them never loads or re-enters a page: only this swaps.
export default function ListingPages() {
  const path = usePathname();
  // Leaving these pages ends the no-entrance rule. Done as the new page is built, so it enters normally, once.
  useLayoutEffect(() => () => { delete document.documentElement.dataset.listingSwitch; }, []);
  useEffect(() => { document.title = path === "/activity" ? "Activity · Collex" : path === "/manage" ? "Manage · Collex" : "List a conference · Collex"; }, [path]);
  return path === "/activity" ? <ActivityView /> : path === "/manage" ? <ManageView /> : <ListForm />;
}
