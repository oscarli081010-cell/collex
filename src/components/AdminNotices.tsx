"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { refreshSite } from "@/lib/refresh";
import { Placard } from "./Drawings";
import IconButton, { ConfirmIconButton, ICONS } from "./IconButton";
import Select from "./Select";
import SiteNotice, { type Notice } from "./SiteNotice";
import h from "./Hub.module.css";
import s from "@/app/admin.module.css";
import n from "./AdminNotices.module.css";

const MAX = 140;
const when = (iso: string) => new Date(iso).toLocaleString("en-AU", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Australia/Sydney" });

/** A page on Collex ("/list") stays as it is; "instagram.com/collex.au" gets https:// in front. Null when it can't be a link. */
export function linkFor(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  if (v.startsWith("/")) return /^\/(?![/\\])[^\s<>"\\]*$/.test(v) ? v : null;
  const full = /^https:\/\//i.test(v) ? v : /^[a-z][a-z0-9+.-]*:/i.test(v) ? null : `https://${v}`;
  if (!full || /[\s<>"\\]/.test(full) || full.length > 500) return null;
  try { return new URL(full).hostname.includes(".") ? full : null; } catch { return null; }
}

// The home page's announcement: one line at the top, for everyone or only people who are logged in. Posting a new
// one replaces whatever was showing; earlier ones stay here to put back or delete.
export default function AdminNotices({ say }: { say: (t: string) => void }) {
  const [body, setBody] = useState("");
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [who, setWho] = useState<Notice["audience"]>("everyone");
  const [list, setList] = useState<Notice[] | null | "error">(null);
  const [busy, setBusy] = useState("");
  const turn = useRef(0);

  const load = useCallback(() => {
    if (!supabase) return;
    const at = ++turn.current;
    supabase.from("site_notices").select("id, body, link_label, link_url, audience, active, created_at")
      .order("created_at", { ascending: false }).limit(50)
      .then(({ data, error }) => {
        if (at !== turn.current) return;
        if (error) setList((l) => (Array.isArray(l) ? l : "error"));
        else setList((data as Notice[] | null) ?? []);
      });
  }, []);
  useEffect(load, [load]);

  const link = linkFor(url);
  const text = body.trim();
  const whyNot = !text ? "Write the announcement first"
    : url.trim() && !link ? "That link doesn’t look right. Use a Collex page like /list, or a web address."
    : url.trim() && !label.trim() ? "Add the words for the link, like “Follow us”"
    : !url.trim() && label.trim() ? "Add where the link goes, or clear its words"
    : "";
  const draft: Notice = { id: "draft", body: text || "Your announcement shows here", link_label: label.trim() || null, link_url: link, audience: who };

  const done = (msg: string) => { say(msg); load(); void refreshSite(); };
  const post = async () => {
    if (!supabase || whyNot || busy) return;
    setBusy("post");
    const { error } = await supabase.rpc("post_site_notice", { note: text, label: label.trim() || null, url: link, who });
    setBusy("");
    if (error) return say(error.message);
    setBody(""); setLabel(""); setUrl(""); setWho("everyone");
    done("Posted to the home page");
  };
  const show = async (x: Notice, on: boolean) => {
    if (!supabase || busy) return;
    setBusy(x.id);
    const { error } = await supabase.rpc("set_site_notice", { notice: x.id, showing: on });
    setBusy("");
    if (error) return say(error.message);
    done(on ? "Showing on the home page" : "Taken down");
  };
  const remove = async (x: Notice) => {
    if (!supabase || busy) return;
    setBusy(x.id);
    const { error } = await supabase.rpc("delete_site_notice", { notice: x.id });
    setBusy("");
    if (error) return say(error.message);
    setList((l) => (Array.isArray(l) ? l.filter((y) => y.id !== x.id) : l));
    done("Deleted");
  };

  return (
    <div className={n.wrap}>
      <section className={`panel ${n.compose}`} aria-labelledby="notice-h">
        <h2 id="notice-h" className={n.h}>New Announcement</h2>
        <div className="field">
          <label htmlFor="notice-body">Announcement</label>
          <input id="notice-body" className="control" value={body} maxLength={MAX} onChange={(e) => setBody(e.target.value)} placeholder="New conferences go up on our Instagram first" aria-describedby="notice-count" />
          <small id="notice-count">{body.length} / {MAX}</small>
        </div>
        <div className={n.row}>
          <div className="field">
            <label htmlFor="notice-label">Link Words <span className="muted">(optional)</span></label>
            <input id="notice-label" className="control" value={label} maxLength={30} onChange={(e) => setLabel(e.target.value)} placeholder="Follow us" />
          </div>
          <div className="field">
            <label htmlFor="notice-url">Link Goes To <span className="muted">(optional)</span></label>
            <input id="notice-url" className="control" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="instagram.com/collex.au or /list" inputMode="url" autoCapitalize="none" spellCheck={false} />
          </div>
          <div className="field">
            <label htmlFor="notice-who">Who Sees It</label>
            <Select id="notice-who" className="control" value={who} onChange={(e) => setWho(e.target.value as Notice["audience"])}>
              <option value="everyone">Everyone</option>
              <option value="signed_in">People who are logged in</option>
            </Select>
          </div>
        </div>
        <div className={n.preview}>
          <span className={n.previewLabel}>Preview</span>
          <div data-empty={!text || undefined}><SiteNotice notice={draft} preview /></div>
        </div>
        {whyNot
          ? <span className="tip" data-tip={whyNot} style={{ display: "flex" }}><button type="button" className="button block" disabled>Post to Home Page</button></span>
          : <button type="button" className="button block" disabled={busy === "post"} onClick={() => void post()}>{busy === "post" ? "Posting…" : "Post to Home Page"}</button>}
        <p className={n.hint}>Posting replaces the announcement that&rsquo;s showing now. Only one shows at a time.</p>
      </section>

      <section aria-labelledby="notice-list-h">
        <h2 id="notice-list-h" className={n.h}>All Announcements</h2>
        {list === "error" ? <p className="muted">Couldn&rsquo;t load the announcements. Try again in a moment.</p>
          : list === null ? <p className="muted">Loading…</p>
          : list.length === 0 ? (
            <div className={s.empty}><Placard /><p>No Announcements Yet</p><span>Post one above and it shows at the top of the home page.</span></div>
          ) : (
            <ul className={`panel ${h.rows} ${n.list}`}>
              {list.map((x) => (
                <li key={x.id} data-active={x.active || undefined}>
                  <span className={h.main}>
                    <strong>{x.body}</strong>
                    <small>
                      {x.active ? <span className={n.live}>Showing now</span> : "Not showing"}
                      {" · "}{x.audience === "everyone" ? "Everyone" : "Logged-in people"}
                      {x.link_label ? <> · {x.link_label} → {x.link_url}</> : null}
                      {x.created_at ? <> · {when(x.created_at)}</> : null}
                    </small>
                  </span>
                  <span className={s.actions}>
                    {x.active
                      ? <IconButton label="Take down" tip="Take it off the home page" icon={ICONS.hide} onClick={() => void show(x, false)} disabled={Boolean(busy)} />
                      : <IconButton label="Show on home page" tip="Show this on the home page instead" icon={ICONS.view} onClick={() => void show(x, true)} disabled={Boolean(busy)} />}
                    <ConfirmIconButton label="Delete announcement" confirm="Click again to delete" icon={ICONS.trash} onConfirm={() => void remove(x)} />
                  </span>
                </li>
              ))}
            </ul>
          )}
      </section>
    </div>
  );
}
