// Sends the queued "you've been added to a committee" emails. A row is queued only by add_chamber_member, which only the
// committee's owner can call for someone who already has a Collex account, so this never emails strangers.
// Needs the RESEND_API_KEY secret (the same one the notify function uses). Safe to call repeatedly: each row is claimed once.
import postgres from "npm:postgres@3.4.5";

const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, { prepare: false });
const KEY = Deno.env.get("RESEND_API_KEY");
const ORIGINS = ["https://collex.au", "https://www.collex.au", "http://localhost:3100"];
const esc = (s: string) => s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);

function html(committee: string, inviter: string, link: string) {
  const font = "-apple-system,'Helvetica Neue',Arial,sans-serif";
  return `<!doctype html><html lang="en-AU"><body style="margin:0;padding:0;background:#fbfaf7;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fbfaf7;padding:48px 16px;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border:1px solid #e6e2d9;border-radius:16px;">
<tr><td style="padding:36px 40px 0;"><img src="https://collex.au/brand/wordmark.png" width="112" height="42" alt="Collex" style="display:block;border:0;"></td></tr>
<tr><td style="padding:28px 40px 0;font-family:Georgia,'Times New Roman',serif;font-size:28px;line-height:1.2;color:#15161a;">${esc(committee)}</td></tr>
<tr><td style="padding:12px 40px 0;font-family:${font};font-size:15px;line-height:1.6;color:#6b6e76;">${esc(inviter)} added you to this committee in Chambers. You can run the console and open the display from your own device.</td></tr>
<tr><td style="padding:24px 40px 0;"><a href="${link}" style="display:inline-block;padding:12px 22px;border-radius:10px;background:#213a73;color:#ffffff;text-decoration:none;font-family:${font};font-size:15px;font-weight:600;">Open the committee</a></td></tr>
<tr><td style="padding:32px 40px 36px;font-family:${font};font-size:12.5px;line-height:1.6;color:#6f7279;">You're getting this because someone added your Collex account to a committee. Log in with this email to open it.</td></tr>
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
    update private.chamber_mail set sent_at = now()
    where id in (select id from private.chamber_mail where sent_at is null order by id limit 20 for update skip locked)
    returning id, chamber_id, user_id, inviter`;

  let sent = 0;
  for (const job of jobs) {
    const [row] = await sql`
      select c.name, u.email from public.chambers c, auth.users u
      where c.id = ${job.chamber_id} and u.id = ${job.user_id} and u.email is not null
        and exists (select 1 from public.chamber_members m where m.chamber_id = c.id and m.user_id = u.id)`;
    if (!row) continue; // removed again before the email went, or the committee is gone
    const link = `https://collex.au/chambers?c=${job.chamber_id}`;
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Collex <hello@collex.au>",
        to: [row.email],
        subject: `${job.inviter} added you to ${row.name}`,
        html: html(row.name, job.inviter, link),
        text: `${row.name}\n\n${job.inviter} added you to this committee in Chambers on Collex.\nOpen it: ${link}\n\nCollex · Sydney NSW, Australia`,
      }),
    });
    if (res.ok) sent++;
    else {
      console.error("Resend failed", res.status, await res.text());
      await sql`update private.chamber_mail set sent_at = null where id = ${job.id}`;
    }
  }
  return Response.json({ jobs: jobs.length, sent }, { headers: cors });
});
