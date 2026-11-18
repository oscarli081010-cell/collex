// Sends whatever is waiting in the outbox (private.mail): answers to applications, allocations, organisers' emails,
// reminders before key dates, listing claims and role alerts. Each row is one email to one person.
// Needs the RESEND_API_KEY secret. Safe to call by anyone, any number of times: it takes no input, and each row is
// claimed once, so nobody gets the same email twice. A daily job calls it after queuing the reminders; the site calls
// it after an organiser does something that queues mail.
import postgres from "npm:postgres@3.4.5";

const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, { prepare: false });
const KEY = Deno.env.get("RESEND_API_KEY");
const ORIGINS = ["https://collex.au", "https://www.collex.au", "http://localhost:3100"];
const esc = (s: string) => s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);
const okLink = (u: string | null) => (u && /^https:\/\/collex\.au\//.test(u) ? u : null);

type Row = { id: number; email: string; subject: string; heading: string; body: string; link: string | null; link_label: string | null; why: string; unsub: string | null };

function html(m: Row) {
  const font = "-apple-system,'Helvetica Neue',Arial,sans-serif";
  const link = okLink(m.link);
  const unsub = okLink(m.unsub);
  const paras = esc(m.body).split(/\n{2,}/).map((p) => `<p style="margin:0 0 12px;">${p.replace(/\n/g, "<br>")}</p>`).join("");
  return `<!doctype html><html lang="en-AU"><body style="margin:0;padding:0;background:#fbfaf7;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fbfaf7;padding:48px 16px;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border:1px solid #e6e2d9;border-radius:16px;">
<tr><td style="padding:36px 40px 0;"><img src="https://collex.au/brand/wordmark.png" width="112" height="42" alt="Collex" style="display:block;border:0;"></td></tr>
<tr><td style="padding:28px 40px 0;font-family:Georgia,'Times New Roman',serif;font-size:28px;line-height:1.2;color:#15161a;">${esc(m.heading)}</td></tr>
<tr><td style="padding:12px 40px 0;font-family:${font};font-size:15px;line-height:1.6;color:#6b6e76;">${paras}</td></tr>
${link ? `<tr><td style="padding:12px 40px 0;"><a href="${link}" style="display:inline-block;padding:12px 22px;border-radius:10px;background:#213a73;color:#ffffff;text-decoration:none;font-family:${font};font-size:15px;font-weight:600;">${esc(m.link_label ?? "Open Collex")}</a></td></tr>` : ""}
<tr><td style="padding:32px 40px 36px;font-family:${font};font-size:12.5px;line-height:1.6;color:#6f7279;">${esc(m.why)}${unsub ? ` <a href="${unsub}" style="color:#213a73;">Unsubscribe</a> from these emails.` : ""}</td></tr>
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

  let sent = 0;
  // Up to 500 emails a call, a hundred at a time (Resend's batch size).
  for (let round = 0; round < 5; round++) {
    const rows = await sql<Row[]>`
      with claimed as (
        update private.mail set sent_at = now()
        where id in (select id from private.mail where sent_at is null order by id limit 100 for update skip locked)
        returning id, to_user, subject, heading, body, link, link_label, why, unsub)
      select c.id, u.email, c.subject, c.heading, c.body, c.link, c.link_label, c.why, c.unsub
      from claimed c join auth.users u on u.id = c.to_user where u.email is not null order by c.id`;
    if (!rows.length) break;
    const batch = rows.map((m) => {
      const unsub = okLink(m.unsub);
      const link = okLink(m.link);
      return {
        from: "Collex <hello@collex.au>",
        to: [m.email],
        subject: m.subject,
        html: html(m),
        text: `${m.heading}\n\n${m.body}${link ? `\n\n${link}` : ""}\n\n${m.why}${unsub ? `\nUnsubscribe: ${unsub}` : ""}\nCollex · Sydney NSW, Australia`,
        ...(unsub ? { headers: { "List-Unsubscribe": `<${unsub}>` } } : {}),
      };
    });
    const res = await fetch("https://api.resend.com/emails/batch", {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(batch),
    });
    if (res.ok) sent += batch.length;
    else {
      // Nobody in this batch got theirs: put them back so the next call tries again, and stop.
      console.error("Resend failed", res.status, await res.text());
      await sql`update private.mail set sent_at = null where id in ${sql(rows.map((r) => r.id))}`;
      break;
    }
  }
  // Sent mail is kept for a month, then cleared.
  await sql`delete from private.mail where sent_at < now() - interval '30 days'`;
  return Response.json({ sent }, { headers: cors });
});
