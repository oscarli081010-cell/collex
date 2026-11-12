// Run with: npx tsx src/lib/trinity.test.mts
import * as ch from "./chamber.ts";
import assert from "node:assert/strict";

const names = ["Australia", "Brazil", "China", "Denmark", "Egypt", "France", "Germany", "India", "Japan", "Kenya", "Mexico", "Russia", "Sweden", "UK", "USA", "Vietnam"];
const ids = names.map((_, i) => "d" + i);
const id = (n: string) => ids[names.indexOf(n)];
let k = 0;
const uid = () => "u" + ++k;
const AT = 1_000_000;
const begin = (x: ch.Chamber) => ch.endStatements(ch.beginDebate(x)); // past the statements, to the general debate
const addDoc = (x: ch.Chamber, docId: string, d: { title: string; proposer: string | null; seconder: string | null; sponsors?: string[]; seen?: boolean }): ch.Chamber => ({
  ...x, tr: { ...x.tr!, docs: [...x.tr!.docs, { id: docId, kind: "draft", title: d.title, week: 1, seen: d.seen ?? true, proposer: d.proposer, seconder: d.seconder, sponsors: d.sponsors ?? [], status: "approved", link: "", clauses: "", at: 1000 + x.tr!.docs.length, from: [], result: null }] },
});
const present = (c: ch.Chamber) => ch.markAllRoll(ch.startRoll(c), "voting");

/* ---------- setup ---------- */
assert.deepEqual(ch.parseNames("United States of America, Russian Federation, Democratic Republic of the Congo"), ["USA", "Russia", "DRC"]);
let c = ch.createTrinity("UNSC", "Removal of Nuclear Weapons", 90, names, ids);
assert.equal(c.rules, "trinity"); assert.equal(c.tr!.week, 1);
c = ch.startRoll(c);
c = ch.markAllRoll(c, "voting");
c = ch.markRoll(c, id("Kenya"), "present");
c = ch.beginDebate(c);
assert.equal(c.step, "statements", "the session opens with the statements straight after the roll call");
assert.equal(ch.stageIndex(c), 1);
assert.deepEqual(ch.rooms(c).labels, [], "nothing is open during the statements");
assert.deepEqual(ch.motionKinds(c), ["mod", "unmod", "extend", "closemod", "close"], "caucuses and closing the debate; no motion to introduce an amendment");

/* ---------- opening statements ---------- */
assert.equal(c.step, "statements");
assert.equal(ch.nextStatement(c), id("Australia"), "alphabetical");
c = ch.callStatement(c, id("Brazil")); // any state can be called
assert.equal(c.speech!.role, "statement"); assert.equal(c.timer!.total, 90_000, "90 seconds in 2026");
c = ch.startTimer(c, AT); c = ch.endSpeech(c, AT + 70_000, id("Brazil"));
assert.equal(c.speech!.left, 20, "unused seconds are kept");
c = ch.askPoi(c, id("China"), id("Brazil"), 0); c = ch.answerPoi(c, id("Brazil"), id("China"), 0, AT + 80_000); c = ch.donePoi(c, id("Brazil"), id("China"), 0, AT + 90_000);
c = ch.yieldToChair(c, id("Brazil"), 1);
assert.deepEqual(c.tr!.opened, [id("Brazil")]); assert.equal(c.speech, null); assert.equal(c.step, "statements");
assert.equal(ch.callStatement(c, id("Brazil")).speech, null, "one statement each");
assert.equal(ch.nextStatement(c), id("Australia"));
c = ch.endStatements(c); assert.equal(c.step, "general");
assert.ok(c.stats.some((x) => x.kind === "statement" && x.who === id("Brazil") && x.wk === 1));

/* ---------- honorary observers ---------- */
c = ch.setObserver(c, id("Japan"));
assert.equal(ch.observing(c, id("Japan")), true);
assert.equal(c.debate.list.some((x) => x.id === id("Japan")), false, "taken off the list");
assert.equal(ch.addToList(c, id("Japan"), "for").debate.list.some((x) => x.id === id("Japan")), false);
assert.equal(ch.callSpeaker(c, id("Japan"), "for").speech, null);
assert.equal(ch.observerLeft(c, id("Japan")) > 299_000, true);
ch.setSkew(6 * 60_000);
assert.equal(ch.observing(c, id("Japan")), false, "ends by itself");
ch.setSkew(0);
c = ch.endObserver(c, id("Japan")); assert.equal(ch.observing(c, id("Japan")), false);

