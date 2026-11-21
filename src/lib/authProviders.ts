// Which sign-in providers the Supabase project has switched on. Asked once per page load, so a provider's button
// can be left out until the owner enables it in the dashboard: no broken button, no code change needed later.
let google: Promise<boolean> | null = null;

/** True only when Supabase says Google sign-in is on. Any failure, missing setting or slow answer counts as off. */
export function googleEnabled(): Promise<boolean> {
  google ??= (async () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) return false;
    // Four seconds is plenty; a slower answer is not worth holding the page for.
    const stop = new AbortController();
    const timer = setTimeout(() => stop.abort(), 4000);
    try {
      const res = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key }, signal: stop.signal });
      if (!res.ok) return false;
      const settings = await res.json();
      return settings?.external?.google === true;
    } catch {
      return false;
    } finally {
      clearTimeout(timer);
    }
  })();
  return google;
}
