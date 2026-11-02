"use client";

import { createContext, useContext } from "react";
import type { Conference } from "@/lib/conferences";

// Published listings, loaded once on the server in the root layout.
const Ctx = createContext<Conference[]>([]);
export const useConferences = () => useContext(Ctx);

export default function ConferencesProvider({ list, children }: { list: Conference[]; children: React.ReactNode }) {
  return <Ctx.Provider value={list}>{children}</Ctx.Provider>;
}
