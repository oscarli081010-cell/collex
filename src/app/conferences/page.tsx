import type { Metadata } from "next";
import UpcomingBoard from "@/components/UpcomingBoard";

export const metadata: Metadata = { title: "Conferences · Collex" };

export default function ConferencesPage() {
  return (
    <main id="top" className="container">
      <header className="pagehead">
        <h1>Conferences</h1>
      </header>
      <div style={{ maxWidth: 900 }}>
        <UpcomingBoard />
      </div>
    </main>
  );
}
