# Prompt: add the Trinity Grammar MUN procedure to Chambers

Paste everything below the line into a new session in /Users/oscar/collex.

---

You are adding a third procedure, **Trinity Grammar MUN**, to Collex Chambers, beside **Evatt** (built) and **THIMUN** (planned in `docs/thimun-prompt.md`, paused; do not build it here). Trinity Grammar MUN 2026 will be the **first conference ever to use Collex as its main committee tool**, so it must be flawless: no mistakes, no half-states, everything consistent. Do not change how Evatt behaves, and old saved Evatt states must keep loading.

The source is the Trinity MUN delegate handbook, Rules of Procedure, handbook pages 9 to 15 (file: `~/Downloads/Trinity MUN 2025 Delegates Handbook (1).pdf`; text extract at the scratchpad `tg.txt`). It is the **2025** handbook; the conference is **2026**. Re-read those pages yourself before coding, and tell the owner anything that looks like it may have changed for 2026 (dates, the 25% rule, times).

## Read first
- `src/lib/chamber.ts`: the whole engine. One versioned state doc (`v:1`, `rules:"evatt"`, `rev:2`). Pure functions `(c, ...) => c`, replay-safe (guard step/phase/speaker; ids made by the caller). `normalise()` upgrades older states. `rooms(c)` drives the display status pill. The speakers' list (`debate.list` / `debate.run`, slots with a for/against side), speech phases (speech, after, ask, answer), timed POIs, the caucus timer (`callCaucus`, `endCaucus`, `CAUCUS_SECS`), ballots, `passes()`, `shortName()` for long country names, `Ruling` For/Against overrule.
- `src/components/Chambers.tsx` (console), `ChamberDisplay.tsx` (projector display built on the `Screen` helper: pill, heading, lines, children, `foot`), `Chambers.module.css`.
- `src/components/Select.tsx`: Collex's own dropdown. Use it for every dropdown. Never a native `<select>`.
- Storage: localStorage `collex:chamber`, or Supabase table `chambers` once shared (`useChamber`). The doc is JSON, so no migration should be needed.
- Engine tests live in the session scratchpad as `engine.test.mts`; recreate them in the repo (e.g. `src/lib/chamber.test.mts`) and run with `npx tsx`.

