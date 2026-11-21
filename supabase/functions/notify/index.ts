// Sends the queued "follow" emails: when a live conference gains application links or background guides,
// everyone following it gets one short email with a one-click unsubscribe link.
// Needs the RESEND_API_KEY secret (Supabase → Edge Functions → Secrets). Safe to call repeatedly:
// each queued item is claimed once, so nobody gets the same email twice.
// A database job (collex-send, migration 0040) calls it every minute when something is due. A notice for links that
// were changed after the listing was approved waits until an admin resolves the automatic report about it, or until 24 hours
// after that notice was queued (migration 0039). One connection per run, a lease so two runs never overlap, and if the CRON_SECRET secret is
// set, only callers sending it as x-cron-secret are served. A notice is tried at most five times.
import postgres from "npm:postgres@3.4.5";

const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, { prepare: false, max: 1 });
const SECRET = Deno.env.get("CRON_SECRET");
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
<tr><td style="padding:24px 40px 0;"><a href="${esc(page)}" style="display:inline-block;padding:12px 22px;border-radius:10px;background:#213a73;color:#ffffff;text-decoration:none;font-family:${font};font-size:15px;font-weight:600;">Open the conference</a></td></tr>
<tr><td style="padding:32px 40px 36px;font-family:${font};font-size:12.5px;line-height:1.6;color:#6f7279;">You're getting this because you followed ${esc(name)} on Collex. <a href="${esc(unsub)}" style="color:#213a73;">Unsubscribe</a> from emails about it.</td></tr>
</table>
<p style="margin:20px 0 0;font-family:${font};font-size:12px;color:#6f7279;"><a href="https://collex.au" style="color:#6f7279;">Collex</a> · Sydney NSW, Australia · hello@collex.au</p>
</td></tr></table></body></html>`;
}

// A notice is due when nothing holds it: no report (or it was deleted), its report was resolved, or the notice itself is 24 hours old.
const due = () => sql`
  sent_at is null and attempts < 5
  and (report_id is null or created_at < now() - interval '24 hours'
       or exists (select 1 from public.reports r where r.id = report_id and r.status = 'resolved'))`;

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

  const [{ waiting }] = await sql`select exists (select 1 from private.notifications where ${due()}) as waiting`;
  if (!waiting) return Response.json({ jobs: 0, sent: 0 }, { headers: cors });
  const [lease] = await sql`update private.job_leases set until = now() + interval '2 minutes' where name = 'notify' and until < now() returning 1`;
  if (!lease) return Response.json({ jobs: 0, sent: 0, busy: true }, { headers: cors });

  let sent = 0, count = 0;
  try {
    const jobs = await sql`
      update private.notifications set sent_at = now(), attempts = attempts + 1
      where id in (select id from private.notifications where ${due()} order by id limit 20 for update skip locked)
      returning id, conference_id, kind`;
    count = jobs.length;
    for (const job of jobs) {
      // Still live, and the link the notice is about is still there (an admin may have taken it out).
      const [c] = await sql`
        select name, slug from public.conferences where id = ${job.conference_id} and status = 'published'
          and (${job.kind}::text <> 'delegation' or delegation_url is not null) and (${job.kind}::text <> 'chair' or chair_url is not null)`;
      if (!c) continue;
      const people = await sql`
        select u.email, f.token from public.follows f join auth.users u on u.id = f.user_id
        where f.conference_id = ${job.conference_id} and u.email is not null`;
      const page = `https://collex.au/conferences/${c.slug}`;
      let failed = false, jobSent = 0, limited = false;
      for (let i = 0; i < people.length; i += 100) {
        if (i) await new Promise((ok) => setTimeout(ok, 600));
        const batch = people.slice(i, i + 100).map((p) => {
          const unsub = `https://collex.au/unfollow?t=${p.token}`;
          return {
            from: "Collex <hello@collex.au>",
            to: [p.email],
            subject: SUBJECT[job.kind](c.name),
            html: html(c.name, job.kind, page, unsub),
            text: `${c.name}\n\n${BODY[job.kind]}\n${page}\n\nUnsubscribe from emails about this conference: ${unsub}\nCollex · Sydney NSW, Australia`,
            headers: {
              "List-Unsubscribe": `<https://collex.au/api/unfollow?t=${p.token}>`,
              "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
            },
          };
        });
        const res = await fetch("https://api.resend.com/emails/batch", {
          method: "POST",
          headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify(batch),
        }).catch(() => null);
        if (res?.ok) { sent += batch.length; jobSent += batch.length; }
        else {
          failed = true;
          limited = res?.status === 429;
          console.error("Resend failed", res?.status, res ? await res.text() : "no connection");
          break;
        }
      }
      // Put the job back in the queue if nobody got it, so a later run tries again. Too many requests uses up no try.
      if (failed && !jobSent) {
        await sql`update private.notifications set sent_at = null, attempts = attempts - ${limited ? 1 : 0} where id = ${job.id}`;
      }
      if (limited) {
        // The notices after this one were claimed but never tried: back in the queue, without using up a try.
        const rest = jobs.slice(jobs.indexOf(job) + 1).map((j) => j.id);
        if (rest.length) await sql`update private.notifications set sent_at = null, attempts = attempts - 1 where id in ${sql(rest)}`;
        break;
      }
    }
  } finally {
    await sql`update private.job_leases set until = now() where name = 'notify'`;
  }
  return Response.json({ jobs: count, sent }, { headers: cors });
});
