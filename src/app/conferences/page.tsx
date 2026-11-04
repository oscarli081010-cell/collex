import type { Metadata } from "next";
import UpcomingBoard from "@/components/UpcomingBoard";

export const metadata: Metadata = { alternates: { canonical: "/conferences" }, title: "Conferences · Collex", description: "Upcoming Model United Nations conferences in Sydney, with dates, hosts and registration links." };

export default function ConferencesPage() {
  return (
    <main id="top" className="container">
      <UpcomingBoard band />
    </main>
  );
}
