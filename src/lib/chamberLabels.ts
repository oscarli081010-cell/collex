// Words shared by the Chambers lists and the Admin page.

/** Where a committee is, by the step its console is on. */
export const STEP: Record<string, string> = {
  welcome: "Welcome", roll: "Roll Call", pick: "Choosing the Speakers", proposer: "Proposer", seconder: "Co-sponsor", opposer: "Opposer", caucus: "Caucus", floor: "Debate",
  amend: "Amendment", closing: "Closing", vote: "Vote", closed: "Result", ended: "Ended", statements: "Opening Statements", general: "General Debate",
};

export const procName = (rules?: string | null) => (rules === "trinity" ? "Trinity Grammar MUN" : "Evatt");

export const ago = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m} min ago`;
  if (m < 1440) return `${Math.round(m / 60)} h ago`;
  return new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short" });
};
