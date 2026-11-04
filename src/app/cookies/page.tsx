import type { Metadata } from "next";
import Link from "next/link";
import LegalPage from "@/components/LegalPage";
import { CONTACT } from "@/components/Footer";
import s from "@/components/LegalPage.module.css";

export const metadata: Metadata = { alternates: { canonical: "/cookies" }, title: "Cookies policy · Collex", description: "Collex sets no cookies. The two items it keeps in your browser, and why." };

export default function Cookies() {
  return (
    <LegalPage path="/cookies" title="Cookies policy" lead="Collex sets no cookies. It saves two small items in your browser, both needed for features you use, and nothing that tracks you.">
      <section>
        <h2>What we save in your browser</h2>
        <p>Instead of cookies, Collex uses your browser&rsquo;s local storage for these two items. They stay on your device and are never used for advertising or analytics.</p>
        <table className={s.table}>
          <thead>
            <tr><th scope="col">Name</th><th scope="col">What it does</th><th scope="col">How long</th></tr>
          </thead>
          <tbody>
            <tr>
              <td><code>sb-npdaczdwmhbtgitmplxc-auth-token</code></td>
              <td>Keeps you logged in. Only saved once you log in.</td>
              <td>Until you log out</td>
            </tr>
            <tr>
              <td><code>collex-theme</code></td>
              <td>Remembers whether you chose light or dark mode.</td>
              <td>Until you clear it</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <h2>Why there is no cookie banner</h2>
        <p>Both items are strictly necessary for something you asked for: staying logged in, or keeping your display setting. Collex uses no analytics, advertising, tracking pixels or third-party embeds, and its fonts are served from collex.au itself, so no other company learns about your visit from your browser. If that ever changes, we will ask for your consent first and update this page.</p>
      </section>

      <section>
        <h2>Removing them</h2>
        <p>Log out to remove the sign-in item. To remove both, clear the site data for collex.au in your browser&rsquo;s settings. The site still works afterwards; you will just need to log in again.</p>
      </section>

      <section>
        <h2>More</h2>
        <p>Our <Link href="/privacy">privacy policy</Link> explains how we handle the rest of your information. Questions go to <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.</p>
      </section>
    </LegalPage>
  );
}
