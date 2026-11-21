"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Announcement } from "../../Announcements";
import { Placard } from "../../Drawings";
import IconButton, { ConfirmIconButton, ICONS } from "../../IconButton";
import Section from "../Section";
import type { ListingCtx } from "../types";
import { when } from "./shared";
import an from "../../Announcements.module.css";
import bd from "../../board.module.css";
import h from "../../Hub.module.css";
import m from "../../Manage.module.css";

const MAX = 500;

// Short notes for everyone on the conference's page, shown there as soon as they're posted. The team sees every one
// here, newest first, and can take one down.
export default function Announcements({ ctx }: { ctx: ListingCtx }) {
  const { id, canEdit, whyNot, say } = ctx;
  const [text, setText] = useState("");
  const [list, setList] = useState<Announcement[] | null | "error">(null);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<Record<string, true>>({});
  // Only the latest read counts, so a slow one can't bring back a note that was just deleted.
  const turn = useRef(0);

  const load = useCallback(() => {
    if (!supabase) return;
    const at = ++turn.current;
    supabase.from("announcements").select("id, body, created_at").eq("conference_id", id)
      .order("created_at", { ascending: false }).limit(50)
      .then(({ data, error }) => {
        if (at !== turn.current) return;
        // A failed refresh keeps what is on screen; only a first load that fails says so.
        if (error) setList((l) => (Array.isArray(l) ? l : "error"));
        else setList((data as Announcement[] | null) ?? []);
      });
  }, [id]);
  useEffect(load, [load]);

  const ok = text.trim().length > 0;
  const post = async () => {
    if (!supabase || !ok || busy || !canEdit) return;
    setBusy(true);
    const { error } = await supabase.rpc("post_announcement", { conf: id, note: text });
    setBusy(false);
    if (error) return say(error.message);
    say(ctx.live ? "Posted. It shows on the conference's page now." : "Posted. It shows on the page once the listing is live.");
    setText("");
    load();
  };
  const remove = async (x: Announcement) => {
    if (!supabase || deleting[x.id]) return;
    setDeleting((d) => ({ ...d, [x.id]: true }));
    const { error } = await supabase.rpc("delete_announcement", { ann: x.id });
    setDeleting((d) => { const o = { ...d }; delete o[x.id]; return o; });
    if (error) return say(error.message);
    // Gone from the list at once: the delete button stays armed for a moment, and a further click on a row that's
    // already deleted would only bring an error.
    setList((l) => (Array.isArray(l) ? l.filter((y) => y.id !== x.id) : l));
    say("Deleted");
    load();
  };

  const postWhyNot = !canEdit ? whyNot || "You can't post announcements for this conference" : !ok ? "Write the announcement first" : "";
  return (
    <Section id="sec-announcements" title="Announcements">
      <div className="field">
        <label htmlFor="announce-text">Announcement</label>
        <textarea id="announce-text" className="control" rows={4} value={text} maxLength={MAX} onChange={(e) => setText(e.target.value)} disabled={!canEdit} aria-describedby="announce-count" />
        <small id="announce-count" className="muted">{text.length} / {MAX}</small>
      </div>
      <p className="muted">Shown at the top of the conference&rsquo;s page straight away.</p>
      {postWhyNot
        ? <span className="tip" data-tip={postWhyNot} style={{ display: "flex" }}><button type="button" className="button block" disabled>Post Announcement</button></span>
        : <button type="button" className="button block" disabled={busy} onClick={() => void post()}>{busy ? "Posting…" : "Post Announcement"}</button>}
      {list === "error" ? <p className={m.note}>Couldn&rsquo;t load the announcements. Try again in a moment.</p>
        : list === null ? <p className={m.note}>Loading…</p>
        : list.length === 0 ? (
          <div className={`${bd.empty} ${m.empty}`}><Placard /><p className={bd.emptyTitle}>No announcements yet</p></div>
        ) : (
          <ul className={h.rows}>
            {list.map((x) => (
              <li key={x.id} className={h.app}>
                <span className={h.main}>
                  <strong className={an.keepBreaks}>{x.body}</strong>
                  <small>{when(x.created_at)}</small>
                </span>
                {canEdit
                  ? <ConfirmIconButton label="Delete announcement" confirm="Click again to delete" icon={ICONS.trash} onConfirm={() => void remove(x)} />
                  : <IconButton label="Delete announcement" tip={whyNot || "You can't delete announcements for this conference"} icon={ICONS.trash} danger disabled />}
              </li>
            ))}
          </ul>
        )}
    </Section>
  );
}