/* ---------- moderated caucus, and motions (while a resolution is debated) ---------- */
assert.ok(ch.modError(600, 600), "speaking time equal to the caucus is not allowed");
assert.ok(ch.modError(600, 70), "must fit evenly");
assert.ok(ch.modError(1260, 60), "at most 20 minutes");
assert.ok(ch.modError(600, 4));
assert.equal(ch.modError(600, 60), null);
c = { ...c, step: "floor" };
assert.equal(ch.callMod(c, "Verification", 600, 70), c, "an invalid caucus is refused");
const floor = c;
c = ch.callMod(floor, "Verification", 600, 60);
assert.equal(c.step, "caucus"); assert.equal(c.tr!.cauc!.kind, "mod");
assert.equal(ch.listOpen(c), true); assert.equal(ch.sided(c), false);
c = ch.startCauc(c, AT); assert.equal(ch.running(c.tr!.cauc!.clock), true);
c = ch.pauseCauc(c, AT + 10_000); assert.equal(c.tr!.cauc!.clock!.left, 590_000);
c = ch.startCauc(c, AT + 10_000);
assert.equal(ch.canCloseMod(c), false);
for (const n of ["Egypt", "France", "Germany"]) {
  c = ch.addToList(c, id(n), "for");
  c = ch.callSpeaker(c, id(n), "for");
  assert.equal(c.timer!.total, 60_000, "the caucus's speaking time");
  c = ch.endSpeech(c, AT, id(n)); c = ch.yieldToChair(c, id(n), 0);
}
assert.equal(ch.canCloseMod(c), true, "after three speakers");
assert.equal(ch.extendCaucus(c, 120, AT + 20_000), c, "not before the time has run out");
const over = ch.extendCaucus({ ...c, tr: { ...c.tr!, cauc: { ...c.tr!.cauc!, clock: { ...c.tr!.cauc!.clock!, endsAt: null, left: 0 } } } }, 300, AT);
assert.equal(over.tr!.cauc!.ext, 1); assert.equal(over.tr!.cauc!.clock!.total, 300_000);
const two = { ...over, tr: { ...over.tr!, cauc: { ...over.tr!.cauc!, ext: 2, clock: { ...over.tr!.cauc!.clock!, left: 0 } } } };
assert.equal(ch.extendCaucus(two, 60, AT), two, "at most two");
c = ch.closeMod(c);
assert.equal(c.step, "floor"); assert.equal(c.tr!.cauc, null);

