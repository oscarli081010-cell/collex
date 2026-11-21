import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/Skeleton";
import ChamberDisplay from "@/components/ChamberDisplay";

export const metadata: Metadata = {
  title: "Display · Committees · Collex",
  robots: { index: false },
};

export default function ChamberDisplayPage() {
  return <Suspense fallback={<main id="top" className="container"><PageSkeleton /></main>}><ChamberDisplay /></Suspense>;
}
