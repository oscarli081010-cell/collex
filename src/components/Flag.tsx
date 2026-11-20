import { flagCode } from "@/lib/flags";

/** A member state's flag beside its name. Decorative: the name is always written next to it. Nothing is drawn for a delegation with no flag. */
export default function Flag({ name, size = 20, em }: { name: string; size?: number; /** Sized to the text it sits in (the display's headings). */ em?: boolean }) {
  const code = flagCode(name);
  if (!code) return null;
  // eslint-disable-next-line @next/next/no-img-element -- a tiny local SVG; the image optimiser adds nothing
  return <img className="flag" src={`/flags/${code}.svg`} alt="" width={size} height={Math.round(size * 0.75)} loading="lazy" decoding="async" style={em ? { height: "0.62em", width: "auto", borderRadius: "0.06em", marginRight: "0.28em", verticalAlign: "0.06em" } : undefined} />;
}