assert.equal(ch.motionError(c, { kind: "unmod", by: id("India"), total: 600 }), null);
assert.ok(ch.motionError(c, { kind: "mod", by: id("India"), topic: "", total: 600, per: 60 }));
assert.ok(ch.motionError(c, { kind: "unmod", by: id("India"), total: 1500 }));
c = ch.addMotion(c, "m1", { kind: "unmod", by: id("India"), total: 600 });
c = ch.addMotion(c, "m2", { kind: "mod", by: id("Japan"), topic: "Funding", total: 300, per: 30 });
c = ch.addMotion(c, "m3", { kind: "unmod", by: id("Kenya"), total: 120 });
assert.equal(ch.addMotion(c, "mx", { kind: "suspend", by: null }).tr!.motions.length, 3, "a motion that is not used is refused");
assert.equal(ch.addMotion(c, "mx", { kind: "draft" as ch.MotionKind, by: null, ref: "d" }).tr!.motions.length, 3, "no motion to introduce a resolution");
assert.deepEqual(ch.waitingMotions(c).map((m) => m.id), ["m1", "m2", "m3"]);
c = ch.moveMotion(c, "m3", -1); c = ch.moveMotion(c, "m3", -1);
assert.deepEqual(ch.waitingMotions(c).map((m) => m.id), ["m3", "m1", "m2"]);
c = ch.sortMotions(c);
assert.deepEqual(ch.waitingMotions(c).map((m) => m.id), ["m1", "m2", "m3"], "oldest first");
c = ch.withdrawMotion(c, "m3"); assert.equal(ch.waitingMotions(c).length, 2);
c = ch.voteMotion(c, "m1");
assert.equal(c.poll!.kind, "motion");
assert.equal(ch.voteMotion(c, "m2").poll!.motion, "m1", "one vote at a time");
c = ch.tally(c, "yes", 1); c = ch.tally(c, "yes", 1); c = ch.tally(c, "no", 1);
c = ch.decideMotion(c, null, "m1");
assert.equal(c.step, "caucus"); assert.equal(c.tr!.cauc!.kind, "unmod"); assert.equal(c.timer!.total, 600_000);
assert.equal(c.tr!.motions.find((m) => m.id === "m1")!.status, "passed");
c = ch.endCaucus(c); assert.equal(c.step, "floor");
c = ch.voteMotion(c, "m2"); c = ch.tally(c, "no", 1);
c = ch.decideMotion(c, null, "m2");
assert.equal(c.step, "floor"); assert.equal(c.tr!.motions.find((m) => m.id === "m2")!.status, "failed");
c = ch.addMotion(c, "m4", { kind: "mod", by: id("Japan"), topic: "Funding", total: 300, per: 30 });
c = ch.voteMotion(c, "m4"); c = ch.tally(c, "no", 1);
c = ch.decideMotion(c, "for", "m4"); // the chair overrules
assert.equal(c.step, "caucus"); assert.equal(c.tr!.cauc!.kind, "mod");
assert.ok(c.log.some((e) => /overruled/.test(e.text)));
assert.equal(ch.closeMod(c), c, "the motion to close needs three speakers first");
c = ch.endCaucus(c); // the chair can still end it when the time is up
assert.equal(c.step, "floor");
c = { ...c, step: "general", after: null, tr: { ...c.tr!, cauc: null, saved: null }, debate: ch.emptyDebate() };
/* ---------- resolutions ---------- */
c = addDoc(c, "d1", { title: "Resolution on Verification", proposer: id("China"), seconder: id("Denmark"), sponsors: [id("Egypt")] });
assert.equal(ch.introduceDraft(ch.setObserver(c, id("China")), "d1").step, "general", "an observer can't propose");
c = ch.introduceDraft(c, "d1");
assert.equal(c.step, "pick"); assert.equal(c.tr!.current, "d1");
assert.deepEqual(c.roles, { proposer: id("China"), seconder: id("Denmark"), opposer: null });
assert.equal(c.topic, "Removal of Nuclear Weapons", "the committee's topic stays");

/* ---------- introduction speeches ---------- */
c = ch.pickRole(c, "opposer", id("India"));
c = ch.startSpeeches(c); assert.equal(c.step, "proposer");
assert.deepEqual(ch.rooms(c).labels, ["Speakers’ List Open"], "the speakers' list opens with the introduction, and the pill says so because the console has it open");
assert.equal(ch.sided(c), true);
c = ch.callProposer(c); assert.equal(c.timer!.total, 90_000, "90 seconds in 2026");
c = ch.endSpeech(c, AT, id("China")); c = ch.yieldToChair(c, id("China"), 0);
assert.equal(c.step, "seconder");
c = ch.callSeconder(c); assert.equal(c.timer!.total, 90_000);
c = ch.endSpeech(c, AT, id("Denmark")); c = ch.yieldToChair(c, id("Denmark"), 0);
assert.equal(c.step, "opposer");
c = ch.callOpposer(c); assert.equal(c.timer!.total, 90_000, "the opposing speech is 90 seconds too");
c = ch.endSpeech(c, AT, id("India")); c = ch.yieldToChair(c, id("India"), 0);
assert.equal(c.step, "caucus"); assert.equal(c.timer!.total, 300_000, "5 minutes unmoderated"); assert.equal(c.after, "floor");
assert.equal(c.tr!.cauc!.kind, "unmod");
assert.deepEqual(ch.rooms(c).labels, ["Amendments Open", "Motions Open"], "the 5 minutes that open the debate: amendments and motions are open");
assert.equal(ch.submitAmendment(c, "early", id("Egypt"), "Clause 1", "In the first caucus", [id("France"), id("Sweden")], id("Germany")).amendments.length, 1, "amendments can be handed in during the first caucus");
c = ch.endCaucus(c); assert.equal(c.step, "floor");
assert.equal(ch.stageIndex(c), 2);
assert.deepEqual(ch.rooms(c).labels, ["Speakers’ List Open", "Amendments Open", "Motions Open"]);

