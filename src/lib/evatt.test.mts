import assert from "node:assert/strict";
import * as ch from "./chamber.ts";

// Evatt: what is open during the opening, and how a speaker yields. Run with: npx tsx src/lib/evatt.test.mts
const names = ["China", "Colombia", "DRC", "France", "UK"];
const id = (n: string) => `d${names.indexOf(n)}`;
let c = ch.create("UNSC", "Removal of Nuclear Weapons", 120, names, names.map((_, i) => `d${i}`));
c = ch.beginDebate(ch.markAllRoll(ch.startRoll(c), "voting"));
c = ch.pickRole(ch.pickRole(ch.pickRole(c, "proposer", id("China")), "seconder", id("Colombia")), "opposer", id("DRC"));
c = ch.startSpeeches(c);
assert.equal(c.step, "proposer");

/* ---------- the opening: the negotiation chamber and notes open as the Seconder starts to speak ---------- */
const shut = (x: ch.Chamber, when: string) => { assert.equal(ch.rooms(x).negotiation, false, `negotiation shut ${when}`); assert.equal(ch.rooms(x).notes, false, `notes shut ${when}`); };
const open = (x: ch.Chamber, when: string) => { assert.equal(ch.rooms(x).negotiation, true, `negotiation open ${when}`); assert.equal(ch.rooms(x).notes, true, `notes open ${when}`); };
shut(c, "before the Proposer is called");
c = ch.callProposer(c);
shut(c, "while the Proposer speaks");

/* ---------- yielding: first the choice, then either the chair or Points of Information ---------- */
c = ch.endSpeech(c, ch.now(), id("China"));
assert.equal(c.speech?.phase, "after");
assert.equal(ch.takingPoints(c.speech!), false, "the speech is over, and the speaker has not yet said how they yield");
assert.equal(ch.askPoi(c, id("China"), id("China"), 0), c, "a speaker can't ask themselves");
// Back to the speech, then end it again.
assert.equal(ch.backPhase(c, id("China"), 0).speech?.phase, "speech");
// Yield to Points of Information: taken one at a time.
c = ch.yieldToPoints(c, id("China"));
assert.equal(ch.takingPoints(c.speech!), true);
assert.equal(ch.yieldToPoints(c, id("China")), c, "yielding twice changes nothing");
assert.equal(ch.takingPoints(ch.backPhase(c, id("China"), 0).speech!), false, "Back returns to the choice");
c = ch.askPoi(c, id("France"), id("China"), 0);
assert.equal(c.speech?.phase, "ask"); assert.equal(ch.takingPoints(c.speech!), true);
assert.equal(ch.backPhase(c, id("China"), 0).speech?.phase, "after", "Cancel takes the question back");
assert.equal(ch.takingPoints(ch.backPhase(c, id("China"), 0).speech!), true, "and stays with Points of Information");
c = ch.answerPoi(c, id("China"), id("France"), 0, ch.now());
assert.equal(c.speech?.phase, "answer");
c = ch.donePoi(c, id("China"), id("France"), 0, ch.now());
assert.equal(c.speech?.phase, "after"); assert.equal(c.speech?.pois, 1); assert.equal(c.timer, null);
assert.equal(ch.takingPoints(c.speech!), true, "after a point, the next one is taken the same way");
assert.equal(ch.backPhase(c, id("China"), 1), c, "nothing to go back to once a point has been taken");
c = ch.yieldToChair(c, id("China"), 1);
assert.equal(c.speech, null); assert.equal(c.step, "seconder");
assert.ok(c.log.some((l) => l.text === "China yields to Points of Information"));
assert.ok(c.log.some((l) => l.text === "China yields to the chair after 1 Point of Information"));

