import type { Metadata } from "next";
import { Suspense } from "react";
import CheckIn from "@/components/CheckIn";
import { FormSkeleton } from "@/components/Skeleton";

export const metadata: Metadata = { title: "Check-in · Collex", description: "Check a delegate in at the door.", robots: { index: false } };

// Where a check-in code's QR leads. It reads the code from the address, so it waits for the browser (Suspense).
export default function CheckInPage() {
  return (
    <main id="top" className="container">
      <Suspense fallback={<FormSkeleton fields={1} />}><CheckIn /></Suspense>
    </main>
  );
}
