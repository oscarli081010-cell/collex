import Image from "next/image";
import type { CSSProperties } from "react";

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
  if (!src.startsWith(STORAGE)) {
    // eslint-disable-next-line @next/next/no-img-element -- not in our storage, so the optimiser may not fetch it
    return <img src={src} alt={alt} className={className} style={style} fetchPriority={priority ? "high" : undefined} loading={priority ? undefined : "lazy"} decoding="async" />;
  }
  const common = { src, alt, sizes, className, style, ...(priority ? { preload: true, fetchPriority: "high" as const } : {}) };
  return fill ? <Image {...common} fill /> : <Image {...common} width={width} height={height} />;
}