/* ---------- the draft resolution's speakers' list and amendments ---------- */
assert.equal(ch.sided(c), true);
c = ch.addToList(c, id("Kenya"), "against"); c = ch.addToList(c, id("Mexico"), "for");
assert.equal(ch.addToList(c, id("Mexico"), "against").debate.list.length, 2);
// amendments need a proposer and a seconder, and as many sponsors as possible: there is no quota in 2026
const am = (x: ch.Chamber, aid: string, by: string, clause: string, backers: string[], sec: string | null, cons = false) => ch.submitAmendment(x, aid, by, clause, "Change it", backers, sec, cons);
assert.equal(am(c, "a0", id("Egypt"), "Clause 1", [id("France")], null).amendments.length, 0, "needs a seconder");
assert.equal(am(c, "a0", id("Egypt"), "Clause 1", [], id("Germany")).amendments.length, 1, "a proposer and a seconder are enough");
c = am(c, "a1", id("Egypt"), "Clause 1", [id("France"), id("Sweden")], id("Germany"));
assert.equal(c.amendments.length, 1); assert.equal(c.amendments[0].seconder, id("Germany")); assert.equal(c.amendments[0].backers.length, 3);
c = am(c, "a2", id("Mexico"), "Clause 2", [id("Sweden"), id("UK")], id("Vietnam"));
assert.equal(c.amendments.length, 2);
const withList = c.debate;
c = ch.entertain(c, "a1"); assert.equal(c.step, "amend"); assert.equal(c.debate.list.length, 0); assert.equal(c.tr!.saved!.list.length, 2);
c = ch.amendAsk(c, "a1"); assert.equal(c.poll!.kind, "debate");
c = ch.tally(c, "yes", 1); c = ch.tally(c, "yes", 1); c = ch.decideAsk(c, null, "a1");
assert.equal(c.amend!.stage, "debate");
assert.equal(c.tr!.cauc!.kind, "amend"); assert.equal(c.tr!.cauc!.total, 600); assert.equal(c.tr!.cauc!.per, 60, "a 10-minute moderated caucus");
assert.equal(ch.setPer(c, 70), c, "must fit evenly");
c = ch.setPer(c, 50); assert.equal(c.tr!.cauc!.per, 50);
assert.equal(ch.callCaucus(c, 120), c, "an amendment debate is already a caucus");
c = ch.callAmender(c); assert.equal(c.timer!.total, 50_000);
c = ch.endSpeech(c, AT, id("Egypt")); c = ch.yieldToChair(c, id("Egypt"), 0);
c = ch.addToList(c, id("Kenya"), "against"); c = ch.callSpeaker(c, id("Kenya"), "against"); assert.equal(c.timer!.total, 50_000);
c = ch.endSpeech(c, AT, id("Kenya")); c = ch.yieldToChair(c, id("Kenya"), 0);
c = ch.amendVote(c, "a1"); assert.equal(c.tr!.cauc, null);
c = ch.tally(c, "yes", 1); c = ch.decideAmendment(c, null, "a1");
assert.equal(c.step, "floor"); assert.equal(c.amendments[0].status, "passed");
assert.deepEqual(c.debate, withList, "the draft's speakers' list is back as it was");
assert.equal(c.tr!.saved, null);
// a clause already amended needs full consensus
assert.equal(am(c, "a3", id("Egypt"), "clause  1", [id("France"), id("Sweden")], id("Germany")).amendments.length, 2);
c = am(c, "a3", id("Egypt"), "clause  1", [id("France"), id("Sweden")], id("Germany"), true);
assert.equal(c.amendments.length, 3, "allowed with full consensus");
// an observer can't sign
const obs = ch.setObserver(c, id("Sweden"));
assert.equal(am(obs, "a4", id("Japan"), "Clause 5", [id("Sweden"), id("UK")], id("Vietnam")).amendments[3].backers.includes(id("Sweden")), false, "its signature is left out");
assert.equal(am(obs, "a4", id("Japan"), "Clause 5", [], id("Sweden")).amendments.length, 3, "an observer can't second");
// reject a debate vote: straight to the vote
c = ch.entertain(c, "a2"); c = ch.amendAsk(c, "a2"); c = ch.tally(c, "no", 1);
c = ch.decideAsk(c, null, "a2");
assert.equal(c.amend!.stage, "vote");
c = ch.tally(c, "no", 1); c = ch.decideAmendment(c, null, "a2");
assert.equal(c.amendments.find((a) => a.id === "a2")!.status, "failed");
// the chair can set an amendment aside
c = ch.entertain(c, "a3"); c = ch.backOutAmendment(c, "a3");
assert.equal(c.step, "floor"); assert.equal(c.debate.list.length, 2); assert.equal(c.tr!.saved, null);

