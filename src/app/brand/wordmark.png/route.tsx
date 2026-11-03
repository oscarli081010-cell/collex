import { ImageResponse } from "next/og";
import { C_PATH, DOT, OLLEX_PATH } from "@/lib/brand";

// The wordmark as a PNG for emails, which can't show SVG. Drawn at 2x for sharp screens.
export function GET() {
  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%" }}>
      <svg viewBox="3 5 203 77" width={224} height={84}>
        <path d={C_PATH} fill="#15161a" />
        <circle cx={DOT.cx} cy={DOT.cy} r={DOT.r} fill="#213a73" />
        <path d={OLLEX_PATH} fill="#15161a" />
      </svg>
      </div>
    ),
    { width: 224, height: 84 },
  );
}
