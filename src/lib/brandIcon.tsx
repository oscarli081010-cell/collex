import { ImageResponse } from "next/og";
import { Mark } from "./brand";

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
        <Mark size={size * 0.74} color="#213a73" />
      </div>
    ),
    { width: size, height: size },
  );
}