/* ---------- a chair-called caucus and closing ---------- */
c = ch.callCaucus(c, 300); assert.equal(c.step, "caucus"); assert.equal(c.after, "floor");
c = ch.endCaucus(c);
c = ch.closeDebate(c);
assert.equal(c.step, "closing");
assert.deepEqual(ch.closingRoles(c).map((r) => r.role), ["opposer", "seconder", "proposer"]);
assert.equal(ch.callCloser(c, id("China")).speech, null, "the opposer closes first");
c = ch.callCaucus(c, 240); assert.equal(c.step, "caucus"); assert.equal(c.after, "closing"); assert.equal(c.tr!.cauc!.kind, "final");
assert.equal(ch.stageIndex(c), 3);
c = ch.endCaucus(c); assert.equal(c.step, "closing");
assert.equal(ch.callCaucus(c, 240), c, "only one final caucus");
for (const [who, role] of [[id("India"), "opposer"], [id("Denmark"), "seconder"], [id("China"), "proposer"]] as const) {
  c = ch.callCloser(c, who); assert.equal(c.speech!.role, "closer"); assert.equal(c.timer!.total, 120_000, role);
  c = ch.endSpeech(c, AT, who);
}
assert.equal(c.closers.length, 3);
c = ch.startVote(c); assert.equal(c.step, "vote");

/* ---------- the final vote ---------- */
const vote = (x: ch.Chamber, yes: string[], no: string[], abst: string[]) => {
  for (const d of x.delegates) x = ch.cast(x, d.id, yes.includes(d.name) ? "for" : no.includes(d.name) ? "against" : abst.includes(d.name) ? "abstain" : "for");
  return x;
};
assert.equal(ch.cast(c, id("Brazil"), "abstain").ballots[id("Brazil")], undefined, "Present and Voting can't abstain");
assert.equal(ch.cast(c, id("Kenya"), "abstain").ballots[id("Kenya")], "abstain", "Present can");
assert.equal(ch.finishVote(c).step, "vote", "everyone votes first");
// More For than Against; abstentions count for neither.
const NO6 = ["Sweden", "Vietnam", "Germany", "Egypt", "Denmark", "Mexico"];
const tally = (against: string[]) => ch.finishVote(vote(c, names.filter((n) => !against.includes(n) && n !== "Kenya"), against, ["Kenya"]));
let r = tally(NO6); // 9 for, 6 against, Kenya abstaining
assert.equal(r.outcome!.passed, true); assert.equal(r.outcome!.needed, 8);
assert.equal(r.tr!.docs.find((d) => d.id === "d1")!.result, "passed");
r = tally([...NO6, "Japan", "India", "Brazil"]); assert.equal(r.outcome!.passed, false, "6 for, 9 against"); assert.equal(r.tr!.docs.find((d) => d.id === "d1")!.result, "failed");
r = tally([...NO6, "Japan", "India"]); assert.equal(r.outcome!.passed, false, "7 for, 8 against");
// every state, however it votes, is just a vote: no vetoes
{
  let x = c;
  for (const d of x.delegates) x = ch.cast(x, d.id, d.name === "USA" ? "against" : "for");
  assert.equal(ch.finishVote(x).outcome!.passed, true);
}
// reopening the vote clears the draft's result
let done = tally(NO6);
assert.equal(ch.reopenVote(done).tr!.docs.find((d) => d.id === "d1")!.result, null);

