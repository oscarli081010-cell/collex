"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import s from "@/app/auth.module.css";

// The page behind every email's unsubscribe link. A button press (not just opening the link) unsubscribes,
// so email scanners that open links can't do it by accident.
export default function Unfollow() {
  const [token, setToken] = useState<string | null>(null);
  const [state, setState] = useState<"ready" | "busy" | "done" | "bad">("ready");
  const [name, setName] = useState("");

  useEffect(() => {
    const t = new URLSearchParams(location.search).get("t") ?? "";
    if (/^[0-9a-f-]{36}$/i.test(t)) setToken(t); else setState("bad");
  }, []);

  const go = async () => {
    if (!supabase || !token) return;
    setState("busy");
    const { data, error } = await supabase.rpc("unfollow", { t: token });
    if (error) return setState("bad");
    setName(data ?? "");
    setState("done");
  };

  return (
    <div className={`t-reveal ${s.form}`}>
      <h1 className={s.title}>{state === "done" ? "You're unsubscribed." : state === "bad" ? "That link doesn't work." : "Stop these emails?"}</h1>
      <p className="muted">
        {state === "done" ? `You won't get any more emails about ${name || "that conference"}.`
          : state === "bad" ? "It may have been used already. Log in and open the conference to unfollow it."
          : "You'll stop getting emails about this conference. You can follow it again from its page."}
      </p>
      {state === "done" || state === "bad" ? (
        <div className={s.row}><Link href="/" className="button lg">Go home</Link></div>
      ) : (
        <button className={`button lg ${s.submit}`} onClick={go} disabled={state === "busy" || !token}>
          <span key={state} className="t-swap">{state === "busy" ? "Unsubscribing…" : "Unsubscribe"}</span>
        </button>
      )}
    </div>
  );
}
