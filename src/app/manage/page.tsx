import type { Metadata } from "next";
import ListingPages from "@/components/ListingPages";
import s from "../auth.module.css";

export const metadata: Metadata = { title: "Manage · Collex", description: "Run your conference on Collex: applications, registrations and emails.", robots: { index: false } };

export default function Page() {
  return (
    <main id="top" className={`container ${s.banded}`}>
      <ListingPages />
    </main>
  );
}