/* ---------- after the vote: back to the general debate ---------- */
c = done;
const g = ch.backToGeneral(c);
assert.equal(g.step, "general"); assert.equal(g.tr!.current, null); assert.equal(g.amendments.length, 0); assert.equal(g.outcome, null);
assert.equal(g.tr!.docs.find((d) => d.id === "d1")!.result, "passed", "the result stays on the draft");
assert.equal(ch.introduceDraft(g, "d1").step, "general", "a decided draft isn't introduced again");
assert.equal((ch as unknown as Record<string, unknown>).nextWeek, undefined, "2026 is one session: there is no second week");

/* ---------- right of reply ---------- */
{
  const gf = { ...g, step: "floor" as const }; let x = ch.callSpeaker(ch.addToList(gf, id("Japan"), "for"), id("Japan"), "for");
  x = ch.startTimer(x, AT);
  x = ch.startReply(x, id("Brazil"), id("Japan"));
  assert.equal(x.timer!.total, 20_000); assert.equal(x.tr!.stash!.endsAt, null, "the speech's clock waits");
  assert.equal(ch.startReply(x, id("India"), null), x, "one at a time");
  x = ch.finishReply(x, "apologised");
  assert.equal(x.tr!.reply, null); assert.equal(x.timer!.total, 90_000, "the speech's clock comes back"); assert.equal(x.tr!.replies.length, 1);
}
// points
assert.equal(ch.logPoint(g, "order").tr!.points.length, 1);
// preparation, and the beginner committee
{
  const p = ch.startPrep(g);
  assert.equal(p.step, "caucus"); assert.equal(p.timer!.total, 1_200_000); assert.equal(p.tr!.cauc!.kind, "prep");
  assert.equal(ch.endCaucus(p).step, "general");
  const b = begin(ch.markAllRoll(ch.startRoll(ch.createTrinity("GA", "Water", 60, names, ids)), "voting"));
  let d = addDoc(b, "d9", { title: "Water", proposer: id("Australia"), seconder: id("Brazil"), sponsors: [id("China"), id("Denmark")] });
  d = ch.introduceDraft(d, "d9");
  d = ch.startSpeeches(d);
  d = ch.callProposer(d); assert.equal(d.timer!.total, 90_000, "beginner: 90 seconds");
  d = ch.endSpeech(d, AT, id("Australia")); d = ch.yieldToChair(d, id("Australia"), 0);
  d = ch.callSeconder(d); assert.equal(d.timer!.total, 90_000);
  d = ch.endSpeech(d, AT, id("Brazil")); d = ch.yieldToChair(d, id("Brazil"), 0);
  assert.equal(d.step, "caucus", "no opposer: straight to the 5-minute caucus");
  // simple majority, abstentions don't count
  let v = ch.startVote(ch.closeDebate(ch.endCaucus(d)));
  v = { ...v, step: "vote" };
  for (const x of v.delegates) v = ch.cast(v, x.id, x.name === "USA" || x.name === "Russia" ? "against" : "for");
  const out = ch.finishVote(v).outcome!;
  assert.equal(out.passed, true);
  let t = v;
  for (const x of t.delegates) t = ch.cast(t, x.id, x.name === "China" ? "for" : "against");
  assert.equal(ch.finishVote(t).outcome!.passed, false);
  let eq = v; // exactly as many For as Against fails
  const half = eq.delegates.length / 2;
  eq.delegates.forEach((x, i) => { eq = ch.cast(eq, x.id, i < half ? "for" : "against"); });
  assert.equal(ch.finishVote(eq).outcome!.passed, false);
}


