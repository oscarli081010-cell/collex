"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { forgetListing } from "@/lib/listingData";
import { supabase } from "@/lib/supabase";
import { ConfirmIconButton, ICONS } from "../../IconButton";
import Select from "../../Select";
import Section from "../Section";
import type { ListingCtx, TabModule } from "../types";
import auth from "@/app/auth.module.css";
import s from "@/app/inner.module.css";
import m from "../../Manage.module.css";

export type Member = { user_id: string; name: string; email: string; is_owner: boolean; accepted: boolean; role: "editor" | "viewer" };

const who = (p: Member) => p.name || p.email;

// The Organisers tab: who runs a listing. The person who listed it invites people who already have a Collex account
// (nobody is emailed: the invite waits on their account page) and can remove them; co-organisers can leave.
function Organisers({ ctx }: { ctx: ListingCtx }) {
  const { c, id, userId, say } = ctx;
  const router = useRouter();
  const [team, setTeam] = useState<Member[] | null>(null);
  const load = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase.rpc("organisers_of", { conf: id });
    setTeam((data as Member[] | null) ?? []);
  }, [id]);
  useEffect(() => { void load(); }, [load]);
  // The team changed, so kept copies of this listing are out of date.
  const reload = () => { forgetListing(id); void load(); ctx.reload(); };

  const owner = ctx.data.isOwner === true;
  const changeRole = async (p: Member, next: Member["role"]) => {
    const { error } = await supabase!.rpc("set_organiser_role", { conf: id, target: p.user_id, new_role: next });
    if (error) return say(error.message);
    say(`${who(p)} can now ${next === "editor" ? "edit" : "only view"} ${c.name}`);
    reload();
  };
  const remove = async (p: Member) => {
    const { error } = await supabase!.rpc("remove_organiser", { conf: id, target: p.user_id });
    if (error) return say(error.message);
    if (p.user_id === userId) { forgetListing(id); router.push("/listings"); return; }
    say(`${who(p)} can no longer edit ${c.name}`);
    reload();
  };

  return (
    <>
      <Section id="sec-people" title="People" count={team?.length}>
        {!owner && <p className={m.note}>Only the person who listed this conference can invite or remove organisers, or change what they can do.</p>}
        {team === null ? <p className={m.note}>Loading…</p> : (
          <ol className={s.rowsList}>
            {team.map((p) => (
              <li key={p.user_id} className={`${s.editRow} ${s.teamRow}`}>
                <div className={auth.listingMain}>
                  <span className={auth.listingName}>{who(p)}{p.user_id === userId && <span className="muted"> (you)</span>}</span>
                  <span className={auth.listingMeta}>
                    {p.name && <span>{p.email}</span>}
                    <span className={auth.tag}>{p.is_owner ? "Listed it" : p.accepted ? "Co-organiser" : "Invited"}</span>
                    {!p.is_owner && p.role === "viewer" && <span className={auth.tag}>View only</span>}
                  </span>
                </div>
                {!p.is_owner && (owner || p.user_id === userId) && (
                  <div className={s.teamActions}>
                    {owner && (
                      <Select className={`control ${s.roleSelect}`} value={p.role} aria-label={`What ${who(p)} can do`} onChange={(e) => changeRole(p, e.target.value as Member["role"])}>
                        <option value="editor">Can edit</option>
                        <option value="viewer">View only</option>
                      </Select>
                    )}
                    {p.user_id === userId
                      ? <ConfirmIconButton label={`Leave ${c.name}`} confirm="Click again to stop editing this listing" icon={ICONS.leave} onConfirm={() => remove(p)} />
                      : <ConfirmIconButton label={`Remove ${who(p)}`} confirm={`Click again to remove ${who(p)}`} icon={ICONS.trash} onConfirm={() => remove(p)} />}
                  </div>
                )}
              </li>
            ))}
          </ol>
        )}
      </Section>
      {owner && <Invite ctx={ctx} onInvited={reload} />}
    </>
  );
}

function Invite({ ctx, onInvited }: { ctx: ListingCtx; onInvited: () => void }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [role, setRole] = useState<Member["role"]>("editor");
  async function invite(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || !ctx.live) return;
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError("Add the email they use for Collex.");
    setBusy(true);
    const { data, error } = await supabase.rpc("invite_organiser", { conf: ctx.id, invitee_email: email.trim(), as_role: role });
    const sent = typeof data === "string" && data ? data : email.trim().toLowerCase();
    setBusy(false);
    if (error) return setError(error.message);
    setEmail("");
    ctx.say(`If ${sent} has a Collex account, they've been invited.`);
    onInvited();
  }
  return (
    <Section id="sec-invite" title="Invite">
      <form className={s.teamInvite} onSubmit={invite} noValidate>
        <label className="field">
          <span>They can</span>
          <Select className="control" value={role} onChange={(e) => setRole(e.target.value as Member["role"])}>
            <option value="editor">Edit the listing and see its activity</option>
            <option value="viewer">Only see its activity</option>
          </Select>
        </label>
        <label className={`field ${error ? s.invalid : ""}`}>
          <span>Invite by email</span>
          <input type="email" className="control" value={email} autoComplete="off" placeholder="name@school.edu.au" maxLength={254}
            aria-invalid={Boolean(error)} aria-describedby="invite-hint" onChange={(e) => { setEmail(e.target.value); setError(""); }} />
          {error
            ? <small key="err" id="invite-hint" className={`t-reveal ${s.error}`}>{error}</small>
            : <small id="invite-hint">They need a Collex account. The invite waits on their account page.</small>}
        </label>
        {ctx.live ? (
          <button className="button lg block" disabled={busy}>
            <span key={String(busy)} className="t-swap">{busy ? "Inviting…" : "Invite"}</span>
          </button>
        ) : (
          <span className="tip" data-tip="Invite people once the listing is live"><button type="button" className="button lg block" disabled>Invite</button></span>
        )}
      </form>
    </Section>
  );
}

const organisers: TabModule = {
  title: "Organisers",
  figures: ({ data }) => [{ label: data.team === 1 ? "Person" : "People", value: String(data.team) }],
  sections: ({ data }) => [{ id: "sec-people", label: "People" }, ...(data.isOwner ? [{ id: "sec-invite", label: "Invite" }] : [])],
  Body: Organisers,
};
export default organisers;
