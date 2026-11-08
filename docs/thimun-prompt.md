# Prompt: add a THIMUN procedure to Chambers

Paste everything below the line into a new session in /Users/oscar/collex.

---

You are adding a second procedure, **THIMUN** (The Hague International Model United Nations), to Collex Chambers, beside the existing **Evatt** procedure. Do not change how Evatt behaves. Old saved Evatt states must keep loading.

## Read first
- `src/lib/chamber.ts`: the whole engine. One versioned state doc (`v:1`, `rules:"evatt"`, `rev:2`). Pure functions `(c, ...) => c`, replay-safe (guard step/phase/speaker, ids made by the caller). `normalise()` upgrades older states. `rooms(c)` drives the display status pill. Timed Points of Information (`POI_SECS` 30 to ask, 30 to reply), caucus timer, ballots, `passes()`, `shortName()` for long country names.
- `src/components/Chambers.tsx` (console), `ChamberDisplay.tsx` (projector display, `Screen` helper with pill, heading, lines, children, `foot`), `Chambers.module.css`.
- `src/components/Select.tsx`: use it for every dropdown. Never a native `<select>`.
- Storage: localStorage `collex:chamber`, or Supabase table `chambers` once shared (`useChamber`). No migration should be needed; the doc is JSON.
- Engine tests live in the session scratchpad as `engine.test.mts`; recreate them in the repo (e.g. `src/lib/chamber.test.mts`) and run them with `npx tsx`.

## Conventions the owner insists on
- Everything on the display is consistent and universal: signatories/foot at the bottom, content centred, status pill level with the Full screen and Console buttons and the same height.
- Minimal text. "Present & Voting" on one line. Long country names abbreviated (USA, DRC, etc.).
- Every override or "record the opposite" style control splits into explicit For / Against buttons.
- Test at 1440x810, 800 wide, 375 mobile, light and dark. Commit by path. Ask before deploying.

## What THIMUN is
Sources: BMUN THIMUN Procedure Guide (Suma Thati), Gavelling's THIMUN overview, THIMUN Security Council guide. THIMUN is resolution-centred. Debate starts from finished resolutions written beforehand; it is not a speakers' list with caucuses. The goal of debate is to improve the resolution through amendments and then pass it.

Not covered by the sources: default speaking and debate times, and whether the main submitter gets a closing speech. Make both chair-set settings. Do not invent defaults without telling the owner.

