"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, type Profile } from "@/lib/supabase";
import { applyTheme } from "@/lib/theme";

type Auth = {
  ready: boolean;
  session: Session | null;
  profile: Profile | null;
  recovering: boolean; // arrived from a password-reset email
  refresh: () => Promise<void>;
};

const Ctx = createContext<Auth>({ ready: false, session: null, profile: null, recovering: false, refresh: async () => {} });
export const useAuth = () => useContext(Ctx);

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(!supabase);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [recovering, setRecovering] = useState(false);

  const current = useRef<{ session: Session | null; profile: Profile | null }>({ session: null, profile: null });

  const load = useCallback(async (s: Session | null, force = false) => {
    // Supabase announces the same signed-in person again whenever a tab regains focus or its token refreshes. Nothing
    // about them has changed then, so keep what's here: forms and effects that depend on the session must not reset
    // (it used to wipe whatever was being typed after a switch to another window and back).
    const prev = current.current.session;
    const same = Boolean(prev && s && prev.user.id === s.user.id && prev.user.updated_at === s.user.updated_at);
    current.current.session = same ? prev : s;
    setSession(same ? prev : s);
    if (!s || !supabase) { current.current.profile = null; setProfile(null); applyTheme("light"); return; } // visitors and signed-out users see light
    const { data } = await supabase.from("profiles").select("id, email, full_name, school, role, is_admin, theme").eq("id", s.user.id).maybeSingle();
    // Still read it again on a refocus (a theme or admin change made elsewhere shows up), but only touch the page if it differs.
    if (same && !force && JSON.stringify(data) === JSON.stringify(current.current.profile)) return;
    current.current.profile = data as Profile | null;
    setProfile(data as Profile | null);
    if (data?.theme) applyTheme(data.theme); // follow the account's choice on any device
  }, []);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => load(data.session).finally(() => setReady(true)));
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === "PASSWORD_RECOVERY") setRecovering(true);
      // Defer: Supabase warns against awaiting its own calls inside this callback.
      setTimeout(() => load(s), 0);
    });
    return () => data.subscription.unsubscribe();
  }, [load]);

  const refresh = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase.auth.getSession();
    await load(data.session, true); // asked for on purpose (a saved profile), so read it again
  }, [load]);

  return <Ctx.Provider value={{ ready, session, profile, recovering, refresh }}>{children}</Ctx.Provider>;
}
