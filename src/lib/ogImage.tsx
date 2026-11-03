import { readFile } from "node:fs/promises";
import { ImageResponse } from "next/og";
import { C_PATH, DOT, OLLEX_PATH } from "./brand";

// Share images (Open Graph / X cards): the page colours, the wordmark and the site's own type.
export const OG_SIZE = { width: 1200, height: 630 };

// Each path is written out in full, relative to this file, so the bundler ships exactly these files with the function.

export async function ogImage({ title, italic, lines, footer, photo }: {
  title: string; italic?: string; lines: string[]; footer: string; photo?: boolean;
}) {
  const [serif, serifItalic, sans] = await Promise.all([
    readFile(new URL("../assets/fonts/InstrumentSerif-Regular.ttf", import.meta.url)),
    readFile(new URL("../assets/fonts/InstrumentSerif-Italic.ttf", import.meta.url)),
    readFile(new URL("../assets/fonts/Inter-Medium.ttf", import.meta.url)),
  ]);
  const img = photo ? `data:image/jpeg;base64,${(await readFile(new URL("../../public/img/general-assembly.jpg", import.meta.url))).toString("base64")}` : null;
  const longest = Math.max(title.length, italic?.length ?? 0);
  const size = (photo ? 0.8 : 1) * (longest > 46 ? 72 : longest > 28 ? 88 : 104);

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#fbfaf7", color: "#15161a", fontFamily: "Inter" }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "64px 72px" }}>
          <svg viewBox="3 5 203 77" width={140} height={53}>
            <path d={C_PATH} fill="#15161a" />
            <circle cx={DOT.cx} cy={DOT.cy} r={DOT.r} fill="#213a73" />
            <path d={OLLEX_PATH} fill="#15161a" />
          </svg>
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div style={{ display: "flex", flexDirection: "column", fontFamily: "Instrument Serif", fontSize: size, lineHeight: 1.02, letterSpacing: "-0.02em" }}>
              <span>{title}</span>
              {italic && <span style={{ fontStyle: "italic", color: "#213a73" }}>{italic}</span>}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>{lines.map((l) => <div key={l} style={{ fontSize: 28, color: "#6b6e76" }}>{l}</div>)}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 24, color: "#6b6e76" }}>
            <div style={{ width: 10, height: 10, borderRadius: 5, background: "#213a73" }} />
            {footer}
          </div>
        </div>
        {img && <img src={img} width={430} height={630} style={{ objectFit: "cover", objectPosition: "45% 40%" }} />}
      </div>
    ),
    {
      ...OG_SIZE,
      fonts: [
        { name: "Instrument Serif", data: serif, style: "normal", weight: 400 },
        { name: "Instrument Serif", data: serifItalic, style: "italic", weight: 400 },
        { name: "Inter", data: sans, style: "normal", weight: 500 },
      ],
    },
  );
}
