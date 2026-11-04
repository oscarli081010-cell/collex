import type { Metadata } from "next";
import ActivityView from "@/components/ActivityView";
import s from "../auth.module.css";

export const metadata: Metadata = { title: "Activity · Collex", robots: { index: false } };

export default function Page() {
  return (
    <main id="top" className={`container ${s.banded}`}>
      <ActivityView />
    </main>
  );
}