/* ---------- what an amendment does ---------- */
{
  // a strike, an amend or an add is kept
  let y = begin(ch.markAllRoll(ch.startRoll(ch.createTrinity("GA", "T", 60, names, ids)), "voting"));
  y = ch.introduceDraft(addDoc(y, "d", { title: "R", proposer: id("Australia"), seconder: id("Brazil"), sponsors: [id("China"), id("Denmark")] }), "d");
  y = { ...y, step: "floor" };
  y = ch.submitAmendment(y, "s1", id("Egypt"), "Clause 2", "Remove it", [id("France"), id("India")], id("Germany"), false, "strike");
  assert.equal(y.amendments[0].how, "strike");
  assert.equal(ch.submitAmendment(y, "s2", id("Egypt"), "Clause 3", "More", [id("France"), id("India")], id("Germany")).amendments[1].how, "amend", "amend unless said otherwise");
}

/* ---------- saving and loading ---------- */
{
  const round = ch.normalise(JSON.parse(JSON.stringify(g)));
  assert.deepEqual(round, g);
  const evatt = ch.create("E", "Topic", 120, names, ids);
  assert.equal(ch.normalise(JSON.parse(JSON.stringify(evatt)))!.tr, null);
  assert.equal(ch.normalise({ ...JSON.parse(JSON.stringify(g)), tr: null })!.rules, "evatt", "a Trinity committee without its extras is reset, not trusted");
  assert.equal(ch.newResolution(ch.backToGeneral(done), "x").step, "general", "Evatt's next-resolution does nothing to a Trinity committee");
}

/* ---------- the beginner committee's given resolutions ---------- */
{
  let b = ch.createTrinity("GA", "Topic", 60, names, ids, [
    { title: "Seen one", week: 1, seen: true }, { title: "Unseen", week: 1, seen: false }, { title: "  ", week: 1, seen: true },
  ]);
  assert.equal(b.tr!.docs.length, 2, "blank titles are left out");
  assert.ok(b.tr!.docs.every((d) => d.status === "approved" && d.proposer === null && d.kind === "draft"));
  assert.equal(b.tr!.docs.filter((d) => d.seen).length, 1); assert.equal(b.tr!.docs.filter((d) => !d.seen).length, 1, "one seen and one unseen");
  assert.equal(ch.SLOTS.length, 2);
  b = begin(ch.markAllRoll(ch.startRoll(b), "voting"));
  b = ch.introduceDraft(b, "agenda0");
  assert.equal(b.step, "pick", "a given resolution can be introduced without a proposer");
  assert.equal(ch.startSpeeches(b), b, "the proposer and seconder must be chosen first");
  b = ch.pickRole(b, "proposer", id("China")); b = ch.pickRole(b, "seconder", id("Russia"));
  b = ch.startSpeeches(b);
  assert.equal(b.step, "proposer");
  assert.equal(b.tr!.docs[0].proposer, id("China")); assert.equal(b.tr!.docs[0].seconder, id("Russia"));
}

/* ---------- the caucus clock follows the speeches ---------- */
{
  let m = begin(ch.markAllRoll(ch.startRoll(ch.createTrinity("SC", "T", 60, names, ids)), "voting"));
  m = ch.callMod(m, "Verification", 600, 60);
  m = ch.addToList(m, id("India"), "for", true); m = ch.addToList(m, id("Japan"), "against");
  assert.deepEqual(m.debate.list.map((s) => !!s.stance), [true, false], "a stance is only shown when it was given");
  m = ch.callSpeaker(m, id("India"), "for");
  assert.equal(m.speech!.stance, true);
  assert.equal(ch.running(m.tr!.cauc!.clock), false, "nothing runs before the speech starts");
  m = ch.startTimer(m, AT); assert.equal(ch.running(m.tr!.cauc!.clock), true, "starting the speech starts the whole caucus's clock");
  m = ch.pauseTimer(m, AT + 20_000); assert.equal(m.tr!.cauc!.clock!.left, 580_000); assert.equal(ch.running(m.tr!.cauc!.clock), false);
  m = ch.startTimer(m, AT + 30_000);
  m = ch.endSpeech(m, AT + 100_000, id("India")); // the speaker's minute ran out at +70s
  assert.equal(m.tr!.cauc!.clock!.left, 540_000, "only the time the speaker had is taken");
  m = ch.yieldToChair(m, id("India"), 0);
  m = ch.callSpeaker(m, id("Japan"), "against");
  assert.equal(m.speech!.stance, undefined);
}

