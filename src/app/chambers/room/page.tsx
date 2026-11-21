import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/Skeleton";
import ChamberRoom from "@/components/ChamberRoom";

export const metadata: Metadata = {
  title: "Your seat · Committees · Collex",
  robots: { index: false },
};

export default function ChamberRoomPage() {
  return <Suspense fallback={<main id="top" className="container"><PageSkeleton /></main>}><ChamberRoom /></Suspense>;
}
