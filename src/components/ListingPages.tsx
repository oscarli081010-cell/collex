"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import ActivityView from "./ActivityView";
import ListForm from "./ListForm";

// A listing's Activity and edit form are one page that swaps in place. Both routes render this, and the tabs change the
// address with history.pushState, so moving between them never loads or re-enters a page: only this swaps.
export default function ListingPages() {
  const activity = usePathname() === "/activity";
  useEffect(() => { document.title = activity ? "Activity · Collex" : "List a conference · Collex"; }, [activity]);
  return activity ? <ActivityView /> : <ListForm />;
}
