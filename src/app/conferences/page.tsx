import type { Metadata } from "next";
import ConferenceGrid from "@/components/conferences/ConferenceGrid";

export const metadata: Metadata = {
  alternates: { canonical: "/conferences" },
  title: "Conferences · Collex",
  description: "Upcoming Model United Nations conferences in Sydney, with dates, hosts and registration links.",
};

export default function ConferencesPage() {
  return (
    <main id="top" className="container">
      <ConferenceGrid />
    </main>
  );
}
