import type { Metadata } from "next";
import Admin from "@/components/Admin";

export const metadata: Metadata = { title: "Admin · Collex", robots: { index: false } };

export default function AdminPage() {
  return (
    <main id="top" className="container" style={{ paddingBlock: "clamp(48px, 6vw, 80px)", minHeight: "calc(100svh - 73px)" }}>
      <Admin />
    </main>
  );
}
