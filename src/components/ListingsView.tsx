"use client";

import Link from "next/link";
import { useAuth } from "./AuthProvider";
import PageBand from "./PageBand";
import { ListingsPanel } from "./listing/Listings";
import { useMyListings } from "./listing/useMyListings";
import { FormSkeleton } from "./Skeleton";
import s from "@/app/auth.module.css";

// Your listings: the conferences you run or help run, with where each stands. It used to be a card on the account page.
export default function ListingsView() {
  const { ready, session } = useAuth();
  const rows = useMyListings(session?.user.id ?? "");

  if (!ready) return <FormSkeleton fields={3} width={640} />;
  if (!session) {
    return (
      <PageBand title="Your" accent="listings" lead="Log in to see the conferences you run."
        aside={(
          <div className="btnStack">
            <Link href="/login" className="button lg">Log in</Link>
            <Link href="/signup" className="button secondary lg">Create an account</Link>
          </div>
        )} />
    );
  }

  const live = rows?.filter((r) => r.status === "published").length;
  const review = rows?.filter((r) => r.status === "pending").length;
  const num = (n: number | undefined) => (n === undefined ? "–" : String(n));
  return (
    <>
      <PageBand centre title="Your" accent="listings"
        figures={[
          { label: "Listings", value: num(rows?.length) },
          { label: "Live", value: num(live) },
          { label: "In review", value: num(review) },
        ]}
        aside={<div className="btnStack one"><Link href="/list" className="button secondary lg">List a conference</Link></div>} />
      <ListingsPanel rows={rows} />
    </>
  );
}
