import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";

// At most one full-site rebuild per person every 10 seconds. Kept in memory, so it is per server instance and resets
// when the instance restarts: enough to stop one account hammering revalidation, not a hard guarantee.
const GAP = 10_000;
const lastAt = new Map<string, number>();

// Rebuilds the cached pages straight away after a listing changes, instead of waiting up to a minute.
// Only admins, and people who run a listing (its owner or an accepted co-organiser), can ask for it.
export async function POST(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const token = req.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!url || !key || !token) return new Response("Log in first", { status: 401 });

  // Every query runs as the caller, so row-level security decides what they can see.
  const db = createClient(url, key, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } });
  const { data: { user } } = await db.auth.getUser(token);
  if (!user) return new Response("Log in first", { status: 401 });
  const [me, mine, team] = await Promise.all([
    db.from("profiles").select("is_admin").eq("id", user.id).maybeSingle(),
    db.rpc("my_listings").select("id").limit(1),
    db.from("organisers").select("conference_id", { count: "exact", head: true }).eq("user_id", user.id).not("accepted_at", "is", null),
  ]);
  if (!me.data?.is_admin && !(mine.data as unknown[] | null)?.length && !team.count) return new Response("Not allowed", { status: 403 });

  const now = Date.now();
  const wait = (lastAt.get(user.id) ?? 0) + GAP - now;
  if (wait > 0) return new Response("Try again in a few seconds", { status: 429, headers: { "Retry-After": String(Math.ceil(wait / 1000)) } });
  // Stamped before rebuilding, so two requests at once can't both get through.
  lastAt.set(user.id, now);
  for (const [id, at] of lastAt) if (now - at >= GAP) lastAt.delete(id);

  revalidatePath("/", "layout");
  return Response.json({ refreshed: true });
}
