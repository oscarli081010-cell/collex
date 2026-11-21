import type { Metadata } from "next";
import PrepPage from "@/components/PrepPage";

export const metadata: Metadata = {
  title: "Prepare · Collex",
  description: "Get ready for your committee: your topic and background guide, research links, a position paper template, a speech starter and a checklist.",
  robots: { index: false },
};

export default function Prepare() {
  return (
    <main id="top" className="container">
      <PrepPage />
    </main>
  );
}
