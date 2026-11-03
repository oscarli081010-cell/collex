"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { ConfirmIconButton, ICONS } from "./IconButton";
import { useToast } from "./useToast";
import auth from "@/app/auth.module.css";
import s from "@/app/inner.module.css";

export type Member = { user_id: string; name: string; email: string; is_owner: boolean; accepted: boolean };

// Who runs a listing. The owner invites people who already have a Collex account (nobody is emailed:
// the invite waits on their account page) and can remove them; co-organisers can leave.
export default function Team({ conf, name, me, team, reload }: { conf: string; name: string; me: string; team: Member[]; reload: () => void }) {
  const router = useRouter();
  const { say, node } = useToast();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const owner = team.find((m) => m.is_owner)?.user_id === me;
  const who = (m: Member) => m.name || m.email;

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError("Add the email they use for Collex.");
    setBusy(true);
    const { data, error } = await supabase.rpc("invite_organiser", { conf, invitee_email: email.trim() });
    setBusy(false);
    if (error) return setError(error.message);
    setEmail("");
    say(`Invited ${data}. They'll see it on their account page.`);
    reload();
  }

  async function remove(m: Member) {
    const { error } = await supabase!.rpc("remove_organiser", { conf, target: m.user_id });
    if (error) return say(error.message);
    if (m.user_id === me) { router.push("/account"); return; }
    say(`${who(m)} can no longer edit ${name}`);
    reload();
  }

  return (
    <section className={`panel ${s.team}`} aria-labelledby="team-h">
      <div>
        <h2 id="team-h" className={s.teamTitle}>Organisers</h2>
        <p className="muted">{owner
          ? "Invite people who help run the conference. Once they accept, they can edit this listing and see its interest, like you."
          : "The people who can edit this listing. Only the person who listed it can invite or remove organisers."}</p>
      </div>
      <ul className={auth.listings}>
        {team.map((m) => (
          <li key={m.user_id}>
            <div className={auth.listingMain}>
              <span className={auth.listingName}>{who(m)}{m.user_id === me && <span className="muted"> (you)</span>}</span>
              <span className={auth.listingMeta}>
                {m.name && <span>{m.email}</span>}
                <span className={auth.tag}>{m.is_owner ? "Listed it" : m.accepted ? "Co-organiser" : "Invited"}</span>
              </span>
            </div>
            {!m.is_owner && (owner || m.user_id === me) && (
              m.user_id === me
                ? <ConfirmIconButton label={`Leave ${name}`} confirm="Click again to stop editing this listing" icon={ICONS.leave} onConfirm={() => remove(m)} />
                : <ConfirmIconButton label={`Remove ${who(m)}`} confirm={`Click again to remove ${who(m)}`} icon={ICONS.trash} onConfirm={() => remove(m)} />
            )}
          </li>
        ))}
      </ul>
      {owner && (
        <form className={s.invite} onSubmit={invite} noValidate>
          <label className={`field ${error ? s.invalid : ""}`}>
            <span>Invite by email</span>
            <span className={s.inviteRow}>
              <input type="email" className="control" value={email} autoComplete="off" placeholder="name@school.edu.au" maxLength={254}
                aria-invalid={Boolean(error)} aria-describedby="invite-hint" onChange={(e) => { setEmail(e.target.value); setError(""); }} />
              <button className="button" disabled={busy}>
                <span key={String(busy)} className="t-swap">{busy ? "Inviting…" : "Invite"}</span>
              </button>
            </span>
            {error
              ? <small key="err" id="invite-hint" className={`t-reveal ${s.error}`}>{error}</small>
              : <small id="invite-hint">They need a Collex account. We don&rsquo;t email anyone: the invite waits on their account page.</small>}
          </label>
        </form>
      )}
      {node}
    </section>
  );
}
