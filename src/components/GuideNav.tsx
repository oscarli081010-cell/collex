"use client";

import SectionNav from "./SectionNav";

// A guide's side menu: its sections, marked as you read, then the way back to every guide (and, for chairs, to
// Committees).
export default function GuideNav({ label, sections, chairs }: { label: string; sections: readonly { id: string; title: string }[]; chairs?: boolean }) {
  return (
    <SectionNav
      label={label}
      sections={sections.map((x) => ({ id: x.id, label: x.title }))}
      links={[{ href: "/guides", label: "All guides" }, ...(chairs ? [{ href: "/chambers", label: "Open Committees" }] : [])]}
    />
  );
}
