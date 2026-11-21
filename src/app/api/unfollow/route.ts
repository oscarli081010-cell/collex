import { createClient } from "@supabase/supabase-js";

// One-click unsubscribe (RFC 8058). Every email that can be unsubscribed from carries
//   List-Unsubscribe: <https://collex.au/api/unfollow?t=<token>>  and  List-Unsubscribe-Post: List-Unsubscribe=One-Click
// and mail apps POST here with no login and a body we don't need. The token works for every kind: following a
// conference, a conference's own emails, role alerts and the weekly digest (public.unsubscribe in migration 0040).
// A GET (someone opening the address) goes to the unsubscribe page, which asks before doing anything.
const TOKEN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const tokenOf = (req: Request) => new URL(req.url).searchParams.get("t") ?? "";

export async function POST(req: Request) {
  const t = tokenOf(req);
  if (!TOKEN.test(t)) return new Response("Bad link", { status: 400 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (url && key) {
    try {
      const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
      const { error } = await db.rpc("unsubscribe", { t });
      if (error) console.error("One-click unsubscribe failed", error.message);
    } catch (e) {
      console.error("One-click unsubscribe failed", e instanceof Error ? e.message : e);
    }
  } else {
    console.error("One-click unsubscribe: Supabase is not configured");
  }
  // Always 200 for a well-formed token: an unknown or used token means there is nothing left to stop, and mail apps
  // treat anything else as a broken unsubscribe. Nothing here says whose token it was.
  return new Response("Unsubscribed", { status: 200, headers: { "Cache-Control": "no-store" } });
}

export async function GET(req: Request) {
  const t = tokenOf(req);
  const to = new URL("/unfollow", req.url);
  if (TOKEN.test(t)) to.searchParams.set("t", t);
  return Response.redirect(to, 303);
}
