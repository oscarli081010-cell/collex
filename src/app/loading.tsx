import { PageSkeleton } from "@/components/Skeleton";

// Shown while a page is fetched, so a slow connection sees the page's shape instead of the old page frozen.
export default function Loading() {
  return (
    <main id="top" className="container">
      <PageSkeleton />
    </main>
  );
}
