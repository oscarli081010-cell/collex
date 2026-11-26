import type { Metadata } from "next";
import ConferenceGrid from "@/components/preview/conferences/ConferenceGrid";

// A trial layout for the Conferences page: the same listings as a grid of square cards. Not linked from anywhere,
// not in the sitemap, and kept out of search results.
export const metadata: Metadata = {
  title: "Conferences · Collex",
  robots: { index: false, follow: false },
};

export default function PreviewConferencesPage() {
  return (
    <main id="top" className="container">
      <ConferenceGrid />
    </main>
  );
}
