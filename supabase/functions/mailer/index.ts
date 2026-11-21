// Sends whatever is waiting in the outbox (private.mail): answers to applications, allocations, organisers' emails,
// reminders before key dates, listing reviews, claims, role alerts and the weekly digest. Each row is one email to one
// person. Needs the RESEND_API_KEY secret.
// A database job (collex-send, migration 0040) calls this every minute when something is waiting; the site may also
// call it after an organiser does something that queues mail. It takes no input, and nobody can make it send anything
// that isn't already queued, so being called by strangers costs at most a wasted run:
//   * one database connection per run (max: 1), and a cheap check that returns at once when nothing is waiting;
//   * a lease row (private.job_leases): a run that finds another one going does nothing;
//   * if the CRON_SECRET secret is set, only a caller sending it as x-cron-secret is served (the database job sends the
//     vault secret named cron_secret). The site's own calls then stop working, and mail waits up to a minute instead.
// Each email succeeds or fails on its own. One Resend refuses (a bad address, say) is marked failed and never tried
// again; one that fails for a passing reason (Resend down, no connection) is tried again by a later run, at most five
// times in all. "Too many requests" (429, including the daily quota) uses up no tries: the run stops and the rest wait
// for the next run, so a big send is spread over as many runs as it needs. A run that crashes leaves its rows
// claimed; another run takes them after 15 minutes.
// Sent and failed mail is cleared after 90 days by private.forget_old (migration 0039), not here.
import postgres from "npm:postgres@3.4.5";

