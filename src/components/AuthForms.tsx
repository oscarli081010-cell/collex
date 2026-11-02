"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { applyTheme, THEMES, type Theme } from "@/lib/theme";
import { useAuth } from "./AuthProvider";
import SchoolPicker from "./SchoolPicker";
import { usePill } from "./usePill";
import { useToast } from "./useToast";
import s from "@/app/auth.module.css";

const friendly = (msg: string) =>
  /invalid login/i.test(msg) ? "Wrong email or password."
  : /not confirmed/i.test(msg) ? "Confirm your email first. We can send the link again."
  : /rate limit|too many/i.test(msg) ? "Too many tries. Wait a minute, then try again."
  : /password.*(6|8|characters)/i.test(msg) ? "Use at least 8 characters for your password."
  : msg;

const origin = () => window.location.origin;

function NotReady() {
  return supabase ? null : <p className={s.notice}>Accounts are being switched on. Sign-up opens shortly.</p>;
}

function Field({ label, children, error, hint }: { label: string; children: React.ReactNode; error?: string; hint?: string }) {
  return (
    <label className={`field ${error ? s.invalid : ""}`}>
      <span>{label}</span>
      {children}
      {error ? <small key="e" className={`t-reveal ${s.error}`}>{error}</small> : hint && <small>{hint}</small>}
    </label>
  );
}

function Password({ name, autoComplete, onChange }: { name: string; autoComplete: string; onChange?: () => void }) {
  const [show, setShow] = useState(false);
  return (
    <span className={s.pw}>
      <input name={name} type={show ? "text" : "password"} className="control" autoComplete={autoComplete} minLength={8} onChange={onChange} />
      <button type="button" className={s.pwToggle} onClick={() => setShow(!show)} aria-label={show ? "Hide password" : "Show password"}>
        <span key={String(show)} className="t-swap">{show ? "Hide" : "Show"}</span>
      </button>
    </span>
  );
}

const THEME_ICONS: Record<Theme, React.ReactNode> = {
  light: <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="3" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1 1M11.6 11.6l1 1M3.4 12.6l1-1M11.6 4.4l1-1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>,
  dark: <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"><path d="M13.5 9.8A5.8 5.8 0 016.2 2.5a5.8 5.8 0 107.3 7.3z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg>,
  system: <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"><rect x="1.5" y="2.5" width="13" height="9" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M5.5 14h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>,
};

// Light / Dark / System on a sliding control. Applies instantly and saves to the account.
function ThemePicker({ userId, initial, onSaved }: { userId: string; initial: Theme; onSaved: (ok: boolean) => void }) {
  const [value, setValue] = useState<Theme>(initial);
  const box = useRef<HTMLDivElement>(null);
  const pill = usePill(box, '[aria-checked="true"]', value);
  useEffect(() => setValue(initial), [initial]);

  const pick = async (t: Theme) => {
    if (t === value) return;
    setValue(t);
    applyTheme(t);
    const { error } = await supabase!.from("profiles").update({ theme: t }).eq("id", userId);
    onSaved(!error);
  };

  return (
    <div ref={box} className={s.seg} role="radiogroup" aria-label="Appearance">
      <span ref={pill} className={`t-pill ${s.segPill}`} aria-hidden="true" />
      {THEMES.map((t) => (
        <button key={t} type="button" role="radio" aria-checked={value === t} onClick={() => pick(t)} className={s.segIcon}>
          {THEME_ICONS[t]}{t[0].toUpperCase() + t.slice(1)}
        </button>
      ))}
    </div>
  );
}

