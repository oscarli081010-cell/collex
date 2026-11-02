import type { Metadata } from "next";
import UpcomingBoard from "@/components/UpcomingBoard";

export const metadata: Metadata = { title: "Conferences · Collex" };

export default function ConferencesPage() {
  return (
    <main id="top" className="container">
      <UpcomingBoard band />
    </main>
  );
}
