import type { Metadata } from "next";
import TopBar from "@/components/TopBar";
import Footer from "@/components/Footer";
import ListForm from "@/components/ListForm";
import s from "../inner.module.css";

export const metadata: Metadata = { title: "List your conference · Collex" };

export default function ListPage() {
  return (
    <main id="top">
      <TopBar />
      <header className={s.head} data-reveal>
        <h1 className={`display ${s.title}`}>List your conference</h1>
        <p className={s.lead}>Free, and it takes five minutes. Leave anything you don&rsquo;t know yet blank.</p>
      </header>
      <div className={s.body}>
        <ListForm />
      </div>
      <Footer />
    </main>
  );
}