/* ---------- the general debate ---------- */
{
  let b = ch.beginDebate(ch.markAllRoll(ch.startRoll(ch.createTrinity("GA", "T", 60, names, ids)), "voting"));
  assert.equal(b.step, "statements", "every committee opens with its opening statements (2026)");
  b = ch.endStatements(b);
  assert.equal(b.step, "general");
  assert.equal(ch.listOpen(b), false, "no general speakers' list");
  assert.equal(ch.motionsOpen(b), false);
  assert.deepEqual(ch.motionKinds(b), ["mod", "unmod", "extend", "closemod", "close"], "the beginner committee debates its resolution with caucuses and closing the debate");
  assert.deepEqual(ch.rooms(b).labels, []);
  assert.deepEqual(ch.stagesOf(b), ["Opening", "Resolutions", "Debate", "Closing"]);
  assert.equal(ch.substep(b), "Choosing a Resolution");
  let e = addDoc(b, "z", { title: "Z", proposer: id("China"), seconder: id("Denmark"), sponsors: [id("Egypt"), id("France")] });
  e = ch.introduceDraft(e, "z");
  assert.deepEqual(ch.motionKinds(e), ["mod", "unmod", "extend", "closemod", "close"], "the same set while a resolution is debated");
  assert.equal(ch.motionsOpen(e), false, "not while the proposers are chosen or speaking");
}

/* ---------- wording, and the given resolutions ---------- */
{
  const b = ch.createTrinity("GA", "T", 60, names, ids, [{ title: "", week: 1, seen: true }, { title: "Second", week: 1, seen: false }]);
  assert.equal(ch.resNoun(b), "Resolution");
  assert.equal(ch.roleName(b, "seconder"), "Co-sponsor");
  assert.deepEqual(b.tr!.docs.map((d) => d.id), ["agenda1"], "each resolution keeps its slot");
  assert.equal(ch.substep({ ...b, step: "pick" }), "Introduce the Resolution"); assert.equal(ch.substep({ ...b, step: "floor" }), "Resolution Debate");
  let s = ch.setAgenda(b, 0, "First"); assert.deepEqual(s.tr!.docs.map((d) => d.title), ["First", "Second"], "a slot can be added in its place");
  assert.equal(s.tr!.docs[0].seen, true); assert.equal(s.tr!.docs[1].seen, false, "the second one is the unseen resolution");
  s = ch.setAgenda(s, 1, "Renamed"); assert.equal(s.tr!.docs[1].title, "Renamed");
  assert.equal(ch.setAgenda(s, 2, "Third"), s, "there are only two");
  assert.deepEqual(ch.setAgenda(s, 1, "").tr!.docs.map((d) => d.id), ["agenda0"], "a blank title takes it away");
  const open = begin(ch.markAllRoll(ch.startRoll(s), "voting"));
  const intro = ch.introduceDraft(open, "agenda0");
  assert.equal(ch.setAgenda(intro, 0, "Changed"), intro, "not while it is being debated");
  const closed = { ...intro, tr: { ...intro.tr!, docs: intro.tr!.docs.map((d) => (d.id === "agenda0" ? { ...d, result: "passed" as const } : d)), current: null } };
  assert.equal(ch.setAgenda(closed, 0, "Changed"), closed, "nor once it has a result");
}

/* ---------- the 2026 handbook's times ---------- */
{
  assert.equal(ch.TR.statement, 90, "opening statements: 90 seconds"); assert.equal(ch.TR.speech, 90, "proposer and co-proposer: 90 seconds");
  assert.equal(ch.TR.introOppose, 90, "the first opposing speech: 90 seconds"); assert.equal(ch.TR.oppose, 120, "the closing speeches: 2 minutes");
  assert.equal(ch.TR.final, 240, "the final unmoderated caucus: 4 minutes"); assert.equal(ch.TR.intro, 300, "the first unmoderated caucus: 5 minutes");
}

console.log("ALL TRINITY CHECKS PASSED");
