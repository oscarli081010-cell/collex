import type { Metadata } from "next";
import { Suspense } from "react";
import ChamberDisplay from "@/components/ChamberDisplay";

export const metadata: Metadata = {
  title: "Display · Chambers · Collex",
  robots: { index: false },
};

export default function ChamberDisplayPage() {
  return <Suspense fallback={null}><ChamberDisplay /></Suspense>;
}
