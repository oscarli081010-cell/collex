"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Placard } from "@/components/Drawings";
import { reportError } from "@/components/Pulse";
import s from "./auth.module.css";

// Something broke while showing a page. A calm way back instead of a blank screen; the details stay in the console.
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); reportError(error.message, error.stack, error.digest ? `\nDigest: ${error.digest}` : ""); }, [error]);
  return (
    <main id="top" className={`container ${s.page}`}>
      <div role="alert" className={`t-reveal ${s.form} ${s.lost}`}>
        <Placard />
        <h1 className={s.title}>This page didn&rsquo;t load.</h1>
        <p className="muted">Something went wrong on our side, not yours. Try again, and if it keeps happening, email <a className="link" href="mailto:hello@collex.au">hello@collex.au</a>.</p>
        <div className="btnStack one">
          <button type="button" className="button lg" onClick={reset}>Try again</button>
          <Link href="/" className="button secondary lg">Go home</Link>
        </div>
      </div>
    </main>
  );
}
