// Run with: npx tsx src/lib/trinity.test.mts
import * as ch from "./chamber.ts";
import assert from "node:assert/strict";

const names = ["Australia", "Brazil", "China", "Denmark", "Egypt", "France", "Germany", "India", "Japan", "Kenya", "Mexico", "Russia", "Sweden", "UK", "USA", "Vietnam"];
const ids = names.map((_, i) => "d" + i);
const id = (n: string) => ids[names.indexOf(n)];
let k = 0;
const uid = () => "u" + ++k;
const AT = 1_000_000;
const present = (c: ch.Chamber) => ch.markAllRoll(ch.startRoll(c), "voting");

/* ---------- setup ---------- */
assert.deepEqual(ch.parseNames("United States of America, Russian Federation, Democratic Republic of the Congo"), ["USA", "Russia", "DRC"]);
let c = ch.createTrinity("UNSC", "Removal of Nuclear Weapons", "experienced", 90, names, ids);
assert.equal(c.rules, "trinity"); assert.equal(c.tr!.level, "experienced"); assert.equal(c.tr!.week, 1);
c = ch.startRoll(c);
c = ch.markAllRoll(c, "voting");
c = ch.markRoll(c, id("Kenya"), "present");
c = ch.beginDebate(c);
assert.equal(c.step, "general", "roll call leads to the general debate");
assert.equal(ch.stageIndex(c), 1);
assert.deepEqual(ch.rooms(c).labels, ["Speakers’ list open"]);

/* ---------- opening statements ---------- */
c = ch.startStatements(c); assert.equal(c.step, "statements");
assert.equal(ch.nextStatement(c), id("Australia"), "alphabetical");
c = ch.callStatement(c, id("Brazil")); // any state can be called
assert.equal(c.speech!.role, "statement"); assert.equal(c.timer!.total, 120_000, "2 minutes");
c = ch.startTimer(c, AT); c = ch.endSpeech(c, AT + 70_000, id("Brazil"));
assert.equal(c.speech!.left, 50, "unused seconds are kept");
c = ch.askPoi(c, id("China"), id("Brazil"), 0); c = ch.answerPoi(c, id("Brazil"), id("China"), 0, AT + 80_000); c = ch.donePoi(c, id("Brazil"), id("China"), 0, AT + 90_000);
c = ch.yieldToChair(c, id("Brazil"), 1);
assert.deepEqual(c.tr!.opened, [id("Brazil")]); assert.equal(c.speech, null); assert.equal(c.step, "statements");
assert.equal(ch.callStatement(c, id("Brazil")).speech, null, "one statement each");
assert.equal(ch.nextStatement(c), id("Australia"));
c = ch.endStatements(c); assert.equal(c.step, "general");
assert.ok(c.stats.some((x) => x.kind === "statement" && x.who === id("Brazil") && x.wk === 1));

/* ---------- the general speakers' list ---------- */
assert.equal(ch.sided(c), false);
c = ch.addToList(c, id("India"), "for"); c = ch.addToList(c, id("India"), "for");
c = ch.addToList(c, id("Japan"), "against"); c = ch.addToList(c, id("Denmark"), "for");
assert.equal(c.debate.list.length, 3, "a state can't be on the list twice at once");
assert.equal(ch.nextCandidate(c)!.id, id("India"), "first come, first called");
c = ch.callSpeaker(c, id("India"), "for");
assert.equal(c.speech!.who, id("India")); assert.equal(c.timer!.total, 90_000, "the chair's speaking time");
assert.equal(ch.addToList(c, id("India"), "for").debate.list.some((x) => x.id === id("India")), false, "the speaker can't be added while speaking");
c = ch.startTimer(c, AT); c = ch.endSpeech(c, AT + 30_000, id("India"));
assert.equal(c.speech!.left, 60);
// yielding to another country: it speaks next with the time left added
const before = c;
assert.equal(ch.yieldToCountry(c, id("India"), 0, id("India")), before, "not to oneself");
c = ch.yieldToCountry(c, id("India"), 0, id("Kenya"));
assert.equal(c.speech, null); assert.equal(c.debate.list[0].id, id("Kenya"));
assert.equal(ch.nextCandidate(c)!.id, id("Kenya"));
c = ch.callSpeaker(c, id("Kenya"), "for");
assert.equal(c.timer!.total, 150_000, "90 seconds plus the 60 passed on");
assert.equal(c.tr!.bonus, null, "the extra time is used once");
c = ch.endSpeech(c, AT, id("Kenya")); c = ch.yieldToChair(c, id("Kenya"), 0);
// back on the list after speaking
c = ch.addToList(c, id("India"), "for");
assert.ok(c.debate.list.some((x) => x.id === id("India")), "can be added again after speaking");
c = ch.removeFromList(c, id("India"));

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

