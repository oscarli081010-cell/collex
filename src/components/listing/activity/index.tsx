import type { ListingCtx, SectionDef, TabModule } from "../types";
import AuditLog from "./AuditLog";
import Interest from "./Interest";
import Numbers, { num } from "./Numbers";

// The Activity tab: how the listing is doing, and who changed what. Add a section here and it gets its card and its
// place in the list beside the page.
const SECTIONS: SectionDef[] = [
  { id: "sec-numbers", label: "Numbers", Body: Numbers },
  { id: "sec-interest", label: "Interest", Body: Interest },
  { id: "sec-log", label: "Audit log", Body: AuditLog },
];

const activity: TabModule = {
  title: "Activity",
  figures: ({ data }: ListingCtx) => [
    { label: "Interested", value: data.c.interestUrl ? "–" : num(data.interest.total) },
    { label: "Following", value: num(data.followers) },
  ],
  sections: () => SECTIONS,
  Body: ({ ctx }) => <>{SECTIONS.map((x) => <x.Body key={x.id} ctx={ctx} />)}</>,
};
export default activity;
