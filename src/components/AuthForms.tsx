"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { uploadPhoto } from "@/lib/photo";
import { supabase } from "@/lib/supabase";
import { applyTheme, THEMES, type Theme } from "@/lib/theme";
import { useAuth } from "./AuthProvider";
import CodeInput from "./CodeInput";
import PageBand, { type BandProps } from "./PageBand";
import SchoolPicker from "./SchoolPicker";
import { FormSkeleton } from "./Skeleton";
import ConferencesTab from "./AccountSections";
import { ICONS } from "./IconButton";
import { META_ICONS } from "./MetaIcons";
import PanelTabs from "./PanelTabs";
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
/** Where to go after logging in or signing up: a page on this site named in ?next= (a join link, say), or the account page. */
const nextPage = () => {
  if (typeof window === "undefined") return "/account";
  const n = new URLSearchParams(window.location.search).get("next");
  return n && n.startsWith("/") && !n.startsWith("//") && !n.startsWith("/\\") ? n : "/account";
};
/** A link to the other auth page that carries ?next= along (read after the page loads, so the server and browser agree). */
function NextLink({ path, className, children }: { path: string; className: string; children: React.ReactNode }) {
  const [href, setHref] = useState(path);
  useEffect(() => {
    const n = new URLSearchParams(window.location.search).get("next");
    if (n) setHref(`${path}?next=${encodeURIComponent(n)}`);
  }, [path]);
  return <Link href={href} className={className}>{children}</Link>;
}

// The page's headline band, with the page's content centred underneath.
function Banded({ band, children }: { band: BandProps; children: React.ReactNode }) {
  return (
    <>
      <PageBand {...band} />
      <div className={s.body}>{children}</div>
    </>
  );
}

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

