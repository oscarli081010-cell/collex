import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/Skeleton";
import Chambers from "@/components/Chambers";

export const metadata: Metadata = {
  alternates: { canonical: "/chambers" },
  title: "Committees · Collex",
  description: "Run a Model UN committee's floor: roll call, speakers list, timer and votes, with a display for the projector.",
};

export default function ChambersPage() {
  // The heading and the line under it are only in the fallback, so the served HTML has them; once the client renders,
  // the committees page (with its own heading) takes the fallback's place, so they never show twice.
  return (
    <Suspense fallback={(
      <main id="top" className="container">
        <h1 className="serif">Committees</h1>
        <p className="muted">Run a Model UN committee&rsquo;s floor: roll call, speakers list, timer and votes, with a display for the projector.</p>
        <PageSkeleton />
      </main>
    )}><Chambers /></Suspense>
  );
}
