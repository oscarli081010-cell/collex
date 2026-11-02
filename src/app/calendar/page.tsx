import type { Metadata } from "next";
import SeasonCalendar from "@/components/SeasonCalendar";
import { SEASON_YEAR } from "@/lib/conferences";

export const metadata: Metadata = { title: `Calendar · ${SEASON_YEAR} season · Collex` };

export default function CalendarPage() {
  return (
    <main id="top" className="container">
      <header className="pagehead">
        <h1>The {SEASON_YEAR} season</h1>
        <p>Every Sydney conference by month. Step through with the arrows, or jump to any month from the middle.</p>
      </header>
      <SeasonCalendar />
    </main>
  );
}
