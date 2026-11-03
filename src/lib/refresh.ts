import { supabase } from "./supabase";

/** Asks the server to rebuild the public pages now that a listing has changed. Failing quietly is fine: they refresh within a minute anyway. */
export async function refreshSite() {
  const { data } = (await supabase?.auth.getSession()) ?? { data: { session: null } };
  if (!data.session) return;
  await fetch("/api/refresh", { method: "POST", headers: { Authorization: `Bearer ${data.session.access_token}` } }).catch(() => {});
}
