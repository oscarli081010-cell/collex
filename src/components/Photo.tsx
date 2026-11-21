"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type CSSProperties } from "react";

// Photos in our own storage go through Next's image optimiser, so each place gets a file close to the size it is shown
// at (the stored originals are about 1600px wide). Anything else (the demo listing, older data) stays a plain <img>:
// next/image refuses addresses that next.config.ts does not list. This prefix must match `remotePatterns` there.
const STORAGE = "https://npdaczdwmhbtgitmplxc.supabase.co/storage/v1/object/public/";

type Props = {
  src: string;
  alt: string;
  /** How wide the photo is shown, so the browser picks a small file: "80px", or "(max-width: 720px) 100vw, 1170px". */
  sizes: string;
  className?: string;
  style?: CSSProperties;
  /** Fill the parent box (which must be positioned and sized), as the cover does. Otherwise width and height are used. */
  fill?: boolean;
  /** Without `fill`: the photo's shape, not its display size; the page's CSS sets the real size. */
  width?: number;
  height?: number;
  /** For the biggest picture above the fold: load now, not lazily. */
  priority?: boolean;
};

export default function Photo({ src, alt, sizes, className, style, fill, width, height, priority }: Props) {
  // If the optimiser can't produce the smaller file (it timed out fetching the original, or it is over its allowance),
  // the original is shown instead: a heavier photo is better than a broken one.
  const [failed, setFailed] = useState(false);
  const img = useRef<HTMLImageElement>(null);
  // A photo can fail before the page is interactive, when no error event is heard: so it is also checked once on arrival.
  useEffect(() => { const el = img.current; if (el && el.complete && el.naturalWidth === 0 && el.currentSrc) setFailed(true); }, []);
  if (failed || !src.startsWith(STORAGE)) {
    // eslint-disable-next-line @next/next/no-img-element -- not in our storage, or the optimiser failed for it
    return <img src={src} alt={alt} className={className} style={fill ? { position: "absolute", inset: 0, width: "100%", height: "100%", ...style } : style} fetchPriority={priority ? "high" : undefined} loading={priority ? undefined : "lazy"} decoding="async" />;
  }
  const common = { ref: img, src, alt, sizes, className, style, onError: () => setFailed(true), ...(priority ? { preload: true, fetchPriority: "high" as const } : {}) };
  return fill ? <Image {...common} fill /> : <Image {...common} width={width} height={height} />;
}
