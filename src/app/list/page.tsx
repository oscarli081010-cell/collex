import type { Metadata } from "next";
import ListingPages from "@/components/ListingPages";
import s from "../auth.module.css";

export const metadata: Metadata = { alternates: { canonical: "/list" }, title: "List a conference · Collex", description: "Running a Model UN conference in Sydney? List it on Collex for free. Each listing is reviewed before it goes live." };

export default function ListPage() {
  return (
    <main id="top" className={`container ${s.banded}`}>
      {/* Words on the page before any script runs (and for search engines). The form's own headline replaces them once it shows. */}
      <section className={s.preIntro}>
        <h1 className="serif">List a conference</h1>
        <p>Running a Model UN conference in Sydney? List it on Collex for free. Each listing is reviewed before it goes live, and you can add dates, committees and registration links as you decide them.</p>
      </section>
      <ListingPages />
    </main>
  );
}
