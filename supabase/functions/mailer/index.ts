// Sends whatever is waiting in the outbox (private.mail): answers to applications, allocations, organisers' emails,
// reminders before key dates, listing claims and role alerts. Each row is one email to one person.
// Needs the RESEND_API_KEY secret. Safe to call by anyone, any number of times: it takes no input, and each row is
// claimed by one run at a time, so nobody gets the same email twice. A daily job calls it after queuing the reminders;
// the site calls it after an organiser does something that queues mail.
// Each email succeeds or fails on its own. One Resend refuses (a bad address, say) is marked failed and never tried
// again; one that fails for a passing reason (too many requests, Resend down, no connection) is tried again by a later
// run, at most five times in all. A run that crashes leaves its rows claimed; another run takes them after 15 minutes.
// Needs the claimed_at, attempts, failed_at and last_error columns from migration 0035.
import postgres from "npm:postgres@3.4.5";

const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, { prepare: false });
const KEY = Deno.env.get("RESEND_API_KEY");
const ORIGINS = ["https://collex.au", "https://www.collex.au", "http://localhost:3100"];
const esc = (s: string) => s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);
const okLink = (u: string | null) => (u && /^https:\/\/collex\.au\//.test(u) ? u : null);

type Row = { id: number; email: string | null; attempts: number; subject: string; heading: string; body: string; link: string | null; link_label: string | null; why: string; unsub: string | null };

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

function message(m: Row) {
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
}

// status 0 means the request never got an answer (no connection).
async function post(url: string, payload: unknown): Promise<{ ok: boolean; status: number; error: string }> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return { ok: res.ok, status: res.status, error: res.ok ? "" : (await res.text()).slice(0, 500) };
  } catch (e) {
    return { ok: false, status: 0, error: String(e).slice(0, 500) };
  }
}

// A 4xx means Resend will never take this email as it is, except 429 (too many requests) and 401/403, which mean our
// key is wrong or blocked: that is about every email, so they wait for it to be fixed instead of all failing.
const refused = (status: number) => status >= 400 && status < 500 && ![401, 403, 429].includes(status);

const done = (ids: number[]) => sql`update private.mail set sent_at = now(), last_error = null where id in ${sql(ids)}`;
const permanent = (ids: number[], why: string) =>
  sql`update private.mail set failed_at = now(), last_error = ${why} where id in ${sql(ids)}`;
// Left claimed, so it waits 15 minutes before a later run tries again; after the fifth try it is given up on.
const temporary = (rows: Row[], why: string) =>
  sql`update private.mail set last_error = ${why}, failed_at = case when attempts >= 5 then now() end
      where id in ${sql(rows.map((r) => r.id))}`;

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
        update private.mail set claimed_at = now(), attempts = attempts + 1
        where id in (select id from private.mail
                     where sent_at is null and failed_at is null and (claimed_at is null or claimed_at < now() - interval '15 minutes')
                     order by id limit 100 for update skip locked)
        returning id, to_user, attempts, subject, heading, body, link, link_label, why, unsub)
      select c.id, u.email, c.attempts, c.subject, c.heading, c.body, c.link, c.link_label, c.why, c.unsub
      from claimed c left join auth.users u on u.id = c.to_user order by c.id`;
    if (!rows.length) break;
    // Someone with no email address can never be sent anything.
    const noAddress = rows.filter((r) => !r.email);
    if (noAddress.length) await permanent(noAddress.map((r) => r.id), "No email address");
    const ready = rows.filter((r) => r.email);
    if (!ready.length) continue;

    const res = await post("https://api.resend.com/emails/batch", ready.map(message));
    if (res.ok) {
      await done(ready.map((r) => r.id));
      sent += ready.length;
      continue;
    }
    if (!refused(res.status)) {
      // A passing failure: nobody in this batch got theirs. Try again in a later run, and stop for now.
      console.error("Resend failed", res.status, res.error);
      await temporary(ready, `${res.status} ${res.error}`);
      break;
    }
    // Resend refused the whole batch, which one bad email is enough to do. Send them one by one to find it.
    console.error("Resend refused the batch", res.status, res.error);
    for (let i = 0; i < ready.length; i++) {
      const r = ready[i];
      if (i) await new Promise((ok) => setTimeout(ok, 600)); // Resend allows a couple of requests a second.
      const one = await post("https://api.resend.com/emails", message(r));
      if (one.ok) { await done([r.id]); sent++; continue; }
      if (refused(one.status)) { await permanent([r.id], `${one.status} ${one.error}`); continue; }
      console.error("Resend failed", one.status, one.error);
      await temporary([r], `${one.status} ${one.error}`);
      // The ones not tried yet go back untouched, for the next run.
      const rest = ready.slice(i + 1).map((x) => x.id);
      if (rest.length) await sql`update private.mail set claimed_at = null, attempts = attempts - 1 where id in ${sql(rest)}`;
      break;
    }
    // Sending one by one is slow, so a run does it for one batch at most; the next run carries on.
    break;
  }
  // Sent mail, and mail that will never be sent, is kept for a month, then cleared.
  await sql`delete from private.mail where sent_at < now() - interval '30 days' or failed_at < now() - interval '30 days'`;
  return Response.json({ sent }, { headers: cors });
});
