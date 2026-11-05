"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Conference } from "@/lib/conferences";
import { whenOpens } from "@/lib/schedule";
import { supabase } from "@/lib/supabase";
import { useAuth } from "./AuthProvider";
import { useOpen } from "./useOpen";
import { useToast } from "./useToast";
import s from "@/app/inner.module.css";

type Say = (msg: string) => void;

// The things people come to a conference page to do, at the top and hard to miss:
// register, say they're interested, or apply to chair.
export default function ApplyBand({ c }: { c: Conference }) {
  const { say, node } = useToast();
  const options = [
    { title: "Register a delegation", url: c.delegationUrl, cta: "Register", at: c.delegationOpensAt, what: "Delegate registration" },
    { title: "Apply to chair", url: c.chairUrl, cta: "Apply", at: c.chairOpensAt, what: "Chair applications" },
  ];

  return (
    <section id="apply" className={s.applyBand} aria-label="Apply">
      <ApplyCard o={options[0]} say={say} />
      <Interest c={c} say={say} />
      <ApplyCard o={options[1]} say={say} />
      {node}
    </section>
  );
}

// Express interest: the organiser's own form when they linked one, otherwise Collex's one-tap version.
function Interest({ c, say }: { c: Conference; say: Say }) {
  return c.interestUrl ? <InterestLink url={c.interestUrl} /> : <BuiltInInterest c={c} say={say} />;
}

// Their own form (a Google Form, say): opens in a new tab, no account needed.
function InterestLink({ url }: { url: string }) {
  return (
    <div className={s.applyOption} data-kind="interest">
      <div>
        <h2 className={s.applyTitle}>Express interest</h2>
        <span className={s.applyStatus} data-open="true">Not ready to register? Let them know.</span>
      </div>
      <a href={url} className={`button ${s.applyBtn}`} target="_blank" rel="noreferrer">Express interest →</a>
    </div>
  );
}

// An expression of interest: one tap tells the organisers someone is keen. Organisers see the count here instead.
function BuiltInInterest({ c, say }: { c: Conference; say: Say }) {
  const { ready, session } = useAuth();
  const [state, setState] = useState<{ sent: boolean; count: number | null } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!c.id || !session || !supabase) return setState({ sent: false, count: null });
    Promise.all([
      supabase.from("interests").select("conference_id").eq("conference_id", c.id).maybeSingle(),
      supabase.rpc("interest_counts"),
    ]).then(([mine, counts]) => {
      const row = (counts.data as { conference_id: string; interested: number }[] | null)?.find((r) => r.conference_id === c.id);
      setState({ sent: Boolean(mine.data), count: row ? Number(row.interested) : null });
    });
  }, [c.id, session]);

  const toggle = async () => {
    if (!supabase || !session || !c.id || !state) return;
    setBusy(true);
    const { error } = state.sent
      ? await supabase.from("interests").delete().eq("conference_id", c.id)
      : await supabase.from("interests").insert({ conference_id: c.id });
    setBusy(false);
    if (error) return say("That didn't save. Try again.");
    setState({ ...state, sent: !state.sent });
    say(state.sent ? "Interest withdrawn" : `The ${c.shortName} team can see someone's interested`);
  };

  const organiser = state?.count != null;
  // The people who run a listing don't see the count here; it's on the Activity page.
  const status = organiser ? "You run this listing" : state?.sent ? "Interest sent" : "Not ready to register? Let them know.";

  return (
    <div className={s.applyOption} data-kind="interest">
      <div>
        <h2 className={s.applyTitle}>Express interest</h2>
        <span key={status} className={`t-swap ${s.applyStatus}`} data-open={organiser || Boolean(state?.sent)}>{status}</span>
      </div>
      {!ready || state === null ? (
        <span className={`button ${s.applyBtn}`} aria-hidden="true" data-closed />
      ) : organiser ? (
        <Link href={`/activity?id=${c.id}`} className={`button secondary ${s.applyBtn}`}>See activity →</Link>
      ) : !c.id ? (
        <button className={`button ${s.applyBtn}`} onClick={() => say("This is a demo. On a real listing, this tells the organisers you're interested.")}>Send interest →</button>
      ) : !session ? (
        <Link href="/login" className={`button ${s.applyBtn}`}>Log in to send →</Link>
      ) : (
        <button className={`button ${state.sent ? "secondary" : ""} ${s.applyBtn}`} onClick={toggle} disabled={busy} aria-pressed={state.sent}>
          <span key={String(state.sent)} className="t-swap">{state.sent ? "Interest sent ✓" : "Send interest →"}</span>
        </button>
      )}
    </div>
  );
}

type Option = { title: string; url?: string | null; cta: string; at?: string | null; what: string };

// Register or apply. A scheduled button stays shut, and says when it opens, until that time arrives.
function ApplyCard({ o, say }: { o: Option; say: Say }) {
  const state = useOpen(o.at);
  const open = Boolean(o.url) && state === "open";
  const waiting = Boolean(o.url && o.at) && state === "closed";
  const hold = state === "unknown" ? { visibility: "hidden" as const } : undefined;
  return (
    <div className={s.applyOption}>
      <div>
        <h2 className={s.applyTitle}>{o.title}</h2>
        <span className={s.applyStatus} data-open={open} style={hold}>
          {open ? "Applications open" : waiting ? `Opens ${whenOpens(o.at!)}` : "Applications not open yet"}
        </span>
      </div>
      {open ? (
        <a href={o.url!} className={`button ${s.applyBtn}`} target="_blank" rel="noreferrer">{o.cta} →</a>
      ) : (
        <button
          className={`button ${s.applyBtn}`}
          style={hold}
          aria-disabled="true"
          data-closed
          onClick={() => say(waiting ? `${o.what} open ${whenOpens(o.at!)} (Sydney time).` : `${o.what} haven't opened yet. Check back soon.`)}
        >
          {o.cta} →
        </button>
      )}
    </div>
  );
}