/* ---------- moderated caucus ---------- */
assert.ok(ch.modError(600, 600), "speaking time equal to the caucus is not allowed");
assert.ok(ch.modError(600, 70), "must fit evenly");
assert.ok(ch.modError(1260, 60), "at most 20 minutes");
assert.ok(ch.modError(600, 4));
assert.equal(ch.modError(600, 60), null);
assert.equal(ch.callMod(c, "Verification", 600, 70), c, "an invalid caucus is refused");
const listed = ch.addToList(c, id("Egypt"), "for");
c = ch.callMod(listed, "Verification", 600, 60);
assert.equal(c.step, "caucus"); assert.equal(c.tr!.cauc!.kind, "mod"); assert.equal(c.debate.list.length, 0, "the caucus has its own list");
assert.equal(c.tr!.saved!.list.length, 2, "the general list (Denmark, Egypt) is kept aside");
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
assert.equal(ch.extendCaucus({ ...over, tr: { ...over.tr!, cauc: { ...over.tr!.cauc!, clock: { ...over.tr!.cauc!.clock!, left: 0 } } } }, 700, AT).tr!.cauc!.ext, 1, "no longer than the original");
const two = { ...over, tr: { ...over.tr!, cauc: { ...over.tr!.cauc!, ext: 2, clock: { ...over.tr!.cauc!.clock!, left: 0 } } } };
assert.equal(ch.extendCaucus(two, 60, AT), two, "at most two");
c = ch.closeMod(c);
assert.equal(c.step, "general"); assert.equal(c.tr!.cauc, null); assert.equal(c.debate.list.length, 2, "the general list is back"); assert.equal(c.debate.list[0].id, id("Denmark"));
assert.equal(c.tr!.saved, null);
c = ch.removeFromList(ch.removeFromList(c, id("Egypt")), id("Denmark"));

/* ---------- motions: queue, order, voting ---------- */
assert.ok(ch.motionError(c, { kind: "mod", by: id("India"), topic: "", total: 600, per: 60 }));
assert.ok(ch.motionError(c, { kind: "unmod", by: id("India"), total: 1500 }));
assert.ok(ch.motionError(c, { kind: "close", by: null }), "close debate belongs to the draft resolution debate");
c = ch.addMotion(c, "m1", { kind: "unmod", by: id("India"), total: 600 });
c = ch.addMotion(c, "m2", { kind: "mod", by: id("Japan"), topic: "Funding", total: 300, per: 30 });
c = ch.addMotion(c, "m3", { kind: "suspend", by: null });
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
c = ch.endCaucus(c); assert.equal(c.step, "general");
c = ch.voteMotion(c, "m2"); c = ch.tally(c, "no", 1);
c = ch.decideMotion(c, null, "m2");
assert.equal(c.step, "general"); assert.equal(c.tr!.motions.find((m) => m.id === "m2")!.status, "failed");
c = ch.addMotion(c, "m4", { kind: "mod", by: id("Japan"), topic: "Funding", total: 300, per: 30 });
c = ch.voteMotion(c, "m4"); c = ch.tally(c, "no", 1);
c = ch.decideMotion(c, "for", "m4"); // the chair overrules
assert.equal(c.step, "caucus"); assert.equal(c.tr!.cauc!.kind, "mod");
assert.ok(c.log.some((e) => /overruled/.test(e.text)));
assert.equal(ch.closeMod(c), c, "the motion to close needs three speakers first");
c = ch.endCaucus(c); // the chair can still end it when the time is up
assert.equal(c.step, "general");
c = { ...c, step: "general", after: null, tr: { ...c.tr!, cauc: null, saved: null }, debate: ch.emptyDebate() };

