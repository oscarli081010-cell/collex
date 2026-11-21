"use client";

import { createContext, useContext } from "react";
import type { ConferenceSummary } from "@/lib/conferences";

// Published listings, loaded once on the server in the root layout. Only the fields lists, search and the calendars use
// (see ConferenceSummary): this is serialised into every page. Pages that show more load the listing themselves.
const Ctx = createContext<ConferenceSummary[]>([]);
export const useConferences = () => useContext(Ctx);

export default function ConferencesProvider({ list, children }: { list: ConferenceSummary[]; children: React.ReactNode }) {
  return <Ctx.Provider value={list}>{children}</Ctx.Provider>;
}
