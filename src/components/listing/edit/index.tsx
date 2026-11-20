import ListForm, { FORM_SECTIONS } from "../../ListForm";
import type { TabModule } from "../types";

// The Edit listing tab: the same form a conference is listed with, filled in with what the listing says now.
const edit: TabModule = {
  title: "Edit your", accent: "listing",
  sections: () => FORM_SECTIONS,
  Body: ({ ctx }) => <ListForm listing={ctx} />,
};
export default edit;
