import type { Metadata } from "next";
import UpcomingBoard from "@/components/UpcomingBoard";

// The previous Conferences page (one long list), kept for comparison. Not linked from anywhere, not in the sitemap,
// and kept out of search results.
export const metadata: Metadata = {
  title: "Conferences · Collex",
  robots: { index: false, follow: false },
};

export default function ClassicConferencesPage() {
  return (
    <main id="top" className="container">
      <UpcomingBoard band />
    </main>
  );
}
