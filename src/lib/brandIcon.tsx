import { ImageResponse } from "next/og";

// The Collex mark: a serif C in the page colour on the accent navy. Drawn at build time.
// The font is fetched as TrueType because the image renderer cannot read the woff2 files the site uses.
async function serifFont() {
  const css = await (await fetch("https://fonts.googleapis.com/css2?family=Instrument+Serif&text=C")).text();
  const url = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1];
  if (!url) throw new Error("Could not find the Instrument Serif font file for the icon.");
  return (await fetch(url)).arrayBuffer();
}

export async function brandIcon(size: number, rounded: boolean) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center",
          background: "#213a73", color: "#fbfaf7", borderRadius: rounded ? size * 0.22 : 0,
          fontFamily: "Instrument Serif", fontSize: size * 0.86, lineHeight: 1, paddingBottom: size * 0.04,
        }}
      >
        C
      </div>
    ),
    { width: size, height: size, fonts: [{ name: "Instrument Serif", data: await serifFont(), style: "normal", weight: 400 }] },
  );
}