const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, { prepare: false, max: 1 });
const KEY = Deno.env.get("RESEND_API_KEY");
const SECRET = Deno.env.get("CRON_SECRET");
const ORIGINS = ["https://collex.au", "https://www.collex.au", "http://localhost:3100"];
const esc = (s: string) => s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);
const okLink = (u: string | null) => (u && /^https:\/\/collex\.au\//.test(u) ? u : null);
const okReply = (u: string | null) => (u && u.length <= 254 && /^[^@\s<>",;]+@[^@\s<>",;]+\.[^@\s<>",;]+$/.test(u) ? u : null);
// An unsubscribe page link carries a token; mail apps' one-click POST goes to the API route with the same token.
const oneClick = (u: string) => u.match(/^https:\/\/collex\.au\/unfollow\?t=([0-9a-f-]{36})$/i)?.[1];

type Row = { id: number; email: string | null; attempts: number; subject: string; heading: string; body: string; link: string | null; link_label: string | null; why: string; unsub: string | null; reply_to: string | null };

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
${link ? `<tr><td style="padding:12px 40px 0;"><a href="${esc(link)}" style="display:inline-block;padding:12px 22px;border-radius:10px;background:#213a73;color:#ffffff;text-decoration:none;font-family:${font};font-size:15px;font-weight:600;">${esc(m.link_label ?? "Open Collex")}</a></td></tr>` : ""}
<tr><td style="padding:32px 40px 36px;font-family:${font};font-size:12.5px;line-height:1.6;color:#6f7279;">${esc(m.why)}${unsub ? ` <a href="${esc(unsub)}" style="color:#213a73;">Unsubscribe</a> from these emails.` : ""}</td></tr>
</table>
<p style="margin:20px 0 0;font-family:${font};font-size:12px;color:#6f7279;"><a href="https://collex.au" style="color:#6f7279;">Collex</a> · Sydney NSW, Australia · hello@collex.au</p>
</td></tr></table></body></html>`;
}

function message(m: Row) {
  const unsub = okLink(m.unsub);
  const link = okLink(m.link);
  const reply = okReply(m.reply_to);
  const token = unsub ? oneClick(unsub) : undefined;
  return {
    from: "Collex <hello@collex.au>",
    to: [m.email],
    subject: m.subject,
    html: html(m),
    text: `${m.heading}\n\n${m.body}${link ? `\n\n${link}` : ""}\n\n${m.why}${unsub ? `\nUnsubscribe: ${unsub}` : ""}\nCollex · Sydney NSW, Australia`,
    ...(reply ? { reply_to: reply } : {}),
    ...(token
      ? { headers: { "List-Unsubscribe": `<https://collex.au/api/unfollow?t=${token}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } }
      : unsub ? { headers: { "List-Unsubscribe": `<${unsub}>` } } : {}),
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
// Put rows back as if this run never claimed them: no try used up.
const putBack = (ids: number[]) =>
  ids.length ? sql`update private.mail set claimed_at = null, attempts = greatest(attempts - 1, 0) where id in ${sql(ids)}` : Promise.resolve();

const done = (ids: number[]) => sql`update private.mail set sent_at = now(), last_error = null where id in ${sql(ids)}`;
const permanent = (ids: number[], why: string) =>
  sql`update private.mail set failed_at = now(), last_error = ${why} where id in ${sql(ids)}`;
// Left claimed, so it waits 15 minutes before a later run tries again; after the fifth try it is given up on.
const temporary = (rows: Row[], why: string) =>
  sql`update private.mail set last_error = ${why}, failed_at = case when attempts >= 5 then now() end
      where id in ${sql(rows.map((r) => r.id))}`;
// Our key is wrong or blocked (401/403): not the emails' fault. Left claimed (so it waits 15 minutes, not a minute) and
// no try used up, so nothing is given up on while the key is being fixed.
const held = (rows: Row[], why: string) =>
  sql`update private.mail set last_error = ${why}, attempts = greatest(attempts - 1, 0) where id in ${sql(rows.map((r) => r.id))}`;

Deno.serve(async (req) => {
  const origin = req.headers.get("origin") ?? "";
  const cors = {
    "Access-Control-Allow-Origin": ORIGINS.includes(origin) ? origin : ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
    "Vary": "Origin",
  };
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (SECRET && req.headers.get("x-cron-secret") !== SECRET) return Response.json({ error: "Not allowed" }, { status: 401, headers: cors });
  if (!KEY) return Response.json({ error: "RESEND_API_KEY is not set" }, { status: 503, headers: cors });

  // Nothing waiting: stop before doing anything else.
  const [{ due }] = await sql`
    select exists (select 1 from private.mail where sent_at is null and failed_at is null
                   and (claimed_at is null or claimed_at < now() - interval '15 minutes')) as due`;
  if (!due) return Response.json({ sent: 0 }, { headers: cors });
  const [lease] = await sql`update private.job_leases set until = now() + interval '2 minutes' where name = 'mailer' and until < now() returning 1`;
  if (!lease) return Response.json({ sent: 0, busy: true }, { headers: cors });

  let sent = 0;
  try {
    // Up to 500 emails a run, a hundred at a time (Resend's batch size).
    for (let round = 0; round < 5; round++) {
      if (round) await new Promise((ok) => setTimeout(ok, 600)); // Resend allows a couple of requests a second.
      const rows = await sql<Row[]>`
        with claimed as (
          update private.mail set claimed_at = now(), attempts = attempts + 1
          where id in (select id from private.mail
                       where sent_at is null and failed_at is null and (claimed_at is null or claimed_at < now() - interval '15 minutes')
                       order by id limit 100 for update skip locked)
          returning id, to_user, attempts, subject, heading, body, link, link_label, why, unsub, reply_to)
        select c.id, u.email, c.attempts, c.subject, c.heading, c.body, c.link, c.link_label, c.why, c.unsub, c.reply_to
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
      if (res.status === 429) {
        // Too many for now (per second or the day's quota). Nothing was sent; the next run carries on.
        console.error("Resend is limiting us", res.error);
        await putBack(ready.map((r) => r.id));
        break;
      }
      if (!refused(res.status)) {
        // A passing failure: nobody in this batch got theirs. Try again in a later run, and stop for now.
        console.error("Resend failed", res.status, res.error);
        await (res.status === 401 || res.status === 403 ? held : temporary)(ready, `${res.status} ${res.error}`);
        break;
      }
      // Resend refused the whole batch, which one bad email is enough to do. Send them one by one to find it.
      console.error("Resend refused the batch", res.status, res.error);
      for (let i = 0; i < ready.length; i++) {
        const r = ready[i];
        if (i) await new Promise((ok) => setTimeout(ok, 600));
        const one = await post("https://api.resend.com/emails", message(r));
        if (one.ok) { await done([r.id]); sent++; continue; }
        if (refused(one.status)) { await permanent([r.id], `${one.status} ${one.error}`); continue; }
        // The ones not sent yet go back untouched, for the next run; a 429 doesn't cost this one a try either.
        const rest = ready.slice(i + 1).map((x) => x.id);
        if (one.status === 429) await putBack([r.id, ...rest]);
        else {
          console.error("Resend failed", one.status, one.error);
          await temporary([r], `${one.status} ${one.error}`);
          await putBack(rest);
        }
        break;
      }
      // Sending one by one is slow, so a run does it for one batch at most; the next run carries on.
      break;
    }
  } finally {
    await sql`update private.job_leases set until = now() where name = 'mailer'`;
  }
  return Response.json({ sent }, { headers: cors });
});
