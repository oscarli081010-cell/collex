import type { Metadata } from "next";
import ChamberDisplay from "@/components/ChamberDisplay";

export const metadata: Metadata = {
  title: "Display · Chambers · Collex",
  robots: { index: false },
};

export default function ChamberDisplayPage() {
  return <ChamberDisplay />;
}
