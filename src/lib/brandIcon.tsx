import { ImageResponse } from "next/og";
import { Monogram } from "./brand";

// The favicon and Apple icon: the Collex monogram on the page colour. Drawn from paths, so no font download.
export function brandIcon(size: number, rounded: boolean) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center",
          background: "#fbfaf7", borderRadius: rounded ? size * 0.22 : 0,
        }}
      >
        <Monogram size={size * 0.92} ink="#15161a" dot="#213a73" />
      </div>
    ),
    { width: size, height: size },
  );
}
