import type { Metadata } from "next";
import TopBar from "@/components/TopBar";
import Footer from "@/components/Footer";
import SeasonCalendar from "@/components/SeasonCalendar";
import { SEASON_YEAR } from "@/lib/conferences";
import s from "../inner.module.css";

export const metadata: Metadata = { title: `Calendar · ${SEASON_YEAR} season · Collex` };

export default function CalendarPage() {
  return (
    <main id="top">
      <TopBar />
      <header className={s.head} data-reveal>
        <h1 className={`display ${s.title}`}>The {SEASON_YEAR} season</h1>
        <p className={s.lead}>Every Sydney conference by month. Pick a month to see what&rsquo;s on.</p>
      </header>
      <div className={s.body}>
        <SeasonCalendar />
      </div>
      <Footer />
    </main>
  );
}
