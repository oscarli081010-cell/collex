"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "./AuthProvider";
import { useToast } from "./useToast";
import s from "@/app/inner.module.css";

// Opt in to emails about one conference. The sentence beside the button says exactly what will be sent,
// and every email has a one-click unsubscribe link (Spam Act 2003).
export default function FollowButton({ id, name }: { id: string; name: string }) {
  const { ready, session } = useAuth();
  const { say, node } = useToast();
  const [following, setFollowing] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!session || !supabase) return setFollowing(false);
    supabase.from("follows").select("conference_id").eq("conference_id", id).maybeSingle()
      .then(({ data }) => setFollowing(Boolean(data)));
  }, [id, session]);

  const toggle = async () => {
    if (!supabase || !session) return;
    setBusy(true);
    const { error } = following
      ? await supabase.from("follows").delete().eq("conference_id", id)
      : await supabase.from("follows").insert({ conference_id: id });
    setBusy(false);
    if (error) return say("That didn't save. Try again.");
    setFollowing(!following);
    say(following ? `You won't get emails about ${name}` : `We'll email you about ${name}`);
  };

  if (!ready || following === null) return <span className={s.follow} aria-hidden="true" />;
  return (
    <div className={s.follow}>
      {session ? (
        <button className={`button ${following ? "secondary" : ""}`} onClick={toggle} disabled={busy} aria-pressed={following}>
          <span key={String(following)} className="t-swap">{following ? "Following ✓" : "Follow for updates"}</span>
        </button>
      ) : (
        <Link href="/login" className="button">Log in to follow</Link>
      )}
      <small className="muted">{following ? "Unfollow any time." : "Email me when applications open or guides are released."}</small>
      {node}
    </div>
  );
}
