import { ICONS } from "../IconButton";
import type { TabId } from "./types";

export type TabDef = {
  id: TabId; label: string; icon: React.ReactNode;
  /** The route that shows it. */
  path: string;
  href: (listing: string) => string;
  /** Only for the people who can change the listing. */
  editors?: boolean;
};

const people = <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="6" cy="5.5" r="2.3" /><path d="M1.8 13c.5-2.1 2.2-3.2 4.2-3.2s3.7 1.1 4.2 3.2M10.5 3.4a2.3 2.3 0 010 4.2M12 9.9c1.3.4 2.2 1.3 2.5 3.1" /></svg>;

// A listing's tabs, in the order they are shown. Each has its own address, so it can be linked to and reloaded.
export const TABS: TabDef[] = [
  { id: "activity", label: "Activity", icon: ICONS.chart, path: "/activity", href: (id) => `/activity?id=${id}` },
  { id: "manage", label: "Manage", icon: ICONS.manage, path: "/manage", href: (id) => `/manage?id=${id}`, editors: true },
  { id: "edit", label: "Edit listing", icon: ICONS.edit, path: "/list", href: (id) => `/list?edit=${id}`, editors: true },
  { id: "organisers", label: "Organisers", icon: people, path: "/organisers", href: (id) => `/organisers?id=${id}`, editors: true },
];

export const tabAt = (path: string) => TABS.find((t) => t.path === path) ?? TABS[0];
export const tabOf = (id: TabId) => TABS.find((t) => t.id === id)!;

/** Why a tab for editors is greyed out. */
export const VIEW_ONLY = "The person who listed this conference set you to view only";
export const CLOSED = "A listing can only be changed while it is in review or live";
