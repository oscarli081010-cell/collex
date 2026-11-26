import type { NextConfig } from "next";

const supabase = "https://npdaczdwmhbtgitmplxc.supabase.co";

// Content Security Policy: the browser may only load code, styles, fonts and images from collex.au,
// and only talk to collex.au and our Supabase project. Inline scripts are allowed because Next.js and
// the theme script use them; everything React renders is escaped, and no outside script can load.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${supabase}`,
  "font-src 'self'",
  `connect-src 'self' ${supabase} ${supabase.replace("https", "wss")}`,
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

// A value that changes with every build, so the offline cache is renewed on each deploy (Offline.tsx reads it).
const buildId = process.env.VERCEL_GIT_COMMIT_SHA || process.env.VERCEL_DEPLOYMENT_ID || String(Date.now());

const config: NextConfig = {
  env: { NEXT_PUBLIC_VERCEL_DEPLOYMENT_ID: buildId },
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  // Photos in our storage are served through Next's optimiser (smaller files, in WebP). The sizes are few on purpose, to
  // keep the number of generated variants low. A photo's address never changes (a replaced photo gets a new file name),
  // so the optimised copies may be kept for a year. SVG is not allowed through the optimiser.
  images: {
    remotePatterns: [{ protocol: "https", hostname: "npdaczdwmhbtgitmplxc.supabase.co", pathname: "/storage/v1/object/public/**" }],
    formats: ["image/webp"],
    imageSizes: [96, 160, 256],
    deviceSizes: [640, 960, 1280, 1920],
    minimumCacheTTL: 31536000,
  },
  async redirects() {
    return [
      { source: "/guides/chairing-with-chambers", destination: "/guides/chairing-with-committees", permanent: true },
      { source: "/compare", destination: "/conferences", permanent: false },
      // Open Roles is switched off for now: old emails and links land on the conference list.
      { source: "/roles", destination: "/conferences", permanent: false },
      // The school permission sheet is retired: printed copies that link to it land on the conference page.
      { source: "/conferences/:slug/sign-off", destination: "/conferences/:slug", permanent: false },
    ];
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default config;