function Sent({ email, kind, onBack }: { email: string; kind: "signup" | "reset"; onBack: () => void }) {
  const { say, node } = useToast();
  const resend = async () => {
    if (!supabase) return;
    const { error } = kind === "signup"
      ? await supabase.auth.resend({ type: "signup", email, options: { emailRedirectTo: `${origin()}/account` } })
      : await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${origin()}/account` });
    say(error ? friendly(error.message) : "Sent again");
  };
  return (
    <div className={`t-reveal ${s.sent}`} role="status">
      <svg width="44" height="44" viewBox="0 0 44 44" aria-hidden="true" className={s.sentIcon}>
        <circle cx="22" cy="22" r="21" fill="var(--accent-soft)" />
        <path d="M13 16h18v13H13zM13 16l9 7 9-7" fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinejoin="round" pathLength={1} />
      </svg>
      <h1 className={s.title}>Check your email</h1>
      <p className="muted">
        We sent a link to <strong className={s.strong}>{email}</strong>.{" "}
        {kind === "signup" ? "Open it to confirm your account." : "Open it to set a new password."}
      </p>
      <div className={s.row}>
        <button className="button secondary" onClick={resend}>Send it again</button>
        <button className={s.textBtn} onClick={onBack}>Use a different email</button>
      </div>
      {node}
    </div>
  );
}

const STATUS: Record<string, string> = { pending: "In review", published: "Live", rejected: "Not approved", unpublished: "Taken down" };

// The account's own submissions and where each one stands.
function MyListings({ userId }: { userId: string }) {
  const [rows, setRows] = useState<{ id: string; name: string; slug: string; status: string; review_note: string }[] | null>(null);
  useEffect(() => {
    supabase?.from("conferences").select("id, name, slug, status, review_note").eq("submitted_by", userId)
      .order("created_at", { ascending: false }).then(({ data }) => setRows(data ?? []));
  }, [userId]);

  return (
    <section className={`panel ${s.card}`} style={{ "--i": 3 } as React.CSSProperties}>
      <div className={s.cardHead}>
        <h2 className={s.cardTitle}>Your listings</h2>
        <Link href="/list" className="link">List a conference</Link>
      </div>
      {rows === null ? <div className={s.skeleton} style={{ height: 56 }} /> : rows.length === 0 ? (
        <p className="muted">Nothing listed yet.</p>
      ) : (
        <ul className={s.listings}>
          {rows.map((r) => (
            <li key={r.id}>
              {r.status === "published" ? <Link href={`/conferences/${r.slug}`} className="link">{r.name}</Link> : <span>{r.name}</span>}
              <span className={s.status} data-status={r.status}>{STATUS[r.status]}</span>
              {r.status === "rejected" && r.review_note && <small className="muted">{r.review_note}</small>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function SignupForm() {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const clear = (k: string) => () => errors[k] && setErrors(({ [k]: _, ...r }) => r);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!supabase) return;
    const f = new FormData(e.currentTarget);
    const v = (k: string) => String(f.get(k) ?? "").trim();
    const found: Record<string, string> = {};
    if (!v("name")) found.name = "Add your name.";
    if (!/^\S+@\S+\.\S+$/.test(v("email"))) found.email = "Add a valid email.";
    if (String(f.get("password") ?? "").length < 8) found.password = "Use at least 8 characters.";
    setErrors(found);
    if (Object.keys(found).length) return;

    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email: v("email"),
      password: String(f.get("password")),
      options: { data: { full_name: v("name"), school: v("school") }, emailRedirectTo: `${origin()}/account` },
    });
    setBusy(false);
    if (error) return setErrors({ form: friendly(error.message) });
    // Supabase hides whether an email is taken: an existing account comes back with no identities.
    if (data.user && data.user.identities?.length === 0) return setErrors({ email: "That email already has an account. Log in instead." });
    setSent(v("email"));
  }

  if (sent) return <Sent email={sent} kind="signup" onBack={() => setSent(null)} />;

  return (
    <form key="form" className={`t-reveal ${s.form}`} onSubmit={submit} noValidate>
      <h1 className={s.title}>Create your account</h1>
      <NotReady />
      <Field label="Full name" error={errors.name}><input name="name" className="control" autoComplete="name" onChange={clear("name")} /></Field>
      <Field label="School or University" hint="Optional"><SchoolPicker /></Field>
      <Field label="Email" error={errors.email}><input name="email" type="email" className="control" autoComplete="email" onChange={clear("email")} /></Field>
      <Field label="Password" error={errors.password} hint="At least 8 characters"><Password name="password" autoComplete="new-password" onChange={clear("password")} /></Field>
      {errors.form && <p key={errors.form} className={`t-reveal ${s.formError}`}>{errors.form}</p>}
      <button className={`button lg ${s.submit}`} disabled={busy || !supabase}>
        <span key={String(busy)} className="t-swap">{busy ? "Creating account…" : "Create account"}</span>
      </button>
      <p className={s.switch}>Already have an account? <Link href="/login" className="link">Log in</Link></p>
    </form>
  );
}

export function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "reset">("login");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [unconfirmed, setUnconfirmed] = useState("");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!supabase) return;
    const f = new FormData(e.currentTarget);
    const email = String(f.get("email") ?? "").trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError("Add a valid email.");
    setBusy(true);
    setError("");
    if (mode === "reset") {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${origin()}/account` });
      setBusy(false);
      return error ? setError(friendly(error.message)) : setSent(email);
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password: String(f.get("password") ?? "") });
    setBusy(false);
    if (error) {
      setError(friendly(error.message));
      setUnconfirmed(/not confirmed/i.test(error.message) ? email : "");
      return;
    }
    router.push("/account");
  }

  if (sent) return <Sent email={sent} kind="reset" onBack={() => { setSent(null); setMode("login"); }} />;

  return (
    <form key={mode} className={`t-reveal ${s.form}`} onSubmit={submit} noValidate>
      <h1 className={s.title}>{mode === "login" ? "Log in" : "Reset your password"}</h1>
      <NotReady />
      {mode === "reset" && <p className="muted">We&rsquo;ll email you a link to set a new one.</p>}
      <Field label="Email"><input name="email" type="email" className="control" autoComplete="email" onChange={() => setError("")} /></Field>
      {mode === "login" && (
        <Field label="Password"><Password name="password" autoComplete="current-password" onChange={() => setError("")} /></Field>
      )}
      {error && (
        <p key={error} className={`t-reveal ${s.formError}`}>
          {error}{" "}
          {unconfirmed && <button type="button" className={s.textBtn} onClick={() => setSent(unconfirmed)}>Resend link</button>}
        </p>
      )}
      <button className={`button lg ${s.submit}`} disabled={busy || !supabase}>
        <span key={`${mode}${busy}`} className="t-swap">
          {busy ? "One moment…" : mode === "login" ? "Log in" : "Email me a link"}
        </span>
      </button>
      <p className={s.switch}>
        {mode === "login" ? (
          <>
            <button type="button" className={s.textBtn} onClick={() => { setMode("reset"); setError(""); }}>Forgot password?</button>
            <span className={s.dot} aria-hidden="true">·</span>
            New here? <Link href="/signup" className="link">Create an account</Link>
          </>
        ) : (
          <button type="button" className={s.textBtn} onClick={() => { setMode("login"); setError(""); }}>← Back to log in</button>
        )}
      </p>
    </form>
  );
}

