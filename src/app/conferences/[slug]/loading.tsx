import { ConferenceSkeleton } from "@/components/Skeleton";
import s from "../../inner.module.css";

// A conference page that isn't built yet (a new listing) shows its own shape while it loads.
export default function Loading() {
  return (
    <main id="top" className="container">
      <ConferenceSkeleton band={s.applyBand} />
    </main>
  );
}