/* ---------- documents ---------- */
const sign = (x: ch.Chamber, d: string, who: string[]) => who.reduce((y, w) => ch.signDoc(y, d, w, true), x);
c = ch.addDoc(c, "p1", { kind: "paper", title: "Ideas", week: 1, seen: false, proposer: id("India"), seconder: null, sponsors: [], link: "", clauses: "" });
assert.equal(c.tr!.docs.length, 0, "a working paper needs a co-sponsor");
c = ch.addDoc(c, "p1", { kind: "paper", title: "Ideas", week: 1, seen: false, proposer: id("India"), seconder: null, sponsors: [id("Japan")], link: "javascript:alert(1)", clauses: "x" });
assert.equal(c.tr!.docs[0].link, "", "only web links are kept");
assert.equal(c.tr!.docs[0].status, "approved");
c = ch.addDoc(c, "d1", { kind: "draft", title: "Resolution on Verification", week: 1, seen: true, proposer: id("China"), seconder: id("Denmark"), sponsors: [id("Egypt")], link: "https://example.com/x", clauses: "1. Requests...;" });
assert.equal(ch.addDoc(c, "d2", { kind: "draft", title: "Same", week: 1, seen: true, proposer: id("China"), seconder: id("China"), sponsors: [], link: "", clauses: "" }).tr!.docs.length, 2, "proposer and seconder differ");
assert.equal(ch.signNeeded(c), 4, "a quarter of 16 present");
assert.equal(ch.approveDoc(c, "d1").tr!.docs[1].status, "submitted", "3 of 4 signatures isn't enough");
c = sign(c, "d1", [id("France"), id("Egypt")]);
assert.equal(ch.docSigners(c.tr!.docs[1]).length, 4);
c = ch.sendBackDoc(c, "d1"); assert.equal(c.tr!.docs[1].status, "sent");
c = ch.resubmitDoc(c, "d1");
c = ch.approveDoc(c, "d1"); assert.equal(c.tr!.docs[1].status, "approved");
assert.equal(ch.introduceDraft(ch.setObserver(c, id("China")), "d1").step, "general", "an observer can't propose");
c = ch.introduceDraft(c, "p1"); assert.equal(c.step, "general", "a working paper is not introduced");
// introduced by a passed motion
c = ch.addMotion(c, "m5", { kind: "draft", by: id("China"), ref: "d1" });
c = ch.voteMotion(c, "m5"); c = ch.tally(c, "yes", 1); c = ch.decideMotion(c, null, "m5");
assert.equal(c.step, "pick"); assert.equal(c.tr!.current, "d1");
assert.deepEqual(c.roles, { proposer: id("China"), seconder: id("Denmark"), opposer: null });
assert.equal(c.topic, "Removal of Nuclear Weapons", "the committee's topic stays");
assert.ok(ch.removeDoc(c, "d1").tr!.docs.some((d) => d.id === "d1"), "the draft in hand stays");

/* ---------- introduction speeches ---------- */
c = ch.pickRole(c, "opposer", id("India"));
c = ch.startSpeeches(c); assert.equal(c.step, "proposer");
c = ch.callProposer(c); assert.equal(c.timer!.total, 120_000, "experienced: 2 minutes");
c = ch.endSpeech(c, AT, id("China")); c = ch.yieldToChair(c, id("China"), 0);
assert.equal(c.step, "seconder");
c = ch.callSeconder(c); assert.equal(c.timer!.total, 120_000);
c = ch.endSpeech(c, AT, id("Denmark")); c = ch.yieldToChair(c, id("Denmark"), 0);
assert.equal(c.step, "opposer");
c = ch.callOpposer(c); assert.equal(c.timer!.total, 120_000);
c = ch.endSpeech(c, AT, id("India")); c = ch.yieldToChair(c, id("India"), 0);
assert.equal(c.step, "caucus"); assert.equal(c.timer!.total, 300_000, "5 minutes unmoderated"); assert.equal(c.after, "floor");
assert.equal(c.tr!.cauc!.kind, "unmod");
assert.deepEqual(ch.rooms(c).labels, ["Amendments open"], "an unmoderated caucus on the draft is not named; amendments are open");
c = ch.endCaucus(c); assert.equal(c.step, "floor");
assert.equal(ch.stageIndex(c), 2);
assert.deepEqual(ch.rooms(c).labels, ["Speakers’ list open", "Amendments open"]);

