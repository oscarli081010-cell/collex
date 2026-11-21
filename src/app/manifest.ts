import type { MetadataRoute } from "next";

// Lets Collex be installed to a phone's home screen or a laptop's dock, opening on the home page.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Collex",
    short_name: "Collex",
    description: "The Sydney MUN calendar, and the tools to run a committee.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#fbfaf7",
    theme_color: "#fbfaf7",
    icons: [
      { src: "/pwa-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
