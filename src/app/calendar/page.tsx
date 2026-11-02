import type { Metadata } from "next";
import SeasonCalendar from "@/components/SeasonCalendar";

export const metadata: Metadata = { title: "Calendar · Collex" };

export default function CalendarPage() {
  return (
    <main id="top" className="container">
      <SeasonCalendar />
    </main>
  );
}
