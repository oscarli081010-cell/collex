"use client";

import { useMemo } from "react";
import qrcode from "qrcode-generator";

const QUIET = 4; // the blank border, in modules, that scanners need around the code

// A QR code drawn as one SVG path. It is always black on white, whatever the site's theme, because phone cameras
// can't read a light code on a dark ground.
export default function QrCode({ value, size = 200, label }: { value: string; size?: number; label: string }) {
  const { n, d } = useMemo(() => {
    const qr = qrcode(0, "M");
    qr.addData(value);
    qr.make();
    const n = qr.getModuleCount();
    let d = "";
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c + QUIET} ${r + QUIET}h1v1h-1z`;
    return { n, d };
  }, [value]);
  const total = n + QUIET * 2;
  return (
    <svg role="img" aria-label={label} width={size} height={size} viewBox={`0 0 ${total} ${total}`} shapeRendering="crispEdges"
      style={{ display: "block", forcedColorAdjust: "none" }}>
      <rect width={total} height={total} rx={1.5} fill="#fff" />
      <path d={d} fill="#000" />
    </svg>
  );
}