/* ---------- the draft resolution's speakers' list and amendments ---------- */
assert.equal(ch.sided(c), true);
c = ch.addToList(c, id("Kenya"), "against"); c = ch.addToList(c, id("Mexico"), "for");
assert.equal(ch.addToList(c, id("Mexico"), "against").debate.list.length, 2);
// amendments need a seconder and a quarter of the states
const am = (x: ch.Chamber, aid: string, by: string, clause: string, backers: string[], sec: string | null, cons = false) => ch.submitAmendment(x, aid, by, clause, "Change it", backers, sec, cons);
assert.equal(am(c, "a0", id("Egypt"), "Clause 1", [id("France")], null).amendments.length, 0, "needs a seconder");
assert.equal(am(c, "a0", id("Egypt"), "Clause 1", [id("France")], id("Germany")).amendments.length, 0, "3 of 4 signatures");
c = am(c, "a1", id("Egypt"), "Clause 1", [id("France")], id("Germany")); // 3 signatures: refused
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
assert.equal(am(obs, "a4", id("Japan"), "Clause 5", [id("Sweden"), id("UK")], id("Vietnam")).amendments.length, 3);
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

/* ---------- the final vote: Security Council ---------- */
const vote = (x: ch.Chamber, yes: string[], no: string[], abst: string[]) => {
  for (const d of x.delegates) x = ch.cast(x, d.id, yes.includes(d.name) ? "for" : no.includes(d.name) ? "against" : abst.includes(d.name) ? "abstain" : "for");
  return x;
};
assert.equal(ch.cast(c, id("Brazil"), "abstain").ballots[id("Brazil")], undefined, "Present and Voting can't abstain");
assert.equal(ch.cast(c, id("Kenya"), "abstain").ballots[id("Kenya")], "abstain", "Present can");
assert.equal(ch.finishVote(c).step, "vote", "everyone votes first");
// Ten For (every permanent member among them), five Against who aren't permanent members, Kenya abstaining.
const NO5 = ["Sweden", "Vietnam", "Germany", "Egypt", "Denmark"];
const sc = (extraNo: string[] = []) => {
  const against = [...NO5, ...extraNo];
  const forNames = names.filter((n) => !against.includes(n) && n !== "Kenya");
  return ch.finishVote(vote(c, forNames, against, ["Kenya"]));
};
let r = sc(); // 10 for, 5 against, 1 abstain: 10 >= ceil(2*15/3)=10
assert.equal(r.outcome!.passed, true); assert.equal(r.outcome!.needed, 10);
assert.equal(r.tr!.docs.find((d) => d.id === "d1")!.result, "passed");
r = sc(["Mexico"]); assert.equal(r.outcome!.passed, false, "below two thirds"); assert.equal(r.tr!.docs.find((d) => d.id === "d1")!.result, "failed");
// a permanent member against is a veto even with plenty For
{
  let x = c;
  for (const d of x.delegates) x = ch.cast(x, d.id, d.name === "USA" ? "against" : "for");
  x = ch.finishVote(x);
  assert.equal(x.outcome!.passed, false); assert.deepEqual(x.outcome!.vetoed, ["USA"]);
  assert.equal(x.tr!.docs.find((d) => d.id === "d1")!.result, "vetoed");
  assert.ok(x.log.at(-1)!.text.includes("vetoed by USA"));
  // two vetoes
  let y = c;
  for (const d of y.delegates) y = ch.cast(y, d.id, d.name === "China" || d.name === "UK" ? "against" : "for");
  assert.deepEqual(ch.finishVote(y).outcome!.vetoed, ["China", "UK"]);
  // a permanent member abstaining is not a veto
  let z = c;
  for (const d of z.delegates) z = ch.cast(z, d.id, d.name === "Russia" ? "for" : "for");
  z = ch.cast(z, id("Kenya"), "abstain");
  assert.equal(ch.finishVote(z).outcome!.passed, true);
}
// the names are recognised however they were typed
assert.equal(ch.permanent("Russian Federation"), "Russia"); assert.equal(ch.permanent("United States of America"), "USA"); assert.equal(ch.permanent("Denmark"), null);
// reopening the vote clears the draft's result
let done = sc();
assert.equal(ch.reopenVote(done).tr!.docs.find((d) => d.id === "d1")!.result, null);

