import type { Metadata } from "next";
import Unfollow from "@/components/Unfollow";
import s from "../auth.module.css";

export const metadata: Metadata = { title: "Unsubscribe · Collex", description: "Stop email updates about a conference.", robots: { index: false } };

export default function UnfollowPage() {
  return (
    <main id="top" className={`container ${s.page}`}>
      <Unfollow />
    </main>
  );
}
