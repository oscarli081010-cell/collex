"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import * as ch from "@/lib/chamber";
import { supabase } from "@/lib/supabase";
import { forgetChamber, isId, useChamber } from "@/lib/useChamber";
import { useAuth } from "./AuthProvider";
import IconButton, { ConfirmIconButton, ICONS } from "./IconButton";
import { PageSkeleton } from "./Skeleton";
import PanelTabs from "./PanelTabs";

/** Back to the top of the page in about a quarter of a second, easing out; straight there when motion is reduced. */
function scrollToTop() {
  const from = window.scrollY;
  if (from < 8) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { window.scrollTo(0, 0); return; }
  const t0 = performance.now();
  const step = (t: number) => {
    const k = Math.min(1, (t - t0) / 260);
    window.scrollTo(0, from * (1 - (1 - Math.pow(1 - k, 3))));
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
import { useToast } from "./useToast";
import s from "./Chambers.module.css";
import { useChairRoom } from "@/lib/useRoom";
import { DevicesCard, Inbox, RoomSettings } from "./RoomChair";
import { useOfflineReady } from "./Offline";
import { FilesPanel, NotesPanel } from "./RoomParts";
import { ConferenceLink } from "./HubExtras";
import { MONITOR, SLIDERS, LEFT, useNow, chime, BackCtx } from "./committees/shared";
import { Setup } from "./committees/setup";
import { Rail, Welcome, RollCallOpen, Pick, TrinityPick } from "./committees/opening";
import { Floor } from "./committees/floor";
import { Lists, AmendmentForm, AmendmentQueue } from "./committees/amendments";
import { RollCall } from "./committees/voting";
import { Motions, Documents, ChairTools } from "./committees/motions";
import { Resolutions, RollPanel, Shortcuts, OfflineNote, Sound, DisplaySounds, Times, Background, Share } from "./committees/settings";
import { Analytics } from "./committees/analytics";

export { useNow, Seg } from "./committees/shared";

export default function Chambers() {
  const params = useSearchParams();
  const q = params.get("c");
  const cloudId = isId(q) ? q : null;
  // The Committees home, asked for by name (Back to Committees), even while a committee is kept in this browser.
  const home = !cloudId && params.get("tab") !== null;
  const { ready: authReady, session } = useAuth();
  const router = useRouter();
  const { c, status, owner, manage, act, setLocal, notice, clearNotice, me } = useChamber(cloudId, { signedIn: !!session, authReady });
  const [live, setLive] = useState("");
  const [view, setView] = useState<"manage" | "room" | "analytics" | "settings" | "share">("manage");
  // Delegates' devices, for a shared committee. Asked for often while they are on; otherwise only now and then.
  const [devOn, setDevOn] = useState(false);
  const rm = useChairRoom(cloudId && session && status !== "denied" && status !== "signin" ? cloudId : null, devOn);
  useEffect(() => { setDevOn(!!rm.data?.on); }, [rm.data?.on]);
  const { say, node } = useToast();
  // The scripts this console needs are kept as soon as it opens, so it opens again without wifi.
  const offline = useOfflineReady();

  const clockRun = ch.running(c?.tr?.cauc?.clock ?? null);
  const now = useNow(ch.running(c?.timer ?? null) || clockRun || (!!c?.tr && Object.keys(c.tr.observers).length > 0));
  const left = c?.timer ? ch.remaining(c.timer, now) : 0;
  const state = !c?.timer ? "none" : left === 0 ? "up" : c.timer.endsAt !== null ? "running" : "paused";

  // A timer that reaches zero keeps running and shows the overtime ("+0:12"). The chime sounds once for each timer.
  const chimed = useRef("");
  const timerKey = c?.timer && c.timer.endsAt !== null ? `${c.timer.label}|${c.timer.total}|${c.timer.endsAt}` : "";
  useEffect(() => {
    if (state !== "up" || !timerKey || chimed.current === timerKey) return;
    chimed.current = timerKey;
    // In a moderated caucus or an amendment's debate, the caucus's own clock stops at the speaker's 0:00 (as it did when
    // the speaker's clock stopped there), so the overtime isn't taken from the caucus.
    act((x) => ch.overrun(x, ch.now()), false);
    setLive("Time's up");
    chime();
  }, [state, timerKey, act]);
  // The same for the clock of a whole moderated caucus.
  const cauc = c?.tr?.cauc?.clock ?? null;
  const caucUp = !!cauc && cauc.endsAt !== null && ch.remaining(cauc, now) === 0;
  useEffect(() => {
    if (!caucUp) return;
    act((x) => ch.pauseCauc(x, ch.now()), false);
    setLive("The caucus is over");
  }, [caucUp, act]);

  // What a screen reader hears as the debate moves on.
  const sp = c?.speech;
  useEffect(() => {
    if (!c) return;
    setLive(sp ? `${ch.ROLE_LABEL[sp.role]} ${ch.nameOf(c, sp.who)}: ${sp.phase === "speech" ? "speech" : sp.phase === "after" ? (ch.takingPoints(sp) ? "Points of Information" : "choosing how to yield") : sp.phase === "ask" ? `Point of Information from ${ch.nameOf(c, sp.asker)}` : "reply"}` : ch.substep(c));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp?.who, sp?.phase, sp?.asker, c?.step, c?.amend?.stage]);

  // Between a speech and a Point of Information there is no clock to run: the speech is over, and its time is only kept
  // in case the chair goes back to it.
  const toggle = () => { if (c?.speech?.phase !== "after") act((x) => (ch.running(x.timer) ? ch.pauseTimer(x, ch.now()) : ch.startTimer(x, ch.now())), false); };
  // Space starts or pauses the timer. N calls the next speaker (or the proposer, co-sponsor or opposer at their step),
  // and only when no one is speaking, so a stray key can't end a speech. E ends the speech, Y yields it to the chair,
  // and Ctrl or Cmd with Z goes Back one step.
  const callNext = () => { if (c && ch.callNextSpeaker(c) !== c) act(ch.callNextSpeaker); };
  const endNow = () => { const sp = c?.speech; if (sp?.phase === "speech") act((x) => ch.endSpeech(x, ch.now(), sp.who)); };
  const yieldNow = () => { const sp = c?.speech; if (sp?.phase === "after") act((x) => ch.yieldToChair(x, sp.who, sp.pois)); };
  const backNow = () => {
    if (!c || !ch.canGoBack(c)) return;
    if (ch.backIsOthers(c, me())) { say(ch.BACK_OTHERS); return; }
    act((x) => ch.goBack(x, ch.now(), me()), false);
  };
  const keys = useRef({ toggle, callNext, endNow, yieldNow, backNow });
  keys.current = { toggle, callNext, endNow, yieldNow, backNow };
  // A button that moves the committee on to its next screen (Begin Debate, Start the Speeches, Record the Result)
  // may be far down a long page: the new screen is brought to the top, quickly, so the chair never has to scroll back.
  const stepSeen = useRef(c?.step);
  useEffect(() => {
    if (stepSeen.current === c?.step) return;
    const first = stepSeen.current === undefined;
    stepSeen.current = c?.step;
    if (!first && c) scrollToTop();
  }, [c?.step]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (e.isComposing || el?.isContentEditable || el?.closest("input, textarea, select, [contenteditable]")) return; // never while typing
      if (document.querySelector("dialog[open], [aria-modal=true]")) return; // nor with a dialog open (search, report a problem)
      if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "z") { e.preventDefault(); keys.current.backNow(); return; }
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      const k = e.key.toLowerCase();
      if (k === " ") { if (el?.closest("button, a, [role=tab]")) return; e.preventDefault(); keys.current.toggle(); }
      else if (k === "n") keys.current.callNext();
      else if (k === "e") keys.current.endNow();
      else if (k === "y") keys.current.yieldNow();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (cloudId && (status === "signin" || status === "denied")) {
    return (
      <main id="top" className={`container ${s.setup}`}>
        <div className={`panel ${s.notice}`}>
          <h1 className={`serif ${s.name}`}>{status === "signin" ? "Log in to open this committee" : "This committee isn't shared with you"}</h1>
          <p className="muted">{status === "signin" ? "Shared committees are for the chairs who were added to them. Log in with the account they added." : "Ask the person who runs it to add the email on your Collex account."}</p>
          <div className="btnStack">
            {status === "signin" && <Link href="/login" className="button">Log In</Link>}
            <Link href="/chambers?tab=yours" className="button secondary">Your Committees</Link>
          </div>
        </div>
      </main>
    );
  }
  if (status === "loading" || (cloudId && !c)) return <main id="top" className="container"><PageSkeleton /></main>;
  if (!c || home) return <>
    <Setup signedIn={!!session} local={c} onCreate={async (x, devices) => {
      // Every committee is saved to the account from the start, so it survives a cleared browser or a dead laptop.
      // A committee kept in this browser is never replaced: if saving fails while one is kept, the chair stays on the form.
      if (supabase && session) {
        let id: string | null = null;
        let message = "";
        let limit = false;
        try {
          const { data, error } = await supabase.rpc("create_chamber", { initial: x });
          if (error || !data) { message = error?.message ?? ""; limit = error?.code === "54000"; } else id = data as string;
        } catch { /* the network dropped part-way: handled like any other failure below */ }
        if (id) {
          // Delegates' devices are turned on straight away; a failure here leaves the committee made, and the Share tab can retry.
          if (devices) await supabase.rpc("chamber_devices", { cid: id, action: "on" });
          router.replace(`/chambers?c=${id}`);
          return;
        }
        // The account's own limit message is shown as it is, because keeping the committee in this browser would not fix it.
        if (limit && c) { say(message); return; }
        // At the account's limit with nothing kept here: the committee is kept in this browser, as it always could be.
        if (limit) { setLocal(x); say(message); if (home) router.replace("/chambers"); return; }
        if (c) { say(message || "Couldn't reach Collex"); return; }
        setLocal(x);
        say("Couldn't reach Collex, so this committee is kept in this browser for now. Share it from the Share tab once you're back online.");
        if (home) router.replace("/chambers");
        return;
      }
      if (c) { say("Log in to start another committee"); return; }
      setLocal(x); say("Committee opened");
      if (home) router.replace("/chambers");
    }} />
    {node}
  </>;

  const display = cloudId ? `/chambers/display?c=${cloudId}` : "/chambers/display";

  const finish = async (fn: () => PromiseLike<{ error: { message: string } | null }>) => {
    const { error } = await fn();
    if (error) { say(error.message); return; }
    if (cloudId) forgetChamber(cloudId); // deleted or left: the copy kept in this browser goes with it
    router.replace("/chambers");
  };
  const leave = () => cloudId && supabase && session && finish(() => supabase!.rpc("remove_chamber_member", { cid: cloudId, target: session.user.id }));
  const remove = () => {
    if (!cloudId) { setLocal(null); return; }
    if (!supabase) return;
    return owner ? finish(() => supabase!.rpc("delete_chamber", { cid: cloudId })) : leave();
  };

  const inDebate = c.step === "caucus" || c.step === "floor" || c.step === "amend";
  const t = c.tr;
  const trWork = !!t && c.step !== "welcome" && c.step !== "roll" && c.step !== "ended"; // the motions, documents and chair's tools
  const amendOpen = t ? ch.amendmentsOpen(c) : inDebate; // the same rule as the pill on the display

  return (
    <BackCtx.Provider value={{ me, say }}>
    <main id="top" className={`container ${s.page}`}>
      <header className={s.top}>
        <div className={s.nameBox}>
        <h1 className={`serif ${s.name}`}>
          {c.name}
          {cloudId && <i className={`${s.liveDot} ${s.nameDot}`} data-off={status === "offline"} title={status === "offline" ? "Offline" : "Shared and live"} aria-hidden="true" />}
        </h1>
        <dl className={s.facts3}>
          <div><dt>Procedure</dt><dd>{ch.procedureName(c)}</dd></div>
          {c.topic && <div className={s.factWide}><dt>{t ? "Topic" : "Resolution"}</dt><dd>{c.topic}</dd></div>}
        </dl>
        </div>
        <div className={s.topActions}>
          <Link className={`button secondary ${s.topBtn}`} href="/chambers?tab=yours">{LEFT}<span><span className={s.topLong}>Back to </span>Committees</span></Link>
          <a className={`button secondary ${s.topBtn}`} href={display} target="_blank" rel="noopener">{MONITOR}Open Display</a>
          <ConfirmIconButton label={cloudId && !owner ? "Leave this committee" : cloudId ? "Delete this committee" : "Close this committee"}
            confirm="Click again to confirm" icon={cloudId && !owner ? ICONS.leave : ICONS.trash} onConfirm={() => void remove()} />
        </div>
      </header>
      {notice && (
        <div className={`${s.result} ${s.noticeRow}`} data-pass="false" role="alert">
          <span>{notice}</span>
          <IconButton label="Dismiss" icon={ICONS.close} onClick={clearNotice} />
        </div>
      )}
      {status === "offline" && <p className={s.result} data-pass="false" role="alert">Offline, changes will send when you&rsquo;re back.</p>}

      <div className="sr-only" role="status" aria-live="polite">{live}</div>

      <PanelTabs idPrefix="chv" label="Committee" tab={view} setTab={setView}
        tabs={[{ id: "manage", label: "Manage", icon: ICONS.manage, badge: (devOn && (rm.data ? rm.data.asks.length + rm.data.seats.filter((x) => x.approved === false).length : 0)) || undefined, badgeNote: "from delegates" }, ...(devOn ? [{ id: "room" as const, label: "Room", icon: ICONS.view }] : []), { id: "analytics", label: "Analytics", icon: ICONS.chart }, { id: "share", label: "Share", icon: ICONS.share }, { id: "settings", label: status === "offline" ? "Settings (offline)" : "Settings", icon: SLIDERS }]} />

      {view === "manage" ? (
        <div id="chv-panel-manage" role="tabpanel" aria-labelledby="chv-tab-manage" className={s.manage}>
          <Rail c={c} />
          {devOn && rm.data && cloudId && <Inbox c={c} cid={cloudId} act={act} room={rm.data} say={say} refresh={rm.refresh} />}
          {c.step === "welcome" ? <Welcome c={c} act={act} />
            : c.step === "roll" ? <RollCallOpen c={c} act={act} />
            : c.step === "pick" ? (t ? <TrinityPick c={c} act={act} /> : <Pick c={c} act={act} />)
            : <Floor c={c} act={act} left={left} now={now} state={state} toggle={toggle} />}
          {(t ? ch.listOpen(c) : inDebate && ch.listOpen(c)) && <Lists c={c} act={act} wide />}
          {amendOpen && <div className={s.pair}><AmendmentForm c={c} act={act} /><AmendmentQueue c={c} act={act} /></div>}
          {(c.step === "vote" || c.step === "closed" || c.step === "ended") && <RollCall c={c} act={act} />}
          {trWork && (ch.motionsOpen(c) || c.poll?.kind === "motion" || t.motions.some((m) => m.status === "waiting")) && <Motions c={c} act={act} />}
          {trWork && c.step !== "statements" && <Documents c={c} act={act} />}
          {trWork && (!c.style || !!t.reply) && <ChairTools c={c} act={act} now={now} />}
          {c.step !== "welcome" && c.step !== "roll" && <RollPanel c={c} act={act} />}
        </div>
      ) : view === "share" ? (
        <div id="chv-panel-share" role="tabpanel" aria-labelledby="chv-tab-share" className={s.manage}>
          <Share c={c} cloudId={cloudId} manage={manage} signedIn={!!session} meId={session?.user.id} say={say} setLocal={setLocal} />
          {cloudId && <DevicesCard c={c} cid={cloudId} act={act} room={rm.data} manage={manage} say={say} refresh={rm.refresh} />}
          {cloudId && <ConferenceLink cid={cloudId} name={c.name} manage={manage} say={say} />}
        </div>
      ) : view === "room" && cloudId && rm.data ? (
        <div id="chv-panel-room" role="tabpanel" aria-labelledby="chv-tab-room" className={s.manage}>
          <NotesPanel c={c} cid={cloudId} notes={rm.data.notes} me="chair" rule={rm.data.room.notes ?? "on"} say={say} onSent={rm.refresh} />
          <RoomSettings cid={cloudId} room={rm.data} say={say} refresh={rm.refresh} />
          <FilesPanel c={c} cid={cloudId} files={rm.data.files} userId={session?.user.id} chair say={say} onChange={rm.refresh} />
        </div>
      ) : view === "analytics" ? (
        <Analytics c={c} say={say} act={act} cloudId={cloudId} />
      ) : (
        <div id="chv-panel-settings" role="tabpanel" aria-labelledby="chv-tab-settings" className={s.manage}>
          {t && !c.style && <Resolutions c={c} act={act} />}
          <Times c={c} act={act} />
          <div className={s.pairTop}>
            <Sound />
            <DisplaySounds c={c} act={act} />
          </div>
          <Shortcuts />
          <Background c={c} act={act} say={say} userId={session?.user.id} />
          <OfflineNote st={offline} />
        </div>
      )}
      {node}
    </main>
    </BackCtx.Provider>
  );
}
