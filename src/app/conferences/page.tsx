import type { Metadata } from "next";
import TopBar from "@/components/TopBar";
import Footer from "@/components/Footer";
import Directory from "@/components/Directory";
import s from "../inner.module.css";

export const metadata: Metadata = { title: "Conferences · Collex" };

export default function ConferencesPage() {
  return (
    <main id="top">
      <TopBar />
      <header className={s.head} data-reveal>
        <h1 className={`display ${s.title}`}>Conferences</h1>
        <p className={s.lead}>Every listed Sydney conference, each with the same standard page.</p>
      </header>
      <div className={s.body}>
        <Directory />
      </div>
      <Footer />
    </main>
  );
}
