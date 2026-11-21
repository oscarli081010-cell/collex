"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import s from "@/app/auth.module.css";

// The page behind every email's unsubscribe link: following a conference, a conference's own emails, role alerts and
// the weekly digest all use https://collex.au/unfollow?t=<token>, and no login is needed. A button press (not just
// opening the link) unsubscribes, so email scanners that open links can't do it by accident. Mail apps' one-click
// unsubscribe goes to /api/unfollow instead.
type Done = { kind: "follow" | "conference" | "roles" | "digest"; name: string };

function doneText(d: Done) {
  const name = d.name || "that conference";
  switch (d.kind) {
    case "follow": return `You won't get emails about ${name} any more. You can follow it again from its page.`;
    case "conference": return `You won't get emails from the organisers of ${name} any more.`;
    case "roles": return "You won't get role alerts any more. You can turn them on again on the Roles page.";
    case "digest": return "You won't get the weekly email any more. You can turn it on again from your account.";
  }
}

export default function Unfollow() {
  const [token, setToken] = useState<string | null>(null);
  const [state, setState] = useState<"ready" | "busy" | "done" | "used" | "bad">("ready");
  const [done, setDone] = useState<Done | null>(null);

  useEffect(() => {
    const t = new URLSearchParams(location.search).get("t") ?? "";
    if (/^[0-9a-f-]{36}$/i.test(t)) setToken(t); else setState("bad");
  }, []);

  const go = async () => {
    if (!supabase || !token) return;
    setState("busy");
    const { data, error } = await supabase.rpc("unsubscribe", { t: token });
    if (error) return setState("bad");
    if (!data) return setState("used");
    setDone(data as Done);
    setState("done");
  };

  return (
    <div className={`t-reveal ${s.form}`}>
      <h1 className={s.title}>
        {state === "done" ? "You're unsubscribed." : state === "used" ? "You're already unsubscribed." : state === "bad" ? "That link doesn't work." : "Stop these emails?"}
      </h1>
      <p className="muted">
        {state === "done" && done ? doneText(done)
          : state === "used" ? "This link has been used already, or it's out of date. If emails keep coming, use the link in the newest one."
          : state === "bad" ? "Check that the whole link was copied, or try again in a minute."
          : "You'll stop getting this kind of email from Collex. Nothing else about your account changes."}
      </p>
      {state === "done" || state === "used" || state === "bad" ? (
        <div className="btnStack one"><Link href="/" className="button lg">Go Home</Link></div>
      ) : (
        <button className={`button lg ${s.submit}`} onClick={go} disabled={state === "busy" || !token}>
          <span key={state} className="t-swap">{state === "busy" ? "Unsubscribing…" : "Unsubscribe"}</span>
        </button>
      )}
    </div>
  );
}
