"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ROLES, supabase, type Role } from "@/lib/supabase";
import { useAuth } from "./AuthProvider";
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

// Segmented control with the sliding pill, used for "I'm a…".
export function RolePicker({ value, onChange }: { value: Role; onChange: (r: Role) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const pill = usePill(box, '[aria-checked="true"]', value);
  return (
    <div ref={box} className={s.seg} role="radiogroup" aria-label="I'm a">
      <span ref={pill} className={`t-pill ${s.segPill}`} aria-hidden="true" />
      {ROLES.map((r) => (
        <button key={r} type="button" role="radio" aria-checked={value === r} onClick={() => onChange(r)}>{r}</button>
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
  const [role, setRole] = useState<Role>("Delegate");
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
      options: { data: { full_name: v("name"), school: v("school"), role }, emailRedirectTo: `${origin()}/account` },
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
      <div className="field">
        <span>I&rsquo;m a</span>
        <RolePicker value={role} onChange={setRole} />
      </div>
      <Field label="Full name" error={errors.name}><input name="name" className="control" autoComplete="name" onChange={clear("name")} /></Field>
      <Field label="School or university" hint="Optional"><input name="school" className="control" autoComplete="organization" /></Field>
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
  const [role, setRole] = useState<Role>("Delegate");
  const [busy, setBusy] = useState("");
  const pwRef = useRef<HTMLFormElement>(null);

  useEffect(() => { if (profile) setRole(profile.role); }, [profile]);
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
      .update({ full_name: String(f.get("name")).trim(), school: String(f.get("school")).trim(), role })
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
          <p className="muted">{session.user.email}{profile && <> · <span className="badge accent">{profile.role}</span></>}</p>
        </div>
        <button className="button secondary" onClick={signOut}>Log out</button>
      </header>

      {recovering && (
        <p className={s.notice} style={{ "--i": 1 } as React.CSSProperties}>Set a new password below to finish resetting it.</p>
      )}

      <form className={`panel ${s.card}`} onSubmit={saveProfile} style={{ "--i": 1 } as React.CSSProperties}>
        <h2 className={s.cardTitle}>Profile</h2>
        <div className="field"><span>I&rsquo;m a</span><RolePicker value={role} onChange={setRole} /></div>
        <label className="field"><span>Full name</span><input name="name" className="control" defaultValue={profile?.full_name ?? ""} key={profile?.full_name} /></label>
        <label className="field"><span>School or university</span><input name="school" className="control" defaultValue={profile?.school ?? ""} key={profile?.school} /></label>
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
