import * as ch from "./chamber.ts";
import { flagCode } from "./flags.ts";
import { writeFileSync } from "node:fs";
const ok = (v: unknown, m: string) => { if (!v) { console.error("FAIL", m); process.exit(1); } };
const names = ["Australia", "Brazil", "China", "France", "UK", "USA", "DRC", "Observer Group"];
let c = ch.createStandard("DISEC", "Autonomous weapons", 60, names, names.map((_, i) => `d${i}`));
ok(ch.procedureName(c) === "Standard", "name");
ok(ch.normalise(JSON.parse(JSON.stringify(c)))?.style === "standard", "normalise keeps style");
c = ch.startRoll(c); c = ch.markAllRoll(c, "present"); c = ch.beginDebate(c);
ok(c.step === "statements", "statements after roll: " + c.step);
ok(ch.callNextSpeaker(c).speech?.who === ch.nextStatement(c) && ch.callNextSpeaker(c).speech?.role === "statement", "N calls the next opening statement");
c = ch.endStatements(c); ok(c.step === "general", "general: " + c.step);
c = ch.addDraft(c, "x1", "Draft 1.1"); ok(c.tr!.docs.length === 1, "draft added");
c = ch.addDraft(c, "x2", "Draft 1.2"); c = ch.removeDraft(c, "x2"); ok(c.tr!.docs.length === 1, "draft removed");
c = ch.introduceDraft(c, "x1"); ok(c.step === "pick", "introduced: " + c.step);
// scores
c = ch.setScore(c, "d0", { speaking: 8, diplomacy: 12 }); ok(ch.scoreTotal(ch.scoreOf(c, "d0")) === 18, "score clamp");
// roll-call poll
let m = ch.createStandard("X", "T", 60, names, names.map((_, i) => `d${i}`));
m = ch.endStatements(ch.beginDebate(ch.markAllRoll(ch.startRoll(m), "present")));
m = ch.addMotion(m, "m1", { kind: "unmod", by: "d1", total: 300 });
ok(ch.waitingMotions(m).length === 1, "motion added " + ch.motionError(m, { kind: "unmod", by: "d1", total: 300 }));
m = ch.voteMotion(m, "m1"); ok(m.poll?.kind === "motion", "poll open");
m = ch.pollByRoll(m, true); m = ch.pollCast(m, "d0", "for"); m = ch.pollCast(m, "d1", "for"); m = ch.pollCast(m, "d2", "against");
ok(m.poll!.yes === 2 && m.poll!.no === 1, "roll counts");
m = ch.decideMotion(m, null, "m1"); ok(m.log.at(-1)!.text.includes("By roll call. For: Australia, Brazil"), "roll in minutes: " + m.log.at(-1)!.text);
// two-thirds
let k = ch.createStandard("X", "T", 60, names, names.map((_, i) => `d${i}`), ["R1"], { pass: "twothirds" });
ok(ch.procedureName(k) === "Custom" && k.tr!.docs.length === 1, "custom");
ok(flagCode("the Democratic Republic of the Congo") === "cd" && flagCode("Côte d'Ivoire") === "ci" && flagCode("Observer Group") === null && flagCode("United States of America") === "us" && flagCode("Türkiye") === "tr", "flags");
if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify(c));
// a delegate's request, accepted by the chair
import("./room.ts").then(({ acceptAsk, voteKey }) => {
  let g = ch.endStatements(ch.beginDebate(ch.markAllRoll(ch.startRoll(ch.createStandard("X", "T", 60, names, names.map((_, i) => `d${i}`))), "present")));
  const ask = (kind: string, body: Record<string, unknown>, who = "d2") => ({ id: "a", delegate_id: who, kind, body, status: "open", created_at: "" }) as never;
  let r = acceptAsk(g, ask("floor", {}), "n1"); ok(r.next !== g && r.next.debate.list.some((x) => x.id === "d2"), "floor accepted: " + r.why); g = r.next;
  r = acceptAsk(g, ask("floor", {}), "n2"); ok(r.next === g && !!r.why, "floor twice refused");
  r = acceptAsk(g, ask("motion", { kind: "mod", topic: "Drones", total: 600, per: 60 }), "n3"); ok(r.next !== g && ch.waitingMotions(r.next).length === 1, "motion accepted: " + r.why); g = r.next;
  r = acceptAsk(g, ask("motion", { kind: "mod", topic: "", total: 600, per: 60 }), "n4"); ok(r.next === g && !!r.why, "bad motion refused");
  r = acceptAsk(g, ask("point", { kind: "order" }), "n5"); ok(r.next !== g, "point noted");
  r = acceptAsk(g, ask("floor", {}, "gone"), "n6"); ok(r.next === g, "removed state refused");
  ok(voteKey(g) === null, "no vote key"); g = ch.voteMotion(g, "n3"); ok(voteKey(g) === "poll|motion|n3|", "vote key " + voteKey(g));
  // accepting the same request twice (two chairs, or a save replayed on a newer copy) adds one motion, not two
  const once = (x: ch.Chamber, a: never & { id: string }) => (ch.holds(x, a.id) ? x : acceptAsk(x, a, a.id).next);
  let h = ch.endStatements(ch.beginDebate(ch.markAllRoll(ch.startRoll(ch.createStandard("X", "T", 60, names, names.map((_, i) => `d${i}`))), "present")));
  const mo = { id: "ask-1", delegate_id: "d1", kind: "motion", body: { kind: "unmod", total: 300 }, status: "open", created_at: "" } as never as never & { id: string };
  h = once(h, mo); ok(ch.waitingMotions(h).length === 1 && ch.holds(h, "ask-1"), "motion from request");
  ok(once(h, mo) === h, "same request accepted twice adds nothing");
  const fl = { ...h, step: "floor", tr: { ...h.tr!, current: "res0" } } as ch.Chamber; // a resolution on the floor: amendments open
  const am = { id: "ask-2", delegate_id: "d3", kind: "amendment", body: { how: "amend", clause: "OC 1", text: "Change it", seconder: "d4" }, status: "open", created_at: "" } as never as never & { id: string };
  const h2 = once(fl, am);
  ok(h2 !== fl && ch.holds(h2, "ask-2") && h2.amendments.length === 1, "amendment from request carries its id");
  ok(once(h2, am) === h2, "same amendment request accepted twice adds nothing");
  console.log("STD OK");
});