shut(c, "before the Seconder is called");
c = ch.callSeconder(c);
open(c, "as the Seconder starts to speak");
c = ch.endSpeech(c, ch.now(), id("Colombia"));
open(c, "while the Seconder says how they yield");
// Yielding straight to the chair ends the turn.
c = ch.yieldToChair(c, id("Colombia"), 0);
assert.equal(c.step, "opposer");
open(c, "before the Opposer is called");
c = ch.callOpposer(c);
open(c, "while the Opposer speaks");
// A point taken without choosing first (a delegate's request the chair accepts) counts as yielding to points.
c = ch.endSpeech(c, ch.now(), id("DRC"));
c = ch.askPoi(c, id("UK"), id("DRC"), 0);
assert.equal(c.speech?.points, true);
c = ch.donePoi(ch.answerPoi(c, id("DRC"), id("UK"), 0, ch.now()), id("DRC"), id("UK"), 0, ch.now());
c = ch.yieldToChair(c, id("DRC"), 1);
assert.equal(c.step, "caucus");
assert.equal(ch.rooms(c).negotiation, false, "the council is on its feet in a caucus");
assert.equal(ch.rooms(c).notes, true); assert.equal(ch.rooms(c).amendments, true);
c = ch.endCaucus(c);
assert.equal(c.step, "floor"); open(c, "on the floor");
{
  // 9. N on the Evatt floor calls the next on the list.
  const fl = ch.addToList(ch.addToList(c, id("France"), "for"), id("UK"), "against");
  const n = ch.callNextSpeaker(fl);
  assert.ok(n.speech, "N calls the next speaker on the Evatt floor");
  assert.equal(ch.callNextSpeaker(n), n, "and never while someone speaks");
  // 1. Back keeps the chairs' scores, and the notes kept with them.
  const scored = ch.setScore(ch.remember(fl, n), id("France"), { speaking: 7 });
  const back = ch.goBack(scored, ch.now());
  assert.equal(back.speech, null);
  assert.equal(ch.scoreOf(back, id("France")).speaking, 7, "Back keeps the scores");
  // 15. A timer runs past zero and shows the overtime; adding time takes the overtime off first.
  const t0 = 1_000_000;
  const run = ch.startTimer(n, t0);
  const total = run.timer!.total;
  assert.equal(ch.timerText(run.timer!, t0 + total + 12_400), "+0:12");
  assert.equal(ch.remaining(run.timer!, t0 + total + 12_400), 0);
  const paused = ch.pauseTimer(run, t0 + total + 12_000);
  assert.equal(ch.timerText(paused.timer!, t0 + total + 99_000), "+0:12", "paused overtime stays put");
  assert.equal(ch.timerText(ch.startTimer(paused, 5_000_000).timer!, 5_003_000), "+0:15", "and keeps counting when started again");
  assert.equal(ch.timerText(ch.nudgeTimer(paused, 15, 0).timer!, 0), "0:03", "15 seconds more, 12 over, leaves 3");
  assert.equal(ch.resetTimer(paused).timer!.over, undefined);
  // 12. A vote needs at least one state present.
  const none = ch.markAllRoll(fl, "absent");
  assert.ok(ch.voteBlock(none));
  const closing: ch.Chamber = { ...none, step: "closing" };
  assert.equal(ch.startVote(closing), closing, "no vote with no state present");
  assert.equal(ch.startVote({ ...fl, step: "closing" }).step, "vote");
  assert.equal(ch.voteBlock(fl), null);
}
c = ch.closeDebate(c);
shut(c, "from the closing on");

/* ---------- a committee saved before this, part-way through its points, carries on ---------- */
const old: ch.Speech = { who: "d0", side: "for", role: "proposer", phase: "after", asker: null, pois: 2 };
assert.equal(ch.takingPoints(old), true);
assert.deepEqual(ch.normalise(JSON.parse(JSON.stringify(c))), c);

/* ---------- Back tags stay on the kept steps: a console on the last build that went back leaves one on the committee ---------- */
{
  const stray = { ...c, by: "chairA", what: "Call Brazil" } as ch.Chamber; // HEAD's goBack spreads the kept step, tags and all
  const next = ch.remember(stray, ch.note(stray, "Something"), "chairB");
  assert.equal(next.by, undefined, "no tag on the committee itself");
  assert.equal(next.what, undefined);
  assert.equal(next.hist!.at(-1)!.by, "chairB", "the step is the chair's who made it");
  assert.equal(ch.backIsOthers(next, "chairB"), false);
  const loaded = ch.normalise(JSON.parse(JSON.stringify(stray)))!;
  assert.ok(!("by" in loaded) && !("what" in loaded), "and none once loaded");
  // A step saved before steps were tagged belongs to anyone.
  const untagged = { ...next, hist: [...next.hist!.slice(0, -1), { ...next.hist!.at(-1)!, by: undefined }] } as ch.Chamber;
  assert.equal(ch.backIsOthers(untagged, "chairC"), false);
  assert.notEqual(ch.goBack(untagged, ch.now(), "chairC"), untagged);
  assert.equal(ch.goBack(next, ch.now(), "chairC"), next, "another chair's step is left alone");
}

console.log("EVATT OK");
