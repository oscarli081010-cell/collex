import type { Metadata } from "next";
import TopBar from "@/components/TopBar";
import Footer from "@/components/Footer";
import UpcomingBoard from "@/components/UpcomingBoard";

export const metadata: Metadata = { title: "Conferences · Collex" };

export default function ConferencesPage() {
  return (
    <>
      <TopBar />
      <main id="top" className="container">
        <header className="pagehead">
          <h1>Conferences</h1>
          <p>Every listed Sydney conference. Each one has the same standard page.</p>
        </header>
        <div style={{ maxWidth: 900 }}>
          <UpcomingBoard />
        </div>
      </main>
      <Footer />
    </>
  );
}
