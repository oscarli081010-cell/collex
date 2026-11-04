"use client";

import { useEffect } from "react";
import { themeBootScript } from "@/lib/theme";
import "./globals.css";
import "./motion.css";
import s from "./auth.module.css";

// The last resort, when even the top bar and footer fail: a whole page of its own, in the visitor's theme.
// The site fonts load in the main layout, so this page names system fonts directly.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <html lang="en-AU" data-theme="light" style={{ "--font-sans": "ui-sans-serif", "--font-serif": "\"Iowan Old Style\"" } as React.CSSProperties} suppressHydrationWarning>
      <head>
        <title>Something went wrong · Collex</title>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body>
        <main id="top" className={`container ${s.page}`}>
          <div role="alert" className={`${s.form} ${s.lost}`}>
            <h1 className={s.title}>Collex didn&rsquo;t load.</h1>
            <p className="muted">Something went wrong on our side, not yours. Try again, and if it keeps happening, email <a className="link" href="mailto:hello@collex.au">hello@collex.au</a>.</p>
            <div className="btnStack one">
              <button type="button" className="button lg" onClick={reset}>Try again</button>
              {/* A full reload, not a client navigation, since the app around this page has failed. */}
              <a href="/" className="button secondary lg">Go home</a>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