// Saving: the minutes and the steps kept for Back stay well under the database's limit, the newest kept.
let w0Last: ch.Chamber | null = null;
const w0 = () => (w0Last ??= ch.createStandard("S", "T", 60, names, names.map((_, i) => `d${i}`)));
{
  let z = ch.createStandard("Big", "T", 60, names, names.map((_, i) => `d${i}`));
  for (let i = 0; i < ch.LOG_MAX + 50; i++) z = ch.note(z, `Line ${i} `.padEnd(120, "x"));
  ok(z.log.length === ch.LOG_MAX && z.log.at(-1)!.text.startsWith(`Line ${ch.LOG_MAX + 49} `), "minutes capped, newest kept: " + z.log.length);
  // a big agenda: each step kept for Back is big too
  z = { ...z, tr: { ...z.tr!, docs: z.tr!.docs.concat(Array.from({ length: 4 }, (_, i) => ({ ...z.tr!.docs[0] ?? {}, id: `big${i}`, kind: "draft", title: "T", week: 1, seen: true, proposer: null, seconder: null, sponsors: [], status: "approved", link: "", clauses: "c".repeat(6000), at: i, from: [], result: null } as never))) } };
  let y = z;
  for (let i = 0; i < 30; i++) y = ch.remember(y, ch.note(y, `Step ${i}`));
  const len = JSON.stringify(y).length;
  ok(len <= ch.SIZE_BUDGET, "committee stays under the budget: " + len);
  ok((y.hist?.length ?? 0) >= 1 && (y.hist?.length ?? 0) <= ch.HISTORY, "some steps kept for Back: " + y.hist?.length);

  // Back cuts the minutes to where they were, exactly as restoring the whole copy did
  const before = y.log.length;
  const back = ch.goBack(y, ch.now());
  ok(back.log.length === before && back.log.at(-2)!.text === "Step 28" && back.log.at(-1)!.text === "Went back one step", "Back restores the minutes: " + back.log.at(-2)?.text);
  // Back twice: each time the minutes are exactly as they were
  const back2 = ch.goBack(back, ch.now());
  ok((y.hist!.length < 2 && back2 === back) || back2.log.at(-2)!.text === "Step 27", "Back twice: " + back2.log.at(-2)?.text);
  // a committee saved before the limits (every step with all its minutes) is brought under the budget, newest steps kept
  const fat = { ...z, hist: Array.from({ length: 12 }, (_, i) => ({ ...z, hist: undefined, step: `s${i}` })) } as unknown as ch.Chamber;
  ok(JSON.stringify(fat).length > 262144, "old committee is over the limit");
  const slim = ch.fit(fat);
  ok(JSON.stringify(slim).length <= ch.SIZE_BUDGET && (slim.hist!.length === 0 || (slim.hist!.at(-1) as unknown as { step: string }).step === "s11"), "fit brings it under, newest kept: " + JSON.stringify(slim).length);
  ok(ch.fit(slim) === slim && ch.fit(w0()) === w0Last, "fit leaves a small committee alone");
  // a step kept the old way, with its own minutes, still goes back
  const old = { ...y, hist: [{ ...y, hist: undefined, log: y.log.slice(0, 3) }] } as ch.Chamber;
  ok(ch.goBack(old, ch.now()).log.length === 4, "old-style step");
  // small committees keep all twelve steps
  let w = ch.createStandard("S", "T", 60, names, names.map((_, i) => `d${i}`));
  for (let i = 0; i < 20; i++) w = ch.remember(w, ch.note(w, `s${i}`));
  ok(w.hist!.length === ch.HISTORY, "twelve steps: " + w.hist!.length);
  // every step is a whole copy with its own minutes, so a console on the older version goes back the same way
  ok(w.hist!.every((h, i) => h.log.length === w.log.length - (w.hist!.length - i)), "each step keeps its own minutes");
  // a photo kept in this browser doesn't count towards the size, so Back still works with one
  let ph = { ...ch.createStandard("P", "T", 60, names, names.map((_, i) => `d${i}`)), background: "data:image/jpeg;base64," + "A".repeat(300000) } as ch.Chamber;
  for (let i = 0; i < 5; i++) ph = ch.remember(ph, ch.note(ph, `p${i}`));
  ok(ph.hist!.length === 5, "Back works with a big photo: " + ph.hist!.length);
  // many Backs in a row past the cap never lose a line they should have
  let q = ch.createStandard("Q", "T", 60, names, names.map((_, i) => `d${i}`));
  for (let i = q.log.length; i < ch.LOG_MAX - 3; i++) q = ch.note(q, `f${i}`);
  for (let i = 0; i < 6; i++) q = ch.remember(q, ch.note(q, `a${i}`));
  for (let i = 5; i >= 1; i--) { q = ch.goBack(q, ch.now()); ok(q.log.at(-2)!.text === `a${i - 1}`, `Back ${6 - i} past the cap: ` + q.log.at(-2)?.text); }
  ok(ch.goBack(w, ch.now()).log.map((e) => e.text).join("|") === [...w.log.slice(0, -1).map((e) => e.text), "Went back one step"].join("|"), "small Back");
}
{ // a request acted on is remembered, so accepting it twice adds nothing
  const a0 = w0();
  const a1 = ch.asked(ch.note(a0, "Point of order"), "ask-1");
  ok(ch.holds(a1, "ask-1") && !ch.holds(a0, "ask-1") && ch.asked(a1, "ask-1") === a1, "asked is remembered once");
  let many = a0; for (let i = 0; i < 200; i++) many = ch.asked(many, `k${i}`);
  ok(many.asked!.length === 80 && ch.holds(many, "k199") && !ch.holds(many, "k0"), "only the latest requests are kept: " + many.asked!.length);
  ok(ch.normalise(JSON.parse(JSON.stringify(a1)))?.asked?.[0] === "ask-1", "kept through a save");
}
// 7. Motions in order of precedence, each with the votes it needs (8 present: a majority is 5, two-thirds is 6).
{
  let p = ch.createStandard("X", "T", 60, names, names.map((_, i) => `d${i}`));
  p = ch.endStatements(ch.beginDebate(ch.markAllRoll(ch.startRoll(p), "present")));
  p = ch.addMotion(p, "a", { kind: "mod", by: "d1", topic: "Drones", total: 600, per: 60 });
  p = ch.addMotion(p, "b", { kind: "unmod", by: "d2", total: 300 });
  p = ch.addMotion(p, "c", { kind: "unmod", by: "d3", total: 600 });
  ok(ch.waitingMotions(p).map((x) => x.id).join() === "c,b,a", "precedence: the longer unmoderated caucus first, the moderated last: " + ch.waitingMotions(p).map((x) => x.id).join());
  ok(ch.motionNeeds(p, "unmod") === 5 && ch.motionNeeds(p, "close") === 6, "thresholds " + ch.motionNeeds(p, "unmod") + " " + ch.motionNeeds(p, "close"));
  ok(ch.motionNeedsText(p, "close") === "Needs 6 For (two-thirds of 8 present)", "needs text: " + ch.motionNeedsText(p, "close"));
  ok(ch.motionPasses(p, { yes: 4, no: 1, motion: "b" }) === false && ch.motionPasses(p, { yes: 5, no: 3, motion: "b" }) === true, "a majority of those present");
  const absent = ch.markRoll(ch.markRoll(p, "d6", "absent"), "d7", "absent");
  ok(ch.motionNeeds(absent, "close") === 4 && ch.motionNeeds(absent, "mod") === 4, "absent states don't count: " + ch.motionNeeds(absent, "close"));
  ok(ch.motionNeeds(ch.createTrinity("F", "T", 90, names, names.map((_, i) => `d${i}`)), "close") === null, "Trinity: more For than Against");
  // Retake the Roll from the general debate, back to the general debate after.
  ok(ch.canRetakeRoll(p), "retake allowed in the general debate");
  const r = ch.beginDebate(ch.markAllRoll(ch.retakeRoll(p, 7), "present"));
  ok(r.step === "general" && !!r.tr!.rolls["7"], "retake goes back to general: " + r.step);
}
// Which refused saves are worth sending again
ok(ch.savePermanent("23514", 400) && ch.savePermanent("22P02", 400) && ch.savePermanent("P0001", 400) && ch.savePermanent("PGRST202", 404), "permanent errors");
ok(!ch.savePermanent("", 0) && !ch.savePermanent(undefined, undefined) && !ch.savePermanent("PGRST301", 401) && !ch.savePermanent("PGRST303", 401)
  && !ch.savePermanent("57014", 500) && !ch.savePermanent("40001", 409) && !ch.savePermanent("", 503) && !ch.savePermanent("08006", 503) && !ch.savePermanent("PGRST001", 503), "worth retrying");