/* ---------- after the vote: back to general debate, then week 2 ---------- */
c = done;
assert.equal(ch.nextWeek(c).tr!.week, 2, "week 2 can start after a resolution");
const g = ch.backToGeneral(c);
assert.equal(g.step, "general"); assert.equal(g.tr!.current, null); assert.equal(g.amendments.length, 0); assert.equal(g.outcome, null);
assert.equal(g.tr!.docs.find((d) => d.id === "d1")!.result, "passed", "the result stays on the draft");
assert.equal(ch.introduceDraft(g, "d1").step, "general", "a decided draft isn't introduced again");
const w2 = ch.nextWeek(g);
assert.equal(w2.step, "roll"); assert.equal(w2.tr!.week, 2); assert.deepEqual(w2.roll, {});
assert.equal(Object.keys(w2.tr!.rolls["1"]).length, 16, "week 1's roll is kept");
assert.equal(w2.tr!.docs.length, 3 - 1, "documents carry over"); // p1 and d1
assert.equal(ch.nextWeek(w2).tr!.week, 2, "there is no week 3");
assert.ok(w2.stats.length > 0);
const w2on = ch.beginDebate(ch.markAllRoll(w2, "voting"));
assert.equal(w2on.step, "general");
{ // stats made in week 2 are marked
  const s2 = ch.callStatement(ch.startStatements(w2on), id("Australia"));
  const s3 = ch.endSpeech(ch.startTimer(s2, AT), AT + 5000, id("Australia"));
  assert.equal(s3.stats.at(-1)!.wk, 2);
}

/* ---------- right of reply ---------- */
{
  let x = ch.callSpeaker(ch.addToList(g, id("Japan"), "for"), id("Japan"), "for");
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
  const b = ch.beginDebate(ch.markAllRoll(ch.startRoll(ch.createTrinity("GA", "Water", "beginner", 60, names, ids)), "voting"));
  let d = ch.addDoc(b, "d9", { kind: "draft", title: "Water", week: 1, seen: true, proposer: id("Australia"), seconder: id("Brazil"), sponsors: [id("China"), id("Denmark")], link: "", clauses: "" });
  d = ch.introduceDraft(ch.approveDoc(d, "d9"), "d9");
  d = ch.startSpeeches(d);
  d = ch.callProposer(d); assert.equal(d.timer!.total, 90_000, "beginner: 90 seconds");
  d = ch.endSpeech(d, AT, id("Australia")); d = ch.yieldToChair(d, id("Australia"), 0);
  d = ch.callSeconder(d); assert.equal(d.timer!.total, 90_000);
  d = ch.endSpeech(d, AT, id("Brazil")); d = ch.yieldToChair(d, id("Brazil"), 0);
  assert.equal(d.step, "caucus", "no opposer: straight to the 5-minute caucus");
  // general assembly: simple majority, abstentions don't count, a permanent member against is not a veto
  let v = ch.startVote(ch.closeDebate(ch.endCaucus(d)));
  v = { ...v, step: "vote" };
  for (const x of v.delegates) v = ch.cast(v, x.id, x.name === "USA" || x.name === "Russia" ? "against" : "for");
  const out = ch.finishVote(v).outcome!;
  assert.equal(out.passed, true); assert.equal(out.vetoed, undefined);
  let t = v;
  for (const x of t.delegates) t = ch.cast(t, x.id, x.name === "China" ? "for" : "against");
  assert.equal(ch.finishVote(t).outcome!.passed, false);
  let eq = v; // exactly as many For as Against fails
  const half = eq.delegates.length / 2;
  eq.delegates.forEach((x, i) => { eq = ch.cast(eq, x.id, i < half ? "for" : "against"); });
  assert.equal(ch.finishVote(eq).outcome!.passed, false);
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

console.log("ALL TRINITY CHECKS PASSED");
