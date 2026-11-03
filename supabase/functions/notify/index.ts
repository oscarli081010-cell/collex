// Sends the queued "follow" emails: when a live conference gains application links or background guides,
// everyone following it gets one short email with a one-click unsubscribe link.
// Needs the RESEND_API_KEY secret (Supabase → Edge Functions → Secrets). Safe to call repeatedly:
// each queued item is claimed once, so nobody gets the same email twice.
import postgres from "npm:postgres@3.4.5";

const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, { prepare: false });
const KEY = Deno.env.get("RESEND_API_KEY");
const ORIGINS = ["https://collex.au", "https://www.collex.au", "http://localhost:3100"];

const SUBJECT: Record<string, (n: string) => string> = {
  delegation: (n) => `${n}: delegate registration is open`,
  chair: (n) => `${n}: chair applications are open`,
  guides: (n) => `${n}: new background guides`,
};
const BODY: Record<string, string> = {
  delegation: "Delegate registration is now open.",
  chair: "Chair applications are now open.",
  guides: "New background guides have been released.",
};
const esc = (s: string) => s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);

function html(name: string, kind: string, page: string, unsub: string) {
  const font = "-apple-system,'Helvetica Neue',Arial,sans-serif";
  return `<!doctype html><html lang="en-AU"><body style="margin:0;padding:0;background:#fbfaf7;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fbfaf7;padding:48px 16px;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border:1px solid #e6e2d9;border-radius:16px;">
<tr><td style="padding:36px 40px 0;"><img src="https://collex.au/brand/wordmark.png" width="112" height="42" alt="Collex" style="display:block;border:0;"></td></tr>
<tr><td style="padding:28px 40px 0;font-family:Georgia,'Times New Roman',serif;font-size:28px;line-height:1.2;color:#15161a;">${esc(name)}</td></tr>
<tr><td style="padding:12px 40px 0;font-family:${font};font-size:15px;line-height:1.6;color:#6b6e76;">${BODY[kind]}</td></tr>
<tr><td style="padding:24px 40px 0;"><a href="${page}" style="display:inline-block;padding:12px 22px;border-radius:10px;background:#213a73;color:#ffffff;text-decoration:none;font-family:${font};font-size:15px;font-weight:600;">Open the conference</a></td></tr>
<tr><td style="padding:32px 40px 36px;font-family:${font};font-size:12.5px;line-height:1.6;color:#6f7279;">You're getting this because you followed ${esc(name)} on Collex. <a href="${unsub}" style="color:#213a73;">Unsubscribe</a> from emails about it.</td></tr>
</table>
<p style="margin:20px 0 0;font-family:${font};font-size:12px;color:#6f7279;"><a href="https://collex.au" style="color:#6f7279;">Collex</a> · Sydney NSW, Australia · hello@collex.au</p>
</td></tr></table></body></html>`;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin") ?? "";
  const cors = {
    "Access-Control-Allow-Origin": ORIGINS.includes(origin) ? origin : ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Vary": "Origin",
  };
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (!KEY) return Response.json({ error: "RESEND_API_KEY is not set" }, { status: 503, headers: cors });

  const jobs = await sql`
    update private.notifications set sent_at = now()
    where id in (select id from private.notifications where sent_at is null order by id limit 20 for update skip locked)
    returning conference_id, kind`;

  let sent = 0;
  for (const job of jobs) {
    const [c] = await sql`select name, slug from public.conferences where id = ${job.conference_id} and status = 'published'`;
    if (!c) continue;
    const people = await sql`
      select u.email, f.token from public.follows f join auth.users u on u.id = f.user_id
      where f.conference_id = ${job.conference_id} and u.email is not null`;
    const page = `https://collex.au/conferences/${c.slug}`;
    for (let i = 0; i < people.length; i += 100) {
      const batch = people.slice(i, i + 100).map((p) => {
        const unsub = `https://collex.au/unfollow?t=${p.token}`;
        return {
          from: "Collex <hello@collex.au>",
          to: [p.email],
          subject: SUBJECT[job.kind](c.name),
          html: html(c.name, job.kind, page, unsub),
          text: `${c.name}\n\n${BODY[job.kind]}\n${page}\n\nUnsubscribe from emails about this conference: ${unsub}\nCollex · Sydney NSW, Australia`,
          headers: {
            "List-Unsubscribe": `<https://collex.au/api/unfollow?t=${p.token}>, <mailto:hello@collex.au?subject=unsubscribe>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
        };
      });
      const res = await fetch("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify(batch),
      });
      if (res.ok) sent += batch.length;
      else console.error("Resend failed", res.status, await res.text());
    }
  }
  return Response.json({ jobs: jobs.length, sent }, { headers: cors });
});
