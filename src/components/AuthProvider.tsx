"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
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

  const load = useCallback(async (s: Session | null) => {
    setSession(s);
    if (!s || !supabase) { setProfile(null); applyTheme("light"); return; } // visitors and signed-out users see light
    const { data } = await supabase.from("profiles").select("id, email, full_name, school, role, is_admin, theme").eq("id", s.user.id).maybeSingle();
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
    await load(data.session);
  }, [load]);

  return <Ctx.Provider value={{ ready, session, profile, recovering, refresh }}>{children}</Ctx.Provider>;
}
