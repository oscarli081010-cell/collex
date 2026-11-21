import * as ch from "./chamber.ts";
import { flagCode } from "./flags.ts";
import { writeFileSync } from "node:fs";
const ok = (v: unknown, m: string) => { if (!v) { console.error("FAIL", m); process.exit(1); } };
const names = ["Australia", "Brazil", "China", "France", "UK", "USA", "DRC", "Observer Group"];
let c = ch.createStandard("DISEC", "Autonomous weapons", 60, names, names.map((_, i) => `d${i}`));
ok(ch.procedureName(c) === "Standard", "name");
ok(ch.normalise(JSON.parse(JSON.stringify(c)))?.style === "standard", "normalise keeps style");
c = ch.startRoll(c); c = ch.markAllRoll(c, "present"); c = ch.beginDebate(c);
ok(c.step === "statements", "statements after roll: " + c.step); c = ch.endStatements(c); ok(c.step === "general", "general: " + c.step);
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
// Which refused saves are worth sending again
ok(ch.savePermanent("23514", 400) && ch.savePermanent("22P02", 400) && ch.savePermanent("P0001", 400) && ch.savePermanent("PGRST202", 404), "permanent errors");
ok(!ch.savePermanent("", 0) && !ch.savePermanent(undefined, undefined) && !ch.savePermanent("PGRST301", 401) && !ch.savePermanent("PGRST303", 401)
  && !ch.savePermanent("57014", 500) && !ch.savePermanent("40001", 409) && !ch.savePermanent("", 503) && !ch.savePermanent("08006", 503) && !ch.savePermanent("PGRST001", 503), "worth retrying");
