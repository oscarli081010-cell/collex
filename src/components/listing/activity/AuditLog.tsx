"use client";

import { useMemo, useState } from "react";
import { ConfirmIconButton, ICONS } from "../../IconButton";
import SearchBox from "../../SearchBox";
import { supabase } from "@/lib/supabase";
import Section from "../Section";
import type { Entry, ListingCtx } from "../types";
import { SENTENCE, STAFF, TONE, when } from "./words";
import { Placard } from "../../Drawings";
import board from "../../board.module.css";
import m from "../../Manage.module.css";
import s from "../../Activity.module.css";

const PER_PAGE = 10;

// Who changed what, newest first, ten to a page, with a search over who did it, what they did and when.
export default function AuditLog({ ctx }: { ctx: ListingCtx }) {
  const undo = async (e: Entry) => {
    const { error } = await supabase!.rpc("undo_edit", { entry: e.id });
    if (error) return ctx.say(error.message.includes("any more") ? "That change can\u2019t be undone any more." : "Couldn\u2019t undo that. Try again.");
    ctx.say("Change undone");
    ctx.changed();
  };
  return (
    <Section id="sec-log" title="Audit log">
      <Log history={ctx.data.history} onUndo={undo} />
    </Section>
  );
}

function Log({ history, onUndo }: { history: Entry[] | null; onUndo: (e: Entry) => void }) {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const rows = useMemo(() => (history ?? []).map((h) => {
    const who = STAFF.has(h.action) ? "The Collex team" : h.who;
    const say = SENTENCE[h.action]?.(h) ?? h.action;
    return { h, who, say, hay: `${who} ${say} ${h.note ?? ""} ${when(h.at)}`.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") };
  }), [history]);
  if (history === null) return <p className={s.note}>Couldn&rsquo;t load the history. Try again in a moment.</p>;
  if (history.length === 0) return <div className={`${board.empty} ${m.empty}`}><Placard /><p className={board.emptyTitle}>Nothing recorded yet</p><p className="muted">Every change to the listing shows here.</p></div>;

  const words = q.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(/\s+/).filter(Boolean);
  const shown = rows.filter((r) => words.every((w) => r.hay.includes(w)));
  const pages = Math.max(1, Math.ceil(shown.length / PER_PAGE));
  const at = Math.min(page, pages - 1);
  const slice = shown.slice(at * PER_PAGE, (at + 1) * PER_PAGE);
  const go = (n: number) => { setPage(n); document.getElementById("sec-log")?.scrollIntoView({ block: "start", behavior: "smooth" }); };

  return (
    <>
      <div className={s.logSearch} role="search">
        <SearchBox label="Search the audit log" placeholder="Search by who, what or when" value={q} onChange={(v) => { setQ(v); setPage(0); }} />
        <span className={`muted ${s.logCount}`} aria-live="polite">{q ? `${shown.length} of ${rows.length}` : `${rows.length} ${rows.length === 1 ? "entry" : "entries"}`}</span>
      </div>
      {shown.length === 0 ? (
        <p className={s.note}>No matches. Try a different word, or clear the search.</p>
      ) : (
        <ol className={s.history}>
          {slice.map(({ h, who, say }, i) => (
            <li key={`${h.at}-${i}`}>
              <span className={s.dot} data-tone={TONE[h.action] ?? (h.action === "edited" ? undefined : "accent")} aria-hidden="true" />
              <div>
                <p className={s.what}><strong>{who}</strong> {say}.</p>
                <time className={s.when} dateTime={h.at}>{when(h.at)}</time>
                {h.note && <span className={s.quote}>&ldquo;{h.note}&rdquo;</span>}
              </div>
              {h.can_undo && (
                <span className={s.undo}>
                  <ConfirmIconButton label="Undo this change" confirm="Click again to undo this change" icon={ICONS.undo} onConfirm={() => onUndo(h)} />
                </span>
              )}
            </li>
          ))}
        </ol>
      )}
      {pages > 1 && (
        <nav className={s.pager} aria-label="Audit log pages">
          {at === 0 ? <span className="tip" data-tip="You’re on the first page"><button type="button" className="button secondary" onClick={() => go(at - 1)} disabled={at === 0}>Previous</button></span> : <button type="button" className="button secondary" onClick={() => go(at - 1)} disabled={at === 0}>Previous</button>}
          <span className="muted" aria-live="polite">Page {at + 1} of {pages}</span>
          {at === pages - 1 ? <span className="tip" data-tip="You’re on the last page"><button type="button" className="button secondary" onClick={() => go(at + 1)} disabled={at === pages - 1}>Next</button></span> : <button type="button" className="button secondary" onClick={() => go(at + 1)} disabled={at === pages - 1}>Next</button>}
        </nav>
      )}
    </>
  );
}
