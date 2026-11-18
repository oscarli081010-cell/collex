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
// scores and awards
c = ch.setScore(c, "d0", { speaking: 8, diplomacy: 12 }); ok(ch.scoreTotal(ch.scoreOf(c, "d0")) === 18, "score clamp");
c = ch.addAward(c, "a1", "Best Delegate", "d0"); ok(c.awards!.length === 1, "award");
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
  console.log("STD OK");
});
