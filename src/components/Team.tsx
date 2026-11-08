"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { ConfirmIconButton, ICONS } from "./IconButton";
import { useToast } from "./useToast";
import auth from "@/app/auth.module.css";
import s from "@/app/inner.module.css";
import Select from "./Select";

export type Member = { user_id: string; name: string; email: string; is_owner: boolean; accepted: boolean; role: "editor" | "viewer" };

// Who runs a listing. The owner invites people who already have a Collex account (nobody is emailed:
// the invite waits on their account page) and can remove them; co-organisers can leave.
export default function Team({ conf, name, me, team, reload }: { conf: string; name: string; me: string; team: Member[]; reload: () => void }) {
  const router = useRouter();
  const { say, node } = useToast();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [role, setRole] = useState<Member["role"]>("editor");
  const owner = team.find((m) => m.is_owner)?.user_id === me;
  const who = (m: Member) => m.name || m.email;

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError("Add the email they use for Collex.");
    setBusy(true);
    const { data, error } = await supabase.rpc("invite_organiser", { conf, invitee_email: email.trim(), as_role: role });
    setBusy(false);
    if (error) return setError(error.message);
    setEmail("");
    say(`Invited ${data}. They'll see it on their account page.`);
    reload();
  }

  async function changeRole(m: Member, next: Member["role"]) {
    const { error } = await supabase!.rpc("set_organiser_role", { conf, target: m.user_id, new_role: next });
    if (error) return say(error.message);
    say(`${who(m)} can now ${next === "editor" ? "edit" : "only view"} ${name}`);
    reload();
  }

  async function remove(m: Member) {
    const { error } = await supabase!.rpc("remove_organiser", { conf, target: m.user_id });
    if (error) return say(error.message);
    if (m.user_id === me) { router.push("/listings"); return; }
    say(`${who(m)} can no longer edit ${name}`);
    reload();
  }

  return (
    <div className={s.teamWrap}>
      <fieldset className="field">
        <legend>People who run this listing</legend>
        <p className="muted">{owner
          ? "Invite people who help run the conference. Once they accept, they can see its activity, and edit it too if you let them."
          : "Only the person who listed this conference can invite or remove organisers, or change what they can do."}</p>
        <ol className={s.rowsList}>
          {team.map((m) => (
            <li key={m.user_id} className={`${s.editRow} ${s.teamRow}`}>
              <div className={auth.listingMain}>
                <span className={auth.listingName}>{who(m)}{m.user_id === me && <span className="muted"> (you)</span>}</span>
                <span className={auth.listingMeta}>
                  {m.name && <span>{m.email}</span>}
                  <span className={auth.tag}>{m.is_owner ? "Listed it" : m.accepted ? "Co-organiser" : "Invited"}</span>
                  {!m.is_owner && m.role === "viewer" && <span className={auth.tag}>View only</span>}
                </span>
              </div>
              {!m.is_owner && (owner || m.user_id === me) && (
                <div className={s.teamActions}>
                  {owner && (
                    <Select className={`control ${s.roleSelect}`} value={m.role} aria-label={`What ${who(m)} can do`} onChange={(e) => changeRole(m, e.target.value as Member["role"])}>
                      <option value="editor">Can edit</option>
                      <option value="viewer">View only</option>
                    </Select>
                  )}
                  {m.user_id === me
                    ? <ConfirmIconButton label={`Leave ${name}`} confirm="Click again to stop editing this listing" icon={ICONS.leave} onConfirm={() => remove(m)} />
                    : <ConfirmIconButton label={`Remove ${who(m)}`} confirm={`Click again to remove ${who(m)}`} icon={ICONS.trash} onConfirm={() => remove(m)} />}
                </div>
              )}
            </li>
          ))}
        </ol>
      </fieldset>
      {owner && (
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
              : <small id="invite-hint">They need a Collex account. We don&rsquo;t email anyone: the invite waits on their account page.</small>}
          </label>
          <button className="button lg block" disabled={busy}>
            <span key={String(busy)} className="t-swap">{busy ? "Inviting…" : "Invite"}</span>
          </button>
        </form>
      )}
      {node}
    </div>
  );
}
