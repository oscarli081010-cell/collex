import type { Metadata } from "next";
import ListingPages from "@/components/ListingPages";
import s from "../auth.module.css";

export const metadata: Metadata = { title: "Organisers · Collex", robots: { index: false } };

export default function Page() {
  return (
    <main id="top" className={`container ${s.banded}`}>
      <ListingPages />
    </main>
  );
}
