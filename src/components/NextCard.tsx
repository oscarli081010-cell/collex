"use client";

import Link from "next/link";
import { formatRange, todayInSydney } from "@/lib/conferences";
import { useConferences } from "./ConferencesContext";
import styles from "@/app/home.module.css";

export default function NextCard() {
  const today = todayInSydney();
  const next = useConferences().find((c) => c.startDate && c.startDate >= today);
  return (
    <Link href={next ? `/conferences/${next.slug}` : "/list"} className={styles.nextCard}>
      <span className={styles.nextLabel}>Next conference</span>
      <span className={`serif ${styles.nextName}`}>{next ? next.name : "Nothing listed yet"}</span>
      <span className="muted">{next ? formatRange(next) : "Running one? List it first →"}</span>
    </Link>
  );
}
