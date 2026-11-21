import type { Conference } from "@/lib/conferences";
import type { Week } from "../InterestChart";
import type { Figure } from "../PageBand";
import type { Jump } from "../SectionNav";

// The shapes every part of a listing's workspace shares. A listing's workspace is its tabs (Activity, Manage, Edit
// listing, Organisers); each tab is a stack of sections. To add a feature, write a section and add it to its tab's list
// (manage/index.tsx and so on); to add a whole tab, add it to tabs.tsx and registry.tsx. Nothing else needs to change.

export type Entry = { id: number; at: string; who: string; action: string; fields: string[]; note: string | null; subject: string | null; role: string | null; can_undo: boolean };

/** One listing as the people who run it see it: the conference, where it stands, and its numbers. */
export type Loaded = {
  c: Conference; status: string; createdAt: string;
  interest: { total: number; weeks: Week[] }; followers: number | null; team: number; history: Entry[] | null;
  /** False for a co-organiser who can only view. */
  canEdit?: boolean;
  /** This person listed it, so they choose who else runs it. */
  isOwner?: boolean;
};

export type TabId = "activity" | "manage" | "edit" | "organisers";

/** What every tab and section is handed. */
export type ListingCtx = {
  data: Loaded; c: Conference; id: string; userId: string; status: string;
  /** The listing is public. */
  live: boolean;
  /** This person may change it (it is live or in review, and they aren't view-only). */
  canEdit: boolean;
  /** Why they can't, for the hint on a greyed-out control. Empty when they can. */
  whyNot: string;
  /** The listing was rejected or taken down and this person may edit it and send it for review again (only its Edit tab opens). */
  reopenable: boolean;
  /** Shows a short message at the bottom of the screen. */
  say: (text: string) => void;
  /** Call after changing the listing: it is read again, and so are its public pages when it is live. */
  changed: () => void;
  /** Reads the listing again, when only something beside it changed (who runs it). */
  reload: () => void;
  /** Puts this tab's own numbers in the headline band. */
  setFigures: (figures: Figure[]) => void;
};

/** One card in a tab, and its entry in the list beside the page. */
export type SectionDef<C extends ListingCtx = ListingCtx> = { id: string; label: string; Body: React.ComponentType<{ ctx: C }> };

/** One tab of the workspace. */
export type TabModule = {
  title: string; accent?: string;
  /** Numbers for the band that need nothing more than the listing itself. */
  figures?: (ctx: ListingCtx) => Figure[];
  sections: (ctx: ListingCtx) => Jump[];
  Body: React.ComponentType<{ ctx: ListingCtx }>;
};
