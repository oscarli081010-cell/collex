"use client";

import Link from "next/link";
import { useRef } from "react";
import { ICONS } from "./IconButton";
import { usePill } from "./usePill";
import s from "@/app/auth.module.css";

export type ListingView = "activity" | "view" | "edit";

// Activity, the public page and the edit form of one listing, one tap apart, on the same sliding control as the
// account and edit tabs. The page you're on is marked; the others are links. The public page only exists once it's live,
// and Edit only for the people who can edit.
export default function ListingNav({ id, slug, current, live, canEdit }: { id: string; slug: string; current: ListingView; live: boolean; canEdit: boolean }) {
  const box = useRef<HTMLElement>(null);
  const pill = usePill(box, '[aria-current="page"]', current);
  const items = [
    { id: "activity" as const, label: "Activity", href: `/activity?id=${id}`, icon: ICONS.chart },
    ...(live ? [{ id: "view" as const, label: "View page", href: `/conferences/${slug}`, icon: ICONS.view }] : []),
    ...(canEdit ? [{ id: "edit" as const, label: "Edit listing", href: `/list?edit=${id}`, icon: ICONS.edit }] : []),
  ];
  if (items.length < 2) return null;
  return (
    <nav ref={box} className={`${s.seg} ${items.length === 2 ? s.segTwo : ""}`} aria-label="This listing">
      <span ref={pill} className={`t-pill ${s.segPill}`} aria-hidden="true" />
      {items.map((i) => (
        <Link key={i.id} href={i.href} className={s.segIcon} aria-current={i.id === current ? "page" : undefined}>{i.icon}{i.label}</Link>
      ))}
    </nav>
  );
}