// aria-label keeps the Show button's text out of the field's name, since the surrounding <label> also wraps the button.
function Password({ name, autoComplete, onChange, label = "Password" }: { name: string; autoComplete: string; onChange?: () => void; label?: string }) {
  const [show, setShow] = useState(false);
  return (
    <span className={s.pw}>
      <input name={name} type={show ? "text" : "password"} className="control" aria-label={label} autoComplete={autoComplete} minLength={8} onChange={onChange} />
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
  const router = useRouter();
  const [checking, setChecking] = useState(false);
  const [wrong, setWrong] = useState(0);
  // The same email carries a link and a 6-digit code; the code confirms the account without leaving this tab.
  const verify = async (token: string) => {
    if (!supabase) return;
    setChecking(true);
    const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
    setChecking(false);
    if (!error && navigator.vibrate && matchMedia("(pointer: coarse)").matches) navigator.vibrate(12); // a light tap on phones
    if (error) {
      setWrong((n) => n + 1);
      return say(/expired/i.test(error.message) ? "That code has expired. Send a new one." : "That code isn't right. Try again.");
    }
    router.push(nextPage());
  };
  const resend = async () => {
    if (!supabase) return;
    const { error } = kind === "signup"
      ? await supabase.auth.resend({ type: "signup", email, options: { emailRedirectTo: `${origin()}/account` } })
      : await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${origin()}/account` });
    say(error ? friendly(error.message) : "Sent again");
  };
  return (
    <Banded band={{
      title: "Check your", accent: "email",
      lead: <>We sent a link to <strong className={s.strong}>{email}</strong>. <span className={s.oneLine}>{kind === "signup" ? "Open it, or type the 6-digit code from the email here." : "Open it to set a new password."}</span></>,
    }}>
    <div className={`t-reveal ${s.sent}`} role="status">
      {kind === "signup" && (
        <div className={s.code}>
          <CodeInput onComplete={verify} errors={wrong} disabled={checking} />
          <small key={String(checking)} className="t-swap muted">{checking ? "Checking…" : "The code works for an hour."}</small>
        </div>
      )}
      <div className="btnStack one">
        <button className="button secondary lg" onClick={resend}>Send it again</button>
        <button className="button secondary lg" onClick={onBack}>Use a different email</button>
      </div>
      {node}
    </div>
    </Banded>
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
    if (!f.get("agree")) found.agree = "Tick the box to agree before creating an account.";
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
    <Banded band={{ title: "Create your", accent: "account", lead: "Follow conferences for email updates, and list your own." }}>
    <form key="form" className={`t-reveal ${s.form}`} onSubmit={submit} noValidate>
      <NotReady />
      <Field label="Full name" error={errors.name}><input name="name" className="control" maxLength={120} autoComplete="name" onChange={clear("name")} /></Field>
      <Field label="School or University" hint="Optional"><SchoolPicker /></Field>
      <Field label="Email" error={errors.email}><input name="email" type="email" className="control" autoComplete="email" onChange={clear("email")} /></Field>
      <Field label="Password" error={errors.password} hint="At least 8 characters"><Password name="password" autoComplete="new-password" onChange={clear("password")} /></Field>
      <div>
        <label className={`check ${errors.agree ? "invalid" : ""}`}>
          <input type="checkbox" name="agree" aria-invalid={Boolean(errors.agree)} aria-describedby={errors.agree ? "agree-err" : undefined} onChange={clear("agree")} />
          <span>I agree to the <Link href="/terms" target="_blank">Terms of use</Link> and <Link href="/privacy" target="_blank">Privacy policy</Link>. If I&rsquo;m under 18, a parent or guardian has said yes.</span>
        </label>
        {errors.agree && <small key="e" id="agree-err" className={`t-reveal ${s.error}`} style={{ display: "block", marginTop: 6, fontSize: 12.5 }}>{errors.agree}</small>}
      </div>
      {errors.form && <p key={errors.form} className={`t-reveal ${s.formError}`}>{errors.form}</p>}
      <button className={`button lg ${s.submit}`} disabled={busy || !supabase}>
        <span key={String(busy)} className="t-swap">{busy ? "Creating account…" : "Create account"}</span>
      </button>
      <p className={s.switch}>Already have an account? <NextLink path="/login" className="link">Log in</NextLink></p>
    </form>
    </Banded>
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
    router.push(nextPage());
  }

  if (sent) return <Sent email={sent} kind="reset" onBack={() => { setSent(null); setMode("login"); }} />;

  return (
    <Banded band={mode === "login"
      ? { title: "Log", accent: "in", lead: "Follow conferences, list your own and keep track of your conferences." }
      : { title: "Reset your", accent: "password", lead: "We’ll email you a link to set a new one." }}>
    <form key={mode} className={`t-reveal ${s.form}`} onSubmit={submit} noValidate>
      <NotReady />
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
            <NextLink path="/signup" className="link">Create an account</NextLink>
          </>
        ) : (
          <button type="button" className={s.textBtn} onClick={() => { setMode("login"); setError(""); }}>← Back to log in</button>
        )}
      </p>
    </form>
    </Banded>
  );
}

type AccountTab = "profile" | "conferences";
const ACCOUNT_TABS: { id: AccountTab; label: string; icon: React.ReactNode }[] = [
  { id: "profile", label: "Profile", icon: <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="8" cy="5.5" r="2.5" /><path d="M2.8 13.5c.6-2.3 2.6-3.6 5.2-3.6s4.6 1.3 5.2 3.6" /></svg> },
  { id: "conferences", label: "Conferences", icon: <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2.5" y="3.5" width="11" height="10" rx="2" /><path d="M2.5 6.5h11M5.5 2v3M10.5 2v3" /></svg> },
];

// Profile / Conferences on the same sliding control as Appearance. A badge on Conferences means an invite is waiting.
export function AccountTabs({ tab, setTab, invites = 0 }: { tab: AccountTab; setTab: (t: AccountTab) => void; invites?: number }) {
  const tabs = ACCOUNT_TABS.map((a) => (a.id === "conferences" ? { ...a, badge: invites, badgeNote: `${invites} ${invites === 1 ? "invite" : "invites"} waiting` } : a));
  return <PanelTabs tabs={tabs} tab={tab} setTab={setTab} label="Account" idPrefix="account" />;
}

// The account picture. Hover (or focus) it to change it; on a touch screen the camera is always showing.
export function AvatarEditor({ userId, url, initials, onChange, onError }: { userId: string; url: string | null; initials: string; onChange: (url: string) => Promise<void>; onError: (m: string) => void }) {
  const [busy, setBusy] = useState(false);
  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    const res = await uploadPhoto(file, userId);
    if ("error" in res) onError(res.error); else await onChange(res.url);
    setBusy(false);
  };
  return (
    <label className={s.avatarEdit} data-busy={busy || undefined}>
      <span className={s.avatar} aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element -- the account photo */}
        {url ? <img src={url} alt="" /> : initials}
      </span>
      <span className={s.avatarCover} aria-hidden="true">
        <svg width="22" height="22" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 6.5h2.2L6 4.5h6l1.3 2h2.2v7h-13z" /><circle cx="9" cy="9.8" r="2.4" /></svg>
        <span>{busy ? "Saving" : "Change"}</span>
      </span>
      <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={busy} aria-label="Change your profile picture"
        onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
    </label>
  );
}

export function AccountView() {
  const { ready, session, profile, recovering, refresh } = useAuth();
  const router = useRouter();
  const { say, node } = useToast();
  const [busy, setBusy] = useState("");
  const pwRef = useRef<HTMLFormElement>(null);
  const [counts, setCounts] = useState<{ listings: number | null; following: number | null }>({ listings: null, following: null });
  const [invites, setInvites] = useState(0);
  // The open tab lives in the address (#conferences), so a refresh or a link from elsewhere lands on the right one.
  const [tab, setTab] = useState<AccountTab>("profile");
  useEffect(() => {
    const read = () => setTab(location.hash === "#conferences" ? "conferences" : "profile");
    if (location.hash === "#conferences") setTab("conferences");
    window.addEventListener("hashchange", read);
    return () => { window.removeEventListener("hashchange", read); };
  }, []);
  const choose = useCallback((t: AccountTab) => {
    setTab(t);
    history.replaceState(history.state, "", location.pathname + (t === "conferences" ? "#conferences" : ""));
  }, []);

  // Arriving from a password-reset email: the password form is on Profile, so go there.
  useEffect(() => {
    if (!recovering) return;
    setTab("profile");
    pwRef.current?.querySelector("input")?.focus();
  }, [recovering]);
  const uid = session?.user.id;
  useEffect(() => {
    if (!uid || !supabase) return;
    supabase.from("follows").select("conference_id", { count: "exact", head: true })
      .then(({ count }) => setCounts((c) => ({ ...c, following: count ?? 0 })));
  }, [uid]);
  const onListings = useCallback((n: number) => setCounts((c) => ({ ...c, listings: n })), []);

  if (!ready) return <FormSkeleton fields={3} width={640} />;
  if (!session || !supabase) {
    return (
      <Banded band={{
        title: "Your", accent: "account", lead: "Log in to see your account.",
        aside: (
          <div className="btnStack">
            <Link href="/login" className="button lg">Log in</Link>
            <Link href="/signup" className="button secondary lg">Create an account</Link>
          </div>
        ),
      }}>{null}</Banded>
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
    <Banded band={{
      title: name,
      media: <AvatarEditor userId={session.user.id} url={profile?.avatar_url ?? null} initials={initials} onChange={async (url) => {
        const { error } = await supabase!.from("profiles").update({ avatar_url: url }).eq("id", session.user.id);
        if (error) return say("Couldn't save the photo. Try again.");
        await refresh();
        say("Photo updated");
      }} onError={say} />,
      lead: (
        <ul className={s.identity}>
          <li>{META_ICONS.mail}<span>{session.user.email}</span></li>
          {profile?.school && <li>{META_ICONS.host}<span>{profile.school}</span></li>}
        </ul>
      ),
      figures: [
        { label: "Running", value: counts.listings === null ? "–" : String(counts.listings) },
        { label: "Following", value: counts.following === null ? "–" : String(counts.following) },
      ],
      aside: <button className={`button secondary ${s.logout}`} onClick={signOut}>{ICONS.leave}Log out</button>,
    }}>
    <div className={s.account}>

      {recovering && (
        <p className={s.notice}>Set a new password below to finish resetting it.</p>
      )}

      <AccountTabs tab={tab} setTab={choose} invites={invites} />

      {/* Both stay mounted, so the counts above are right and a half-typed form survives a trip to the other tab.
          Each panel's entrance replays whenever it is shown again. */}
      <div id="account-panel-profile" role="tabpanel" aria-labelledby="account-tab-profile" hidden={tab !== "profile"} className={`t-stagger ${s.panelStack}`}>
        <section className={`panel ${s.card}`} style={{ "--i": 0 } as React.CSSProperties}>
          <h2 className={s.cardTitle}>Appearance</h2>
          <ThemePicker userId={session.user.id} initial={profile?.theme ?? "light"} onSaved={(ok) => { if (!ok) say("Couldn't save that. It still applies on this device."); }} />
        </section>

        <form className={`panel ${s.card}`} onSubmit={saveProfile} style={{ "--i": 1 } as React.CSSProperties}>
          <h2 className={s.cardTitle}>Profile</h2>
          <label className="field"><span>Full name</span><input name="name" className="control" maxLength={120} defaultValue={profile?.full_name ?? ""} key={profile?.full_name} /></label>
          <div className="field"><span>School or University</span><SchoolPicker defaultValue={profile?.school ?? ""} /></div>
          <button className="button" disabled={busy === "profile"}>
            <span key={String(busy === "profile")} className="t-swap">{busy === "profile" ? "Saving…" : "Save profile"}</span>
          </button>
        </form>

        <form ref={pwRef} className={`panel ${s.card} ${recovering ? s.highlight : ""}`} onSubmit={savePassword} style={{ "--i": 2 } as React.CSSProperties}>
          <h2 className={s.cardTitle}>Password</h2>
          <label className="field"><span>New password</span><Password name="password" label="New password" autoComplete="new-password" /></label>
          <button className="button" disabled={busy === "password"}>
            <span key={String(busy === "password")} className="t-swap">{busy === "password" ? "Updating…" : "Update password"}</span>
          </button>
        </form>
      </div>

      <div id="account-panel-conferences" role="tabpanel" aria-labelledby="account-tab-conferences" hidden={tab !== "conferences"} className={`t-stagger ${s.panelStack}`}>
        <ConferencesTab userId={session.user.id} onListings={onListings} onInvites={setInvites} />
      </div>
      {node}
    </div>
    </Banded>
  );
}