## The owner's rules (non-negotiable)
1. **Same where it is the same.** Where Trinity does something Evatt already does (the general speakers' list, speeches, yielding/POIs, roll call, caucus timer, amendments, voting, analytics, display screens), reuse the **exact same management and exact same look**, in both the console and the display. Do not build a lookalike; call the same code and the same components. The speakers' list must be one shared implementation.
2. **New things copy the old style.** For anything new, use the closest existing thing as the reference for layout, spacing, buttons, wording and display: e.g. the **moderated caucus** and **unmoderated caucus** must look and behave like the current caucus (timer card, same buttons, same display screen style); working papers and the committee-type picker follow the existing setup and Pick styles.
3. **Display consistency.** Signatories/foot at the bottom, content centred, status pill level with the Full screen and Console buttons and the same height. Minimal text. "Present & Voting" on one line. Long country names abbreviated (`shortName`; the Security Council's P5 appear as China, Russia, USA, UK, France).
4. Every override or "record the opposite" control splits into explicit For / Against buttons (already how Overrule works; keep it).
5. Test at 1440x810, 800 wide, 375 mobile, light and dark. Commit by path. Ask before deploying.

## The procedure picker and the committee picker
- Setup: Procedure becomes Evatt / **Trinity Grammar MUN**.
- After choosing Trinity Grammar MUN, show a second choice: **Beginner committee** (General Assembly) or **Experienced committee** (Security Council). Store it in the state (e.g. `rules:"trinity"`, `level:"beginner"|"experienced"`). Show it in the console header and on the display top-left pill, and let the chair see which rules apply.
- Experienced = Security Council: two-thirds majority and the P5 veto. Beginner = General Assemblies: simple majority.

## Rules shared by both committees

### Attendance and roll call
- Roll call is alphabetical. Delegates answer **"Present"** or **"Present and Voting"** (existing roll call, existing labels).
- "Present" may **abstain** on the final draft resolution vote. "Present and Voting" **must** vote For or Against and **cannot abstain**. Enforce this in the final roll-call vote UI: hide or disable Abstain for Present & Voting delegates.
- Delegates stay in the room after roll call until a break or adjournment.

### Opening statements
- Every country gives an opening statement of **at most 2 minutes**, stating its policy position and the outcomes it wants in the draft resolution. Alphabetical order, same speech timer as now.

### General speakers' list (the default medium of debate)
- Delegates raise a hand, or pass a note to the chair at any time, to join. The note must make clear **FOR or AGAINST**.
- **A delegate cannot be on the list twice at the same time**, but can be added again after speaking. Enforce in the engine.
- This is the **same speakers' list as Evatt** (for/against slots, same console list, same display).
- Yielding at the end of a speech (reuse the existing yield controls, add the missing one):
  - **Yield to the Chair**: no questions.
  - **Yield to another country**: that country is fast-tracked as the next speaker and **the remaining time is added to that country's time**. (New.)
  - **Yield to questions**: the chair takes questions; **speaking time counts while the speaker is responding**. Reuse the existing POI ask/answer phases. The chair sets how many POIs (recommended two). Use the standard existing **30 seconds to ask and 30 seconds to reply** (the owner confirmed; the handbook gives no per-question time).
- Speeches are in the third person ("the representative of", "honourable delegate for"); chairs are "Chair", "President" or "Honourable Chair". No tool work needed beyond a reminder line in the console.

### Motions (procedural and substantive)
Delegates propose motions when the chair calls for speakers, points or motions. The console needs a **motions bar** the chair uses to log and run them:
- **Open / Resume / Suspend / Close debate**: open the session, resume, suspend until the next session, close debate on a resolution and move to a vote.
- **Introduce draft resolution**: must already be submitted and approved by the chairs; opens the **draft resolution speakers' list**.
- **Introduce amendment**: only during the draft resolution speakers' list; starts the amendment process.
- **Moderated caucus**: topic, total duration (**maximum 20 minutes**), speaking time per delegate. Speaking time must be **less than** the total and **divide it evenly** (10 min duration with 1 min speaking is fine; 10 and 10 is not). Validate this in the form and explain the error in one short line.
- **Close moderated caucus**: only after the most recent **three** speakers have finished.
- **Extend moderated caucus**: only right after the duration ends; the extension cannot be longer than the original duration; **at most two in a row**.
- **Unmoderated caucus**: duration only, **maximum 20 minutes**. It is **voted on before it starts**. Chairs should not accept unmoderated caucuses that take up the majority of the session unless delegates are working on committee documents (show a gentle warning, not a block).
- **Extend unmoderated caucus**: at most two successive extensions, each no longer than the original duration.
- **Collex does not rank motions by disruptiveness** (the handbook's "MUNCommand" does that; the owner does not want it). Instead, raised motions sit in a **queue the chair controls, exactly like the amendments list**: up/down buttons to move one first or last, hide/remove, a **Next** highlight, and one **"Oldest first"** button that sorts by time raised (the same control as the amendments' sort row). The chair puts the motion at the top to the vote. A motion needs a **simple majority** to pass. Voting on motions is by placard (a tally, same as the existing amendment tally controls).

### Caucuses (reference: the current caucus)
- **Unmoderated caucus** = the existing caucus: same timer card, same display, same controls, with the duration set from the motion.
- **Moderated caucus** = new, in the same style: a timer card plus the speakers' list for that caucus, showing topic, duration left, speaking time per delegate. The chair calls delegates who raise hands; each gets the per-delegate time; the caucus ends when the clock runs out or via the close/extend motions above. Display: the existing caucus screen, with the topic as heading and the current speaker.
- Moderated caucus speeches are recorded in Analytics like other speeches.

### Points (quick chair buttons, tallied in Analytics, no outcome)
- **Order**: any time outside delegate speeches; the chair broke the rules.
- **Personal Privilege**: discomfort impairing participation (audibility, air-conditioning).
- **Procedural Inquiry**: any question about the ROP or procedure.
- **Clarification**: a question to the chair during **reading time** of a document about phrases or terms.
- Points are raised when the chair calls for speakers, points or motions.

### Right of Reply
A delegate who feels their national integrity was grievously insulted stands during the speech until acknowledged, then has **20 seconds** for a statement (no questions). The accused responds with an **apology, a withdrawal, or a refusal**. Nothing else; no reply to a reply. Console: a Right of Reply button that runs a 20-second timer, then three outcome buttons (Apologised / Withdrew / Refused). Log it.

### Notes and sanctions
- **Note passing happens on paper at the conference.** Collex does not do notes: no notes feature, no log.
- **Honorary observer** (build it; the owner confirmed): a **5-minute sanction** the chair can place on a delegate who keeps breaking the rules. While it runs they may **only write notes and join unmoderated caucuses**. Implement as a per-delegate timed flag (`observers: { [delegateId]: endsAt }`, using the same skewed `now()` clock and a visible countdown):
  - chair button on each delegate in the roll/speakers' list ("Honorary observer, 5 min") with a For/Against-free, plain Start / End early control;
  - while active, the delegate is shown with a small "Observer" tag and a countdown, **cannot be added to or called from any speakers' list, cannot be picked as proposer, seconder or opposer, cannot sign amendments or documents, and does not vote** in placard votes (tally as no vote); they stay free in unmoderated caucuses;
  - it expires by itself; the chair can end it early; it appears in the log and Analytics (count per delegate);
  - the display shows nothing extra except the tag next to the name on roll-call/vote tiles (no pill, no screen of its own);
  - engine: pure and replay-safe like the rest, with tests (blocked from list, blocked from signing, expires, early end, survives reload).

### Documents
- **Working papers**: informal, no formatting; need **1 sponsor and at least 1 co-sponsor**.
- **Draft resolutions**: formal; **no limit** on how many a delegate submits; need **1 proposer and 1 seconder (at most one each)** and **co-sponsors totalling at least 25% of present member states, with the proposer and seconder counted in the 25%**; they must be **substantially different from each other** to be approved for distribution. Resolutions follow the handbook's Appendix A structure (mover, seconder, signatories; preambulatory clauses; numbered operative clauses; semicolons then one final full stop). Compute the 25% threshold from the roll call (present members, round up) and show it in the console as "x of y signatories needed".
- Chairs approve or send back each draft before it can be introduced. Approved drafts are listed in the console; the chair introduces one at a time.

### Amendments (reuse the existing amendment system and screens)
- Strike a clause, amend a clause, or add a clause.
- **Consistency rule**: an amended clause must be consistent in nature with the original and may not change its fundamental intent; an added clause must be consistent with the resolution as a whole. (Chair's judgement; show the rule as a one-line note in the form.)
- The process: **motion to introduce the amendment**, which passes by simple majority; then delegates vote to **debate it in a 10-minute moderated caucus** (a moderated caucus with that fixed duration; the chair sets speaking time per delegate); then the amendment is voted on.
- **A clause that has already been amended cannot be amended again unless there is full consensus** (no votes against, no abstentions or dissents). Enforce in the engine with a "consensus" confirmation step.
- Signatories for an amendment: 1 proposer and 1 seconder, plus at least 25% of present delegates as co-sponsors.
- The chair considers amendments by **number of signatures and quality** (the existing "sort by signatories" control already does the first).
- Keep the existing Amendments boxes (add form left, list right), the For/Against overrule, and the display amendment screens.

### Resolution debating (both committees; the order matters)
1. **Introduction.**
   - **Experienced**: the proposer gives a **2-minute** speech in favour; the co-proposer (seconder) gives another **2-minute** speech.
   - **Beginner**: the chair calls a proposer and a co-sponsor, who each give a **90-second** speech.
   - At this point note passing and the draft resolution speakers' list **open**.
   - The chair selects a delegate from the **opposer's speaking list** to speak **2 minutes against**.
2. **Debate.**
   - An **unmoderated caucus of 5 minutes** for positions and amendments.
   - The chair opens amendment submissions.
   - From then on, at the chair's discretion, a **mix of amendment discussions, speakers' list and unmoderated caucuses**.
3. **Closing and voting: the same for both committees** (confirmed by the Trinity MUN manager: the second sequence applies to all committees):
   - A final **4-minute unmoderated caucus**.
   - One **opposing speaker, 2 minutes** against.
   - The **co-proposer, then the proposer**, in that order, **2 minutes each** in favour.
   - The **final vote**.
   - The handbook's "two speakers for, two against, then general debate until a final-vote motion" sequence is **not used**. Do not build it or a setting for it. The closing sequence starts **two ways** (confirmed by the organiser): (a) when a **motion to close debate passes** (the motions queue's normal route), or (b) **at the chair's discretion**, with a plain "Begin closing sequence" button on the console that skips the motion. Both lead to the same sequence and are logged differently ("Debate closed by motion" / "Closing started by the chair").
- The final vote is a **roll call** (alphabetical): For, Against, or Neutral (abstain), subject to the Present vs Present & Voting rule above. All other votes are by raised placard. **Forgetting to vote, being unavailable or not voting counts as an abstention.** Most votes need a simple majority.
- One draft resolution is formally adopted per committee at the end.

## What differs between the two committees

### Beginner committee (General Assembly)
- **Four draft resolutions in total, two per week.**
  - **Week 1: two seen resolutions.** Released 7 days before the conference, with a brief research sheet per delegate from the chair.
  - **Week 2: one seen and one unseen.** The seen resolution and the topic area of the unseen one are released 5 days before, with a guide of questions and topics to research. For the **unseen** resolution, delegates get a **20-minute preparation** period on the day (speeches, amendments, research with sources provided on the day).
- Each resolution runs the "Resolution debating" flow above, with the 90-second introduction speeches.
- **Passes on a simple majority.**
- Build it as: committee has a list of resolutions (each marked seen/unseen, week 1/2), a "Prepare (20 min)" step for unseen ones that uses the existing timer, then the standard flow per resolution.

### Experienced committee (Security Council)
- **Week 1**
  1. **Opening statements** from every country (2 minutes), each asked to **yield to questions**. The chair decides how many POIs (recommended **two**), in line with time.
  2. **Moderated caucuses**: countries propose sub-topics. The chair enters them and the **most disruptive motion is voted on first**; simple majority to pass. After **three** moderated caucuses (chair's discretion) the chair allows motions for **unmoderated caucuses**.
  3. **Working papers**: drafting starts when **30 minutes are left** in the conference, or when the chair feels the committee should move on. Delegates talk freely and may use technology. Working papers are **due by the stated date** (2025: Sunday 21 September; make the due date a chair-set field).
  4. The **chairs** go through the working papers and **either select the best or combine ideas into one draft resolution** for week 2. When combined, **the delegate with the most input is the proposer and the others are co-sponsors** (chair picks; console lets the chair set proposer, seconder and co-sponsors).
- **Week 2**: the same process as the beginner committee for amendments and voting (the "Resolution debating" flow with 2-minute introduction speeches).
- **Security Council voting**: a **two-thirds majority in favour** is needed, **and a vote Against by China, Russia, the United States of America, the United Kingdom or France is a veto** and the resolution fails. Show the P5 veto on the vote and result screens (who vetoed), and name the P5 by their short names so the check is reliable (match on `shortName`, tolerate "Russian Federation", "People's Republic of China", "United States", "United Kingdom", "French Republic"). Needed-votes text on the display: "2/3 needed, no P5 veto".

## Design
- State: `rules:"trinity"`, `level`, a `Document` list (working papers and draft resolutions: id, kind, title, proposer, seconder, co-sponsors, week, seen/unseen, status Submitted/Approved/Sent back, text), the current resolution, a `motions` queue (chair-ordered, with an oldest-first sort) and log, a `caucus` object with kind moderated/unmoderated, topic, total, per-speaker time, extensions used, a per-caucus speaker queue, `points` tally, `replies` log, and per-delegate "on speakers' list" uniqueness. Reuse `Speech`, `Debate`, `Timer`, `Poll`, `Result`, `Stat`. Add stat kinds for the new events. `normalise()` must keep Evatt states valid and must reject nothing.
- Steps (extend `Step`): welcome, roll, opening statements, general speakers' list / floor, caucus (moderated, unmoderated), documents (working papers, drafts, approval), prepare (unseen), resolution introduction, resolution debate (speakers' list, amendments, unmoderated), closing speeches, final vote (roll call), result.
- `rooms(c)` / the status pill: show the current room (General speakers' list, Moderated caucus, Unmoderated caucus, Amendments, Draft resolution speakers' list), the same pill and position as now.
- Display screens, all on the existing `Screen` layout: opening statements; speakers' list; moderated caucus (topic heading, speaker, clock); unmoderated caucus (clock); documents list with statuses; resolution introduction (title, proposer, seconder, co-sponsors in the foot); amendment screens as now; roll-call vote with live For/Against/Neutral tally; result Passed/Failed with the count, plus veto note on the Security Council; Right of Reply timer.
- Analytics: existing table, plus caucus speeches, points, motions and replies.
- Settings: same display background and Share.
- Add a Week 1 | Week 2 switch at the top of the console (see Sessions).

## Build order
1. Read the handbook pages and the Evatt engine; write the state types and `normalise()`. Engine functions, pure and replay-safe, with tests for: speakers' list uniqueness, yield to another country adds time, mod caucus validation (20 max, even division, less than total), extension limits (max two, no longer than original), close-mod after three speakers, unmod voted first and extended twice at most, 25% signatory maths, already-amended clause needs consensus, Present vs Present & Voting in the final roll call, abstention for non-voters, GA simple majority, SC two-thirds plus P5 veto.
2. Console: procedure and committee pickers, documents (working papers, drafts, approval), motions bar, caucuses, the resolution flow, final roll call.
3. Display screens.
4. Analytics, Settings.
5. Visual checks at all sizes and themes. Run the full engine tests. Commit by path. **Do not deploy until the owner says "Deploy".**

## Decisions already made by the owner (do not ask again)
1. Nothing changed between the 2025 and 2026 rules.
2. Closing and voting use the 4-minute unmod, opposing speaker, co-proposer, proposer sequence for **both** committees (confirmed by the organiser).
3. No disruptiveness ranking; the motions queue is chair-ordered with an "Oldest first" button.
4. No notes feature; **honorary observer is built** (see Notes and sanctions).
5. Yielding to questions: 30 seconds to ask, 30 seconds to reply.
6. **Week 1 and week 2 are two separate sessions of the same committee** (see "Sessions" below).
7. **Resolution storage** (see "Storing resolutions" below).

## Sessions: one committee, two weeks
A Trinity committee is **one saved committee with two sessions** (`week: 1 | 2`), not two committees and not one endless session.
- Shared across both weeks: delegate list, committee name and level, background photo, documents (working papers and draft resolutions), results, and the analytics. Analytics is cumulative with a Week 1 / Week 2 / All filter.
- Per session: roll call (taken again, alphabetical, every time the committee returns), the step the chair is on, the timers, the speakers' lists and the caucus history. The stepper shows Week 1 | Week 2 at the top; "End week 1" closes the session, keeps everything, and "Start week 2" opens a fresh roll call.
- **Experienced week 1** runs: opening statements, moderated caucuses, unmoderated caucuses, working papers; ends with the chair combining/selecting a draft resolution (proposer, seconder, co-sponsors set by the chair). **Week 2** is the resolution flow (introduction, debate, amendments, closing, final vote).
- **Beginner**: week 1 has two seen resolutions, week 2 one seen and one unseen (with the 20-minute prep step). Each resolution runs the full flow. The result of each resolution is recorded; the "formally adopt one resolution per committee" line is the chair's pick at the end.
- Why not separate committees: the working papers, the combined draft's proposer/co-sponsors, the delegate list, the roll and the analytics would all have to be re-entered or copied, and the week-1 to week-2 link (which working papers became which draft) would be lost. Why not one continuous session: the state would carry both weeks' steps at once, the stepper and display would be confusing, and "one session is open on the display" would stop being true.
- State shape: `sessions: [{ week, step, roll, timers, ... }]` plus top-level shared fields; `normalise()` must create session 1 when missing. Old Evatt states are untouched.

## Storing resolutions
- Store, per resolution: **title, week, seen/unseen, status (Submitted / Approved / Sent back), proposer, seconder, co-sponsors, and a short link field for the research sheet or the full document** (the handbook says the chair provides it; Collex only points to it).
- Store the **operative clause texts** only if the chair pastes them, **capped at about 8,000 characters per resolution** with a counter. Collex needs them to show the original clause beside an amendment and to name clauses ("Operative Clause 3"); nothing else needs the full text.
- **Do not store research sheets or the full resolution document in the state.** Reason: the whole committee state is rewritten on every action, kept in localStorage (about 5 MB total), and synced through Supabase every few seconds with version checks and rebases. Long texts would make every tick heavier, raise the chance of conflicts between two chairs, and could push localStorage past its limit with several committees saved. If the owner later wants full text, store it in the `photos`-style storage bucket and keep only a URL in the state.
