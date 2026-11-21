import type { Metadata } from "next";
import SeasonCalendar from "@/components/SeasonCalendar";

export const metadata: Metadata = { alternates: { canonical: "/calendar" }, title: "Calendar · Collex", description: "Model United Nations conferences in Sydney, month by month or across the whole year, with a calendar feed you can subscribe to." };

export default function CalendarPage() {
  return (
    <main id="top" className="container">
      <SeasonCalendar />
    </main>
  );
}
