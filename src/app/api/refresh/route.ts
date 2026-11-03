import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";

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
    db.from("conferences").select("id", { count: "exact", head: true }).eq("submitted_by", user.id),
    db.from("organisers").select("conference_id", { count: "exact", head: true }).eq("user_id", user.id).not("accepted_at", "is", null),
  ]);
  if (!me.data?.is_admin && !mine.count && !team.count) return new Response("Not allowed", { status: 403 });

  revalidatePath("/", "layout");
  return Response.json({ refreshed: true });
}
