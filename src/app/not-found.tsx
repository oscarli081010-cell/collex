import type { Metadata } from "next";
import Link from "next/link";
import s from "./auth.module.css";

export const metadata: Metadata = { title: "Page not found · Collex" };

export default function NotFound() {
  return (
    <main id="top" className={`container ${s.page}`}>
      <div className={`t-reveal ${s.form} ${s.lost}`}>
        <p className={`serif ${s.code}`} aria-hidden="true">404</p>
        <h1 className={s.title}>This page is out of order.</h1>
        <p className="muted">The link may be old, or the page may have moved. The calendar has every listed conference.</p>
        <div className={s.row}>
          <Link href="/calendar" className="button lg">Open the calendar</Link>
          <Link href="/" className="button secondary lg">Go home</Link>
        </div>
      </div>
    </main>
  );
}
