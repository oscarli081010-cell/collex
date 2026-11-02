"use client";

import Link from "next/link";
import { formatRange, NA } from "@/lib/conferences";
import { useConferences } from "./ConferencesContext";
import styles from "@/app/home.module.css";

export default function NextCard() {
  const today = new Date().toISOString().slice(0, 10);
  const next = useConferences().find((c) => c.startDate && c.startDate >= today);
  return (
    <Link href={next ? `/conferences/${next.slug}` : "/calendar"} className={styles.nextCard}>
      <span className={styles.nextLabel}>Next conference</span>
      <span className={`serif ${styles.nextName}`}>{next ? next.name : NA}</span>
      <span className="muted">{next ? formatRange(next) : "Dates to be announced"}</span>
    </Link>
  );
}
