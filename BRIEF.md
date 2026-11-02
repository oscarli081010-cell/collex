# Collex: build brief (v1: calendar and conference pages)

## What it is
Collex (collex.au) is the shared home of the Sydney Model United Nations circuit: one calendar of
every conference, and one standard page per conference. Later: chair applications, delegation
registration, committees, background guides and resolutions, run through the site and its emails.

## This build
The structure only. No real conferences are listed yet; every field shows "N/A" or an honest empty state.

Pages:
- `/`: what Collex is, the season at a glance, a date-clash checker, how listing works, a call to list.
- `/calendar`: the season by month, with an agenda list and an empty state.
- `/conferences`: the directory, with filters (month, level, format) and an empty state.
- `/conferences/template`: the standard conference page every listing gets, with all fields set to N/A.
  Sections: overview, key dates, committees, background guides, secretariat, fees, venue, applications.
- `/list`: "List your conference". The form opens an email for now, since there is no backend yet.

Data lives in one typed file (`src/lib/conferences.ts`), so Supabase can replace it later without
touching the pages.

## Audience
High-school delegates, chairs, MUN teachers and secretariats across Sydney. They know Google Forms,
Docs and Instagram, so the site must be faster to read than any of those.

## Design
- Direction: "Type and nothing else" (from the taste skill, seed 1477085436). Black ground, off-white ink,
  one deep crimson accent. Cabinet Grotesk only.
- Idea: the delegate's placard (a name, raised to speak) becomes the page's giant cropped wordmark,
  and the season's calendar is set like a poster: giant months on the left, small facts on the right.
- Live thing: the date-clash checker. Pick a date and see what else is on that weekend.
- Motion: GSAP and Lenis smooth scroll. The wordmark scales with the scroll, sections rise in with a
  stagger, and every control gives feedback. Everything respects reduced motion.
- Rules: no gradients, glass, shadows at rest, eyebrow labels, emoji, icon-card grids or monospace.
  Headlines stay at two lines or fewer. The pages work on a phone.

## Stack
Next.js (App Router) and TypeScript, GSAP and Lenis, deployed on Vercel. Supabase comes later.
