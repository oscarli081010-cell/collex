import PageBand, { type BandProps } from "../PageBand";
import SectionNav, { type Jump } from "../SectionNav";
import ListingNav from "./Nav";
import type { TabId } from "./types";
import s from "./Workspace.module.css";

// The frame every tab of a listing sits in: the headline band, the tabs and buttons under it, then the tab's sections
// with their list beside them. It stays put while the tabs swap, so only the sections change.
export default function Shell({ band, nav, sections, children }: {
  band: BandProps;
  /** Left out while there is no listing to move around in (loading, or one that can't be opened). */
  nav?: { id: string; slug: string; current: TabId; live: boolean; whyNot: string };
  sections: Jump[]; children: React.ReactNode;
}) {
  return (
    <>
      <PageBand {...band} tight={Boolean(nav)} />
      {nav && <ListingNav {...nav} />}
      <Work sections={sections}>{children}</Work>
    </>
  );
}

/** Sections with their list beside them: on the left on a wide screen, a row of chips above on a narrow one. */
export function Work({ sections, children }: { sections: Jump[]; children: React.ReactNode }) {
  return (
    <div className={s.work} data-nav={sections.length > 0 || undefined}>
      {sections.length > 0 && <SectionNav sections={sections} />}
      <div className={`t-stagger ${s.main}`}>{children}</div>
    </div>
  );
}
