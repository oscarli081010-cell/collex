import type { Metadata } from "next";
import Chambers from "@/components/Chambers";

export const metadata: Metadata = {
  alternates: { canonical: "/chambers" },
  title: "Chambers · Collex",
  description: "Run a Model UN committee's floor: roll call, speakers list, timer and votes, with a display for the projector.",
};

export default function ChambersPage() {
  return <Chambers />;
}
