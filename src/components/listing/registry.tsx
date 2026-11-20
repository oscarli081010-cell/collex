import activity from "./activity";
import edit from "./edit";
import manage from "./manage";
import organisers from "./organisers";
import type { TabId, TabModule } from "./types";

// What each tab shows. tabs.tsx says which tabs there are and where they live; this says what is in them.
export const MODULES: Record<TabId, TabModule> = { activity, manage, edit, organisers };