// 8. Quorum: a third of the member states to open debate, a majority for a vote on a resolution (rounding up).
{
  ok(ch.quorumToDebate(40) === 14 && ch.quorumToVote(40) === 21, "40 states: 14 and 21");
  ok(ch.quorumToDebate(12) === 4 && ch.quorumToVote(12) === 7, "12 states: 4 and 7");
  ok(ch.quorumToDebate(13) === 5 && ch.quorumToVote(13) === 7, "13 states: 5 and 7");
  ok(ch.quorumToDebate(1) === 1 && ch.quorumToVote(1) === 1, "1 state");
  let q = ch.startRoll(ch.createStandard("Q", "T", 60, names, names.map((_, i) => `d${i}`)));
  ok(ch.quorum(q, "debate").present === 0 && !ch.quorum(q, "debate").met, "nobody marked: no quorum at roll call");
  q = ch.markRoll(ch.markRoll(q, "d0", "present"), "d1", "voting");
  ok(ch.quorum(q, "debate").present === 2 && ch.quorum(q, "debate").needed === 3 && !ch.quorum(q, "debate").met, "2 of 8, 3 needed");
  q = ch.markRoll(q, "d2", "present");
  ok(ch.quorum(q, "debate").met, "3 of 8 opens debate");
  ok(ch.quorumText(ch.quorum(q, "debate"), "debate") === "Quorum: 3 of 8 present, 3 needed to open debate", ch.quorumText(ch.quorum(q, "debate"), "debate"));
  const after = ch.beginDebate(q); // after the roll, unmarked states count as present, as everywhere else
  ok(after.step === "statements" && ch.quorum(after, "vote").present === 8 && ch.quorum(after, "vote").needed === 5, "after the roll");
}
// A committee on its way to the vote on a resolution.
const toVote = (custom?: { pass: "simple" | "twothirds" }) => {
  let v = ch.createStandard("V", "T", 60, names, names.map((_, i) => `d${i}`), ["R1"], custom);
  v = ch.endStatements(ch.beginDebate(ch.markAllRoll(ch.startRoll(v), "present")));
  v = ch.introduceDraft(v, "res0");
  v = { ...v, step: "closing" } as ch.Chamber;
  return ch.startVote(v);
};
// 9. Roll-call answers: Pass (asked again, then For or Against only), and For or Against with Rights (counted, then explained).
{
  let v = toVote();
  ok(v.step === "vote", "voting");
  v = ch.answer(v, "d0", "pass");
  ok(ch.answerOf(v, "d0") === "pass" && ch.count(v).left === 8 && ch.secondRound(v).join() === "d0", "pass leaves the state to vote");
  ok(ch.answer(v, "d0", "pass") === v, "a state passes once");
  v = ch.answer(v, "d1", "forRights"); v = ch.answer(v, "d2", "againstRights"); v = ch.answer(v, "d3", "for");
  v = ch.answer(v, "d4", "abstain"); v = ch.answer(v, "d5", "for"); v = ch.answer(v, "d6", "against"); v = ch.answer(v, "d7", "for");
  ok(ch.count(v).yes === 4 && ch.count(v).no === 2 && ch.count(v).abstain === 1 && ch.count(v).left === 1, "rights count as For and Against: " + JSON.stringify(ch.count(v)));
  ok(ch.answerOf(v, "d1") === "forRights" && ch.answerOf(v, "d3") === "for", "answers read back");
  ok(ch.finishVote(v) === v, "can't record while a state that passed has still to vote");
  ok(ch.answer(v, "d0", "abstain") === v && ch.cast(v, "d0", "abstain") === v, "second round: no abstaining (from a device too)");
  v = ch.answer(v, "d0", "against");
  ok(ch.count(v).left === 0 && ch.secondRound(v).length === 0, "second round done");
  const plain = ch.answer(v, "d1", "for");
  ok(!plain.rights!.includes("d1") && ch.answerOf(plain, "d1") === "for", "plain For drops the rights");
  v = ch.finishVote(v);
  ok(v.step === "closed" && v.outcome!.passed && v.outcome!.yes === 4 && v.outcome!.no === 3, "result: " + JSON.stringify(v.outcome));
  ok(v.explain!.queue.map((x) => `${x.id}:${x.side}`).join() === "d1:for,d2:against" && v.explain!.who === null, "explanations waiting");
  v = ch.callExplain(v, "d1");
  ok(v.explain!.who?.id === "d1" && v.timer!.total === 30000, "30 seconds to explain");
  ok(ch.callExplain(v, "d2") === v, "one at a time");
  v = ch.endExplain(v, "d1");
  ok(v.explain!.queue.length === 1 && !v.timer, "first done");
  v = ch.skipExplain(v, "d2");
  ok(!v.explain, "skipped, nothing left");
  ok(ch.reopenVote(v).step === "vote", "reopen still works");
  // undo with null: clears the ballot, or the pass
  let u = toVote(); u = ch.answer(u, "d0", "pass"); u = ch.answer(u, "d0", null);
  ok(!u.passed!.length && ch.answerOf(u, "d0") === null, "pass taken back");
  // absent states and committees under other rules answer nothing new
  ok(ch.answer(ch.markRoll({ ...u, step: "closing" } as ch.Chamber, "d3", "absent"), "d3", "pass").passed?.includes("d3") !== true, "absent can't pass");
  const ev = { ...ch.create("E", "R", 60, names, names.map((_, i) => `d${i}`)), step: "vote" } as ch.Chamber;
  ok(ch.answer(ev, "d0", "pass") === ev && ch.answer(ev, "d0", "forRights") === ev, "Evatt: no Pass or Rights");
  const tv = { ...ch.createTrinity("T", "R", 60, names, names.map((_, i) => `d${i}`)), step: "vote" } as ch.Chamber;
  ok(ch.answer(tv, "d0", "pass") === tv, "Trinity: no Pass");
}
// 10. Dividing the question: each part voted on in turn (a part that fails is struck), then the rest as a whole.
{
  let v = toVote();
  ok(ch.canDivide(v), "can divide before anyone votes");
  ok(ch.divideQuestion(v, ["", "  "]) === v, "no parts, no division");
  v = ch.divideQuestion(v, ["Clause 2", "Clause 4"]);
  ok(ch.partText(v) === "Part 1 of 2: Clause 2" && !ch.canDivide(v), "part 1: " + ch.partText(v));
  ok((await import("./room.ts")).voteKey(v)!.endsWith("|p0"), "each part has its own device vote");
  const all = (x: ch.Chamber, b: ch.Ballot[]) => b.reduce((y, ballot, i) => ch.answer(y, `d${i}`, ballot), x);
  v = all(v, ["for", "for", "for", "for", "for", "against", "against", "against"]);
  v = ch.finishVote(v);
  ok(v.step === "vote" && v.divide!.parts[0].result === "passed" && !Object.keys(v.ballots).length && ch.partText(v) === "Part 2 of 2: Clause 4", "part 1 kept, on to part 2");
  ok(v.log.at(-1)!.text.startsWith("Part 1 of the resolution (Clause 2) kept: 5 for"), v.log.at(-1)!.text);
  v = ch.answer(v, "d0", "forRights");
  v = all(v, ["for", "against", "against", "against", "against", "against", "for", "for"]);
  v = ch.answer(v, "d0", "forRights");
  v = ch.finishVote(v);
  ok(v.divide!.parts[1].result === "failed" && v.log.at(-1)!.text.includes("(Clause 4) struck"), "part 2 struck");
  ok(v.explain?.queue[0].id === "d0", "rights explained after a part, too");
  v = ch.skipExplain(v, "d0");
  ok(ch.partText(v) === "The rest of the resolution, as a whole" && ch.divisionPart(v) === null, "then the rest");
  v = all(v, ["for", "for", "for", "for", "for", "for", "against", "abstain"]);
  v = ch.finishVote(v);
  ok(v.step === "closed" && v.outcome!.passed && v.outcome!.struck?.join() === "Clause 4", "the rest passes, clause 4 struck");
  ok(v.log.at(-1)!.text === "Struck from the resolution: Clause 4", v.log.at(-1)!.text);
  // two-thirds applies to each part in Custom
  let k2 = ch.divideQuestion(toVote({ pass: "twothirds" }), ["Clause 1"]);
  k2 = all(k2, ["for", "for", "for", "for", "against", "against", "against", "abstain"]);
  ok(ch.finishVote(k2).divide!.parts[0].result === "failed", "Custom two-thirds: 4 of 7 isn't enough");
  ok(ch.standardNeed(k2, { yes: 4, no: 3 }).need === 5 && ch.standardNeed(toVote(), { yes: 4, no: 3 }).passed, "the rule matches the resolution's");
  // undo before the first vote; and back to the resolutions clears the division
  const d = ch.divideQuestion(toVote(), ["A"]);
  ok(!ch.undivide(d).divide, "undivided");
  ok(!ch.backToGeneral(v).divide && !ch.backToGeneral(v).passed, "cleared for the next resolution");
  const ev = { ...ch.create("E", "R", 60, names, names.map((_, i) => `d${i}`)), step: "vote" } as ch.Chamber;
  ok(ch.divideQuestion(ev, ["A"]) === ev, "Evatt: no division");
}
// 11. Amendments to amendments: one at a time, debated and voted on first; if it passes, the amendment's wording changes.
{
  let a = ch.createStandard("A", "T", 60, names, names.map((_, i) => `d${i}`), ["R1"]);
  a = ch.endStatements(ch.beginDebate(ch.markAllRoll(ch.startRoll(a), "present")));
  a = { ...ch.introduceDraft(a, "res0"), step: "floor" } as ch.Chamber;
  a = ch.submitAmendment(a, "am1", "d0", "OC 1", "Replace 'urges' with 'calls upon'", [], "d1");
  a = ch.amendDebate(ch.entertain(a, "am1"), "am1");
  ok(a.amend?.stage === "debate" && ch.subOpen(a), "amendment debated");
  ok(ch.callAmender(a).speech?.who === "d0", "its proposer is called first");
  const gone = ch.markRoll(a, "d0", "absent");
  ok(gone.roll.d0 === "absent" && ch.callAmender(gone) === gone && ch.callNextSpeaker(gone) === gone, "an absent proposer isn't called");
  a = ch.addToList(a, "d4", "for");
  const listBefore = a.debate;
  const clock = a.tr!.cauc;
  ok(ch.moveSubAmendment(a, "s0", "d2", a.amendments[0].text) === a, "an amendment to it must change something");
  a = ch.moveSubAmendment(a, "s1", "d2", "Replace 'urges' with 'demands'");
  ok(a.amend?.sub?.id === "s1" && a.debate.list.length === 0 && !ch.subOpen(a), "second degree moved, its own list");
  ok(ch.moveSubAmendment(a, "s2", "d3", "Something else") === a, "one at a time, no third degree");
  ok(ch.amendVote(a, "am1") === a, "the amendment can't be voted on first");
  a = ch.callNextSpeaker(a);
  ok(a.speech?.who === "d2", "its mover speaks first");
  a = ch.yieldToChair(ch.endSpeech(a, ch.now(), "d2"), "d2", 0);
  a = ch.subVote(a);
  ok(a.poll?.kind === "amendment" && a.poll.title.includes("amendment to the amendment"), "vote on it");
  a = ch.tally(ch.tally(a, "yes", 1), "yes", 1);
  a = ch.decideAmendment(a, null, "am1");
  const am1 = a.amendments.find((x) => x.id === "am1")!;
  ok(am1.text === "Replace 'urges' with 'demands'" && am1.was === "Replace 'urges' with 'calls upon'" && am1.status === "entertained", "the amendment's wording changed");
  ok(a.amendments.find((x) => x.id === "s1")!.status === "passed" && a.amend?.stage === "debate" && !a.amend.sub, "back to the amendment's debate");
  ok(a.debate === listBefore && a.tr!.cauc?.kind === clock?.kind, "its speakers' list and caucus come back");
  ok(!ch.amendedClause(a, "OC 1"), "the amendment to it doesn't count as amending the clause");
  // a second one, withdrawn; then a third that fails
  a = ch.withdrawSub(ch.moveSubAmendment(a, "s3", "d3", "Strike it"));
  ok(a.amendments.find((x) => x.id === "s3")!.status === "withdrawn" && !a.amend!.sub, "withdrawn");
  a = ch.subVote(ch.moveSubAmendment(a, "s4", "d3", "Strike it"));
  a = ch.decideAmendment(ch.tally(a, "no", 1), null, "am1");
  ok(a.amendments.find((x) => x.id === "am1")!.text === "Replace 'urges' with 'demands'" && a.amendments.find((x) => x.id === "s4")!.status === "failed", "failed: wording kept");
  a = ch.amendVote(a, "am1");
  a = ch.decideAmendment(ch.tally(a, "yes", 1), null, "am1");
  ok(a.step === "floor" && a.amendments.find((x) => x.id === "am1")!.status === "passed", "then the amendment itself");
  // Evatt and Trinity: no amendments to amendments
  let e = ch.create("E", "R", 60, names, names.map((_, i) => `d${i}`));
  e = { ...e, step: "floor" } as ch.Chamber;
  e = ch.amendDebate(ch.entertain(ch.submitAmendment(e, "x", "d0", "", "Text", []), "x"), "x");
  ok(e.amend?.stage === "debate" && ch.moveSubAmendment(e, "y", "d1", "Other") === e, "Evatt: none");
}
// 12. The display's sounds are a setting: off unless turned on, and kept through Back.
{
  let z = ch.createStandard("Z", "T", 60, names, names.map((_, i) => `d${i}`));
  ok(!z.chime && ch.setChime(z, "end", false) === z, "off by default");
  z = ch.setChime(z, "end", true);
  ok(z.chime?.end === true && !z.chime.warn, "end tone on");
  z = ch.remember(z, ch.startRoll(z));
  const back = ch.goBack(ch.setChime(z, "warn", true), ch.now());
  ok(back.chime?.end && back.chime.warn && back.step === "welcome", "kept through Back");
  ok(!("chime" in ch.setChime(ch.setChime(z, "warn", false), "end", false)), "both off: the setting goes");
  ok(ch.normalise(JSON.parse(JSON.stringify(z)))?.chime?.end === true, "kept through a save");
}
// 13. A practice committee: 12 sample states in any procedure, named as practice.
{
  const ids = Array.from({ length: 12 }, (_, i) => `p${i}`);
  for (const p of ["evatt", "trinity", "standard", "custom"] as const) {
    const x = ch.createPractice(p, ids, "twothirds");
    ok(x.name === "Practice Committee" && x.delegates.length === 12 && !!x.topic && ch.normalise(JSON.parse(JSON.stringify(x))) !== null, "practice " + p);
  }
  ok(ch.procedureName(ch.createPractice("custom", ids, "twothirds")) === "Custom" && ch.createPractice("trinity", ids).tr!.docs.length === 2, "practice procedures");
}
// 14. Review fixes.
{
  // A state marked absent comes off the lists set aside too, not only the one in use.
  let a = ch.createStandard("A", "T", 60, names, names.map((_, i) => `d${i}`), ["R1"]);
  a = ch.endStatements(ch.beginDebate(ch.markAllRoll(ch.startRoll(a), "present")));
  a = { ...ch.introduceDraft(a, "res0"), step: "floor" } as ch.Chamber;
  a = ch.addToList(a, "d5", "for");
  a = ch.amendDebate(ch.entertain(ch.submitAmendment(a, "am1", "d0", "OC 1", "Replace", [], "d1"), "am1"), "am1");
  a = ch.addToList(a, "d4", "for");
  a = ch.moveSubAmendment(a, "s1", "d2", "Other words");
  const off = ch.markRoll(ch.markRoll(a, "d4", "absent"), "d5", "absent");
  ok(!off.amend!.sub!.held.list.length && !off.tr!.saved!.list.length, "absent states off the amendment's and the resolution's waiting lists");
  ok(!ch.withdrawSub(off).debate.list.some((x) => x.id === "d4"), "and not back on the list when the amendment's debate resumes");
  // Each amendment to the same amendment is its own vote on delegates' devices, apart from the amendment's own.
  const room = await import("./room.ts");
  const k1 = room.voteKey(ch.subVote(a));
  const b = ch.moveSubAmendment(ch.withdrawSub(a), "s2", "d3", "Third words");
  const k2 = room.voteKey(ch.subVote(b));
  const k3 = room.voteKey(ch.amendVote(ch.withdrawSub(b), "am1"));
  ok(!!k1 && !!k2 && !!k3 && k1 !== k2 && k2 !== k3 && k1 !== k3, `separate vote keys: ${k1} ${k2} ${k3}`);
  // Explanations still owed from an earlier part of a divided question are kept when the next part is recorded.
  let v = ch.divideQuestion(toVote(), ["Clause 1", "Clause 2"]);
  const all = (x: ch.Chamber, bs: ch.Answer[]) => bs.reduce((y, ballot, i) => ch.answer(y, `d${i}`, ballot), x);
  v = ch.finishVote(all(v, ["forRights", "for", "for", "for", "for", "against", "against", "against"]));
  v = ch.finishVote(all(v, ["for", "againstRights", "for", "for", "for", "against", "against", "against"]));
  ok(v.explain?.queue.map((x) => x.id).join() === "d0,d1", "both explanations waiting: " + JSON.stringify(v.explain));
  // A timer paused in overtime and then reset by a console on the last build (which keeps `over`) shows its full time.
  const t = { label: "x", total: 60000, endsAt: null, left: 60000, over: 5000 };
  ok(ch.remaining(t, 0) === 60000 && ch.overtime(t, 0) === 0 && ch.timerText(t, 0) === "1:00", "a reset timer ignores a stale overtime");
  const started = ch.startTimer({ ...toVote(), timer: t }, 1000);
  ok(started.timer!.endsAt === 61000, "and starts from its full time: " + started.timer!.endsAt);
  const over = { label: "x", total: 60000, endsAt: null, left: 0, over: 5000 };
  ok(ch.timerText(over, 0) === "+0:05" && ch.startTimer({ ...toVote(), timer: over }, 1000).timer!.endsAt === -4000, "a timer paused in overtime carries on from it");
  // A name matches its well-known short form, so a committee saved with "USA" doesn't get "United States of America" too.
  ok(ch.sameName("USA", "United States of America") && ch.sameName("russia", "Russian Federation") && !ch.sameName("Niger", "Nigeria"), "short forms match");
  const old = ch.addDelegate({ ...ch.create("E", "R", 60, ["USA", "DPRK"], ["u", "k"]), step: "roll" } as ch.Chamber, "n", "United States of America");
  ok(old.delegates.length === 2 && old.delegates.some((d) => d.name === "DPRK"), "no second USA; an old short name is left as it is");
  ok(ch.parseNames("UK, United Kingdom, Great Britain, France").join() === "UK,France", "pasted repeats dropped: " + ch.parseNames("UK, United Kingdom, Great Britain, France").join());
}
console.log("STD ADD OK");