export function AccountView() {
  const { ready, session, profile, recovering, refresh } = useAuth();
  const router = useRouter();
  const { say, node } = useToast();
  const [busy, setBusy] = useState("");
  const pwRef = useRef<HTMLFormElement>(null);

  useEffect(() => { if (recovering) pwRef.current?.querySelector("input")?.focus(); }, [recovering]);

  if (!ready) return <div className={`${s.form} ${s.skeleton}`} aria-busy="true" />;
  if (!session || !supabase) {
    return (
      <div className={`t-reveal ${s.form}`}>
        <h1 className={s.title}>Your account</h1>
        <p className="muted">Log in to see your account.</p>
        <div className={s.row}>
          <Link href="/login" className="button lg">Log in</Link>
          <Link href="/signup" className="button secondary lg">Create an account</Link>
        </div>
      </div>
    );
  }

  const name = profile?.full_name || session.user.email!;
  const initials = name.split(/[\s@]/).filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  async function saveProfile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy("profile");
    const { error } = await supabase!.from("profiles")
      .update({ full_name: String(f.get("name")).trim(), school: String(f.get("school")).trim() })
      .eq("id", session!.user.id);
    setBusy("");
    if (error) return say("Couldn't save. Try again.");
    await refresh();
    say("Saved");
  }

  async function savePassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const pw = String(new FormData(form).get("password") ?? "");
    if (pw.length < 8) return say("Use at least 8 characters.");
    setBusy("password");
    const { error } = await supabase!.auth.updateUser({ password: pw });
    setBusy("");
    if (error) return say(friendly(error.message));
    form.reset();
    say("Password updated");
  }

  async function signOut() {
    await supabase!.auth.signOut();
    router.push("/");
  }

  return (
    <div className={`t-stagger ${s.account}`}>
      <header className={s.accHead} style={{ "--i": 0 } as React.CSSProperties}>
        <span className={s.avatar} aria-hidden="true">{initials}</span>
        <div>
          <h1 className={s.title}>{name}</h1>
          <p className="muted">{session.user.email}{profile?.school && <> · {profile.school}</>}</p>
        </div>
        <button className="button secondary" onClick={signOut}>Log out</button>
      </header>

      {recovering && (
        <p className={s.notice} style={{ "--i": 1 } as React.CSSProperties}>Set a new password below to finish resetting it.</p>
      )}

      <section className={`panel ${s.card}`} style={{ "--i": 1 } as React.CSSProperties}>
        <div>
          <h2 className={s.cardTitle}>Appearance</h2>
          <p className="muted">System follows your device&rsquo;s light or dark setting.</p>
        </div>
        <ThemePicker userId={session.user.id} initial={profile?.theme ?? "light"} onSaved={(ok) => { if (!ok) say("Couldn't save that. It still applies on this device."); }} />
      </section>

      <form className={`panel ${s.card}`} onSubmit={saveProfile} style={{ "--i": 1 } as React.CSSProperties}>
        <h2 className={s.cardTitle}>Profile</h2>
        <label className="field"><span>Full name</span><input name="name" className="control" defaultValue={profile?.full_name ?? ""} key={profile?.full_name} /></label>
        <div className="field"><span>School or University</span><SchoolPicker defaultValue={profile?.school ?? ""} /></div>
        <button className="button" disabled={busy === "profile"}>
          <span key={String(busy === "profile")} className="t-swap">{busy === "profile" ? "Saving…" : "Save profile"}</span>
        </button>
      </form>

      <form ref={pwRef} className={`panel ${s.card} ${recovering ? s.highlight : ""}`} onSubmit={savePassword} style={{ "--i": 2 } as React.CSSProperties}>
        <h2 className={s.cardTitle}>Password</h2>
        <label className="field"><span>New password</span><Password name="password" autoComplete="new-password" /></label>
        <button className="button secondary" disabled={busy === "password"}>
          <span key={String(busy === "password")} className="t-swap">{busy === "password" ? "Updating…" : "Update password"}</span>
        </button>
      </form>
      <MyListings userId={session.user.id} />
      {node}
    </div>
  );
}
