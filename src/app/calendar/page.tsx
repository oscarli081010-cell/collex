import type { Metadata } from "next";
import SeasonCalendar from "@/components/SeasonCalendar";

export const metadata: Metadata = { title: "Calendar · Collex" };

export default function CalendarPage() {
  return (
    <main id="top" className="container">
      <header className="pagehead">
        <h1>Calendar</h1>
      </header>
      <SeasonCalendar />
    </main>
  );
}
