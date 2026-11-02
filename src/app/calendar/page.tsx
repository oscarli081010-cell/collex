import type { Metadata } from "next";
import TopBar from "@/components/TopBar";
import Footer from "@/components/Footer";
import SeasonCalendar from "@/components/SeasonCalendar";
import { SEASON_YEAR } from "@/lib/conferences";

export const metadata: Metadata = { title: `Calendar · ${SEASON_YEAR} season · Collex` };

export default function CalendarPage() {
  return (
    <>
      <TopBar />
      <main id="top" className="container">
        <header className="pagehead">
          <h1>The {SEASON_YEAR} season</h1>
          <p>Every Sydney conference by month. Pick a month to see what&rsquo;s on.</p>
        </header>
        <SeasonCalendar />
      </main>
      <Footer />
    </>
  );
}
