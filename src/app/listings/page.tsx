import type { Metadata } from "next";
import ListingsView from "@/components/ListingsView";
import s from "../auth.module.css";

export const metadata: Metadata = { title: "Your listings · Collex", robots: { index: false } };

export default function Page() {
  return (
    <main id="top" className={`container ${s.banded}`}>
      <ListingsView />
    </main>
  );
}
