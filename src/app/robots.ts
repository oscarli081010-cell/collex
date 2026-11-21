import type { MetadataRoute } from "next";

// Search engines may read everything public; personal and admin pages stay out of results.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/account", "/listings", "/activity", "/manage", "/admin", "/organisers", "/checkin"] },
    sitemap: "https://collex.au/sitemap.xml",
  };
}
