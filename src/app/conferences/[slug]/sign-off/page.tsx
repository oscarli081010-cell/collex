import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDate, formatRange, NA, shown, type Conference } from "@/lib/conferences";
import { getBySlug } from "@/lib/data";
import SignOffPrint from "@/components/SignOffPrint";
import s from "@/components/SignOff.module.css";

type Props = { params: Promise<{ slug: string }> };
export const revalidate = 60;

// A failed read shows the page as missing rather than breaking it.
async function load(slug: string): Promise<Conference | null> {
  try { return await getBySlug(slug); } catch { return null; }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const c = await load((await params).slug);
  if (!c) return { title: "Permission sheet · Collex" };
  return {
    title: `${c.name} permission sheet · Collex`,
    description: `A one-page sheet to print for ${c.name.length > 50 ? "this conference" : c.name}: dates, times, venue, host, fee, contact and a place for a parent to sign.`,
    alternates: { canonical: `/conferences/${c.slug}/sign-off` },
    robots: { index: false },
  };
}

// "13:05" → "1:05 pm", the same as the conference page.
function clock(time: string) {
  const [h, m] = time.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
}

// Outside the sheet, nothing of the site goes on the paper: the top bar, footer and these instructions are hidden.
// Plain CSS here because it reaches outside this page's own elements, which a CSS module can't.
const PRINT = `@media print {
  @page { size: A4 portrait; margin: 16mm 16mm 14mm; }
  html, body { background: #fff !important; }
  body *:not(:has(#signoff-sheet)):not(#signoff-sheet):not(#signoff-sheet *), .t-toast { display: none !important; }
  body *:has(#signoff-sheet) { padding: 0 !important; margin: 0 !important; max-width: none !important; transform: none !important; animation: none !important; }
}`;

export default async function SignOff({ params }: Props) {
  const c = await load((await params).slug);
  if (!c || c.isTemplate) notFound();
  const timed = [...c.schedule].filter((x) => x.time)
    .sort((a, b) => (a.day ?? "").localeCompare(b.day ?? "") || a.time.localeCompare(b.time));
  const days = new Set(timed.flatMap((x) => (x.day ? [x.day] : [])));
  const viaCollex = c.collexApplications || c.collexRegistration;

  return (
    <main id="top" className="container">
      <style>{PRINT}</style>
      <div className={s.tools}>
        <p className={s.toolsNote}>A one-page sheet for a parent or teacher, with this conference&rsquo;s details from its <Link href={`/conferences/${c.slug}`} className="link">Collex page</Link>. Print it, or choose Save as PDF in the print window.</p>
        <SignOffPrint />
      </div>

      <article id="signoff-sheet" className={`panel ${s.sheet}`} aria-labelledby="so-name">
        <header>
          <p className={s.kicker}>Permission and details</p>
          <h1 id="so-name" className={s.name}>{c.name}</h1>
          <p className={s.when}>{formatRange(c)}</p>
        </header>

        <dl className={s.facts}>
          {timed.length > 0 && (
            <>
              <dt>Times</dt>
              <dd>
                <ul className={s.times}>
                  {timed.slice(0, 10).map((x, i) => (
                    <li key={i}><span>{clock(x.time)}</span><span>{days.size > 1 && x.day ? `${formatDate(x.day)}: ` : ""}{x.title}{x.place ? `, ${x.place}` : ""}</span></li>
                  ))}
                </ul>
              </dd>
            </>
          )}
          <dt>Venue</dt><dd>{c.venue === NA ? shown(c.venue) : /sydney|nsw/i.test(c.venue) ? c.venue : `${c.venue}, Sydney, NSW`}</dd>
          <dt>Host</dt><dd>{shown(c.host)}</dd>
          <dt>Level</dt><dd>{c.level ?? shown(null)}</dd>
          <dt>Cost</dt><dd>{c.fee === NA ? "To be announced. Ask the organisers." : c.fee}</dd>
          <dt>Organiser contact</dt><dd>{shown(c.contact)}</dd>
        </dl>

        <section>
          <h2 className={s.h2}>About Collex</h2>
          <p className={s.para}>Collex (collex.au) is a free, independent calendar of Model UN conferences in Sydney. It does not run this conference, and it is not connected to the United Nations or to any school.</p>
        </section>

        <section>
          <h2 className={s.h2}>What the organisers see about students</h2>
          <p className={s.para}>
            {viaCollex
              ? "If a student applies, or a school registers, through Collex, this conference’s organisers see what was entered in that form, such as name, school, year and committee preferences. They never see who follows the conference."
              : "This conference takes registrations through its own form, not through Collex, so its organisers get only what that form asks for."}
            {" "}Details are at collex.au/privacy.
          </p>
        </section>

        <section className={s.consent}>
          <h2 className={s.h2}>Permission</h2>
          <p className={s.para}>I give permission for the student named below to attend {c.name}.</p>
          <div className={s.lines}>
            <div className={s.line}><span>Student&rsquo;s name</span></div>
            <div className={s.line}><span>Year</span></div>
            <div className={`${s.line} ${s.wide}`}><span>Parent or guardian&rsquo;s name</span></div>
            <div className={s.line}><span>Signature</span></div>
            <div className={s.line}><span>Date</span></div>
          </div>
        </section>

        <p className={s.foot}>From collex.au/conferences/{c.slug}. Details can change, so check with the organisers before the day.</p>
      </article>
    </main>
  );
}
