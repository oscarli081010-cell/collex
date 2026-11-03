import { supabase } from "@/lib/supabase";

// One-click unsubscribe (RFC 8058): mail apps POST here from the List-Unsubscribe header.
export async function POST(req: Request) {
  const t = new URL(req.url).searchParams.get("t") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(t) || !supabase) return new Response("Bad link", { status: 400 });
  const { error } = await supabase.rpc("unfollow", { t });
  return new Response(error ? "Try again later" : "Unsubscribed", { status: error ? 500 : 200 });
}