### Phases
1. **Setup.** Committee name, topic(s) (usually two or more), delegates. **Quorum** is at least one third of the committee present; debate cannot open below it.
2. **Roll call.** "Present" or "Present and Voting". It repeats whenever the committee returns from a break or lunch, and before each morning session. Only UN member states vote; non-members and organisations do not (this is the existing Present & Voting split).
3. **Lobbying.** One timed block, once only. Like an unmoderated caucus: no speaking, no moderation. Delegates form groups and write whole resolutions. The chair records each resolution: title, topic, **main submitter** (the head sponsor who presents it), co-submitters, time submitted. The chair sets a minimum number of co-submitters; a resolution below it cannot reach the floor. The aim is at least four resolutions, two per topic (a warning, not a block).
4. **Approval panel.** Each resolution is Approved or Sent back (with a reason), and a sent-back one can be resubmitted. Only approved resolutions go on the agenda. Panel checks format, clause construction and whether it is within the committee's mandate. The chair orders the agenda.
5. **Debate on each resolution, one at a time:**
   1. Chair calls for decorum and states the resolution and its main submitter.
   2. Main submitter reads the operative clauses.
   3. Chair sets the debate time for the resolution (e.g. 10 minutes for and 10 against; chair-set).
   4. Main submitter gives an opening speech.
   5. Chair asks whether the main submitter is open to Points of Information, then takes them (one question at a time; short introduction allowed; follow-ups at the chair's discretion; must be phrased as a question).
   6. Main submitter yields: to another delegate (from a different delegation, only once in a row, with that delegate's permission, at the chair's discretion; the same speech + POI pattern follows) or to the chair.
   7. Yielded to the chair, the floor opens. Delegates raise placards; the chair recognises them one at a time and balances for and against. No fixed speakers' list.
   8. Amendments can be handed in at any time on paper. When the chair recognises a delegate who has submitted one, debate moves to the amendment.
   9. When time elapses, or a motion to move directly into voting passes, the committee votes on the resolution as amended: for, against, abstain (members only). Passes on a simple majority of for against against.
   10. Short break, then the next resolution.
6. **End.** Each resolution is Passed, Failed, Tabled or Withdrawn. Tabled resolutions return after all others; reconsideration is the last step.

### Amendments
- Written, to the chair, as **Modify**, **Strike** or **Add** on a numbered operative clause. Preambulatory clauses are generally not amendable.
- Debated in order of submission, but the chair may put constructive ones (modify/add) ahead of strikes.
- **First degree** (a change to the resolution): chair sets a debate time (e.g. 20 min). Only that amendment is debated, not the resolution. Submitter speaks, takes POIs, then the chair opens for and against speakers. At the end the house votes (for/against/abstain). Passed: written into the resolution. Failed: nothing changes.
- **Second degree** (a change to an amendment currently on the floor): debated the same way, first. Passes: the original amendment is changed and **automatically passes**. Fails: no change, and the house returns to the original amendment. Needs an amendment **stack**.

### Points (questions; raised by placard; at the chair's discretion; none may interrupt a speaker except Personal Privilege about audibility)
- **Information to the speaker**: only once the chair asks for POIs.
- **Information to the chair**: any time, about anything not covered elsewhere.
- **Order**: the chair erred on procedure; refers to what just happened.
- **Parliamentary Enquiry**: a question to the chair about the rules.
- **Personal Privilege**: personal needs; interrupts only for audibility.
Log these as quick chair buttons with a tally in Analytics. No outcome needed.

### Motions (raised when no one is speaking; most need a "second", and an objection usually kills it; always at the chair's discretion)
| Motion | Needs | Effect |
|---|---|---|
| Move directly into voting | second | closes debate |
| Extend debate time | second | more time |
| Unmoderated caucus (N min) | second | pauses debate |
| Table a resolution | 30 s speech, two for and two against (unless unanimous), simple majority | goes to the back of the agenda |
| Reconsider | only after all resolutions are done; two-thirds | re-debate and re-vote |
| Withdraw | main submitter and all sponsors agree | removed from the agenda |
| Divide the house | after a vote where abstentions beat both for and against; no objections | re-vote, abstentions not allowed |
| Appeal the chair | 30 s speech; two-thirds; chair powerless | overrules the chair's most recent decision |

Procedural votes (debate time, closing debate): no abstentions. Substantive votes (amendments, resolutions): abstentions allowed.

### Security Council variant
The Security Council uses THIMUN SC / Historical SC guidelines: a more involved approval process, and the veto. Ask the owner whether to build it; if so, fetch the official guide (https://foundation.thimun.org/wp-content/uploads/2024/09/Working-Version-of-THIMUN-SC-Guide.pdf) first.

### Language and conduct
Third person only ("the delegate of the UK"). Note-passing allowed, none during voting. Funding is treated as unlimited; discuss sources, not amounts.

## Design
- Add `rules: "thimun"` to the state. A `Resolution` type (id, title, topic, main, subs, status, text/clauses, submittedAt, result). An `agenda` order, a `current` resolution, an `amendStack`, a `tabled` list, a `points` tally, a `motions` log. Extend `Step` for `lobby`, `approval`, `resolutionIntro`, `speech`, `floor`, `amend`, `vote`, `break`. Reuse the speech phases (speech/after/ask/answer) and the timer.
- Reuse: roll call, timers, POI timing, ballots, `passes`, `shortName`, analytics table, display `Screen`, `Select`, background photo.
- Procedure picker at setup (Evatt / THIMUN). A THIMUN state never opens in Evatt screens and vice versa; `normalise()` must keep old states valid.
- Display screens, all in the same layout: lobbying countdown with resolutions so far; approval list with statuses; resolution intro (title, main submitter, co-submitters in the foot); speech and POI; caucus; amendment (text as heading, signatories at the foot); vote with live tally; result Passed/Failed with count.
- Analytics: the existing table plus per-resolution and per-delegate views, and counts of points and motions.

## Build order
1. State + engine (pure, replay-safe) with tests: lobbying, approval, agenda, resolution flow, second-degree amendment stack, tabling/withdrawing/reconsidering, divide the house, appeal.
2. Console: setup, lobbying, approval, resolution flow, motions bar.
3. Display screens.
4. Analytics and Settings.
5. Visual checks at all sizes and themes; commit by path; ask before deploying.

## Open questions to ask the owner before coding
1. Security Council variant with the veto, or General Assembly style only?
2. A main submitter's closing speech?
3. Default times held by the system, or set by the chair each time?
