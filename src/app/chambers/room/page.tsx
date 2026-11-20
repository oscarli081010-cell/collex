import type { Metadata } from "next";
import { Suspense } from "react";
import ChamberRoom from "@/components/ChamberRoom";

export const metadata: Metadata = {
  title: "Your Seat · Committees · Collex",
  robots: { index: false },
};

export default function ChamberRoomPage() {
  return <Suspense fallback={null}><ChamberRoom /></Suspense>;
}
