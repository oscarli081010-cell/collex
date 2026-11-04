"use client";

import Link from "next/link";
import { useState } from "react";
import { ROLE_KINDS, type Role, type RoleKind } from "@/lib/conferences";
import { Placard } from "./Drawings";
import PageBand from "./PageBand";
import RoleCard, { applyFor } from "./RoleCard";
import s from "./Roles.module.css";
import board from "./board.module.css";

export type BoardItem = {
  role: Role;
  conference: { slug: string; name: string; host: string; contact: string };
  when: string; start: string;
};

// Everything upcoming conferences are looking for help with, soonest first, filtered by kind of help.
export default function RolesBoard({ items }: { items: BoardItem[] }) {
  const [kind, setKind] = useState<RoleKind | "all">("all");
  const shown = items.filter((i) => kind === "all" || i.role.kind === kind);
  const count = (k: RoleKind) => items.filter((i) => i.role.kind === k).length;
  const hosts = new Set(items.map((i) => i.conference.slug)).size;

  return (
    <>
      <PageBand
        title="Roles"
        accent="needed"
        lead={items.length ? "Chairs, crisis staff, press and more, from Sydney conferences that need a hand." : undefined}
        figures={[{ label: "Open roles", value: String(items.length) }, { label: "Conferences", value: String(hosts) }]}
      >
        {items.length > 0 && (
          <div className={s.chips} role="group" aria-label="Filter by kind of help">
            <button className={s.chip} aria-pressed={kind === "all"} onClick={() => setKind("all")}>All <small>{items.length}</small></button>
            {ROLE_KINDS.map((k) => (
              <button key={k.id} className={s.chip} aria-pressed={kind === k.id} data-empty={count(k.id) === 0 || undefined} onClick={() => setKind(k.id)}>
                {k.label} <small>{count(k.id)}</small>
              </button>
            ))}
          </div>
        )}
      </PageBand>

      {items.length === 0 ? (
        <div className={board.empty}>
          <Placard />
          <p className={board.emptyTitle}>No roles posted yet</p>
          <p className="muted">When a conference lists what it needs help with, it appears here.</p>
          <Link href="/list" className="button secondary">Post the roles you need</Link>
        </div>
      ) : shown.length === 0 ? (
        <div className={board.empty}>
          <p className={board.emptyTitle}>Nothing here right now</p>
          <button className="button secondary" onClick={() => setKind("all")}>Show everything</button>
        </div>
      ) : (
        <div key={kind} className={`t-stagger ${s.grid}`} aria-live="polite">
          {shown.map((i, n) => (
            <div key={`${i.conference.slug}-${n}`} style={{ "--i": Math.min(n, 8) } as React.CSSProperties}>
              <RoleCard role={i.role} conference={i.conference} when={i.when} apply={applyFor(i.role, i.conference)} />
            </div>
          ))}
        </div>
      )}
    </>
  );
}
