import type { SectionDef, TabModule } from "../types";
import Applications from "./Applications";
import Committees from "./Committees";
import Emails from "./Emails";
import Printables from "./Printables";
import Registrations from "./Registrations";

// The Manage tab: everything for running the conference. Each section is a file of its own that loads what it needs;
// to add one, write it and add a line here. It gets its card and its place in the list beside the page.
const SECTIONS: SectionDef[] = [
  { id: "sec-registrations", label: "Registrations", Body: Registrations },
  { id: "sec-applications", label: "Applications", Body: Applications },
  { id: "sec-emails", label: "Emails", Body: Emails },
  { id: "sec-print", label: "Placards and lists", Body: Printables },
  { id: "sec-committees", label: "Committees live", Body: Committees },
];

const manage: TabModule = {
  title: "Manage",
  // Registrations puts its own numbers here once they load.
  figures: () => [{ label: "Schools", value: "–" }, { label: "Accepted", value: "–" }],
  sections: () => SECTIONS,
  Body: ({ ctx }) => <>{SECTIONS.map((x) => <x.Body key={x.id} ctx={ctx} />)}</>,
};
export default manage;
