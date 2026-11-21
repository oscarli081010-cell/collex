import type { Metadata } from "next";
import Link from "next/link";
import LegalPage from "@/components/LegalPage";
import { CONTACT } from "@/components/Footer";
import s from "@/components/LegalPage.module.css";

export const metadata: Metadata = { alternates: { canonical: "/cookies" }, title: "Cookies policy · Collex", description: "Collex sets no cookies. Every item it keeps in your browser, what it is for, how long it lasts and how to remove it." };

export default function Cookies() {
  return (
    <LegalPage path="/cookies" title="Cookies policy" lead="Collex sets no cookies. It keeps a few items in your browser's own storage for features you use, and one tab marker that lets us count visits without tracking you.">
      <section>
        <h2>What we keep in your browser</h2>
        <p>Instead of cookies, Collex uses your browser&rsquo;s own storage. These items stay on your device. They are never used for advertising or to follow you around.</p>
        <table className={s.table}>
          <thead>
            <tr><th scope="col">Name</th><th scope="col">What it does</th><th scope="col">How long</th><th scope="col">How to remove it</th></tr>
          </thead>
          <tbody>
            <tr>
              <td><code>sb-npdaczdwmhbtgitmplxc-auth-token</code></td>
              <td>Keeps you logged in. Only saved once you log in.</td>
              <td>Until you log out</td>
              <td>Log out</td>
            </tr>
            <tr>
              <td><code>collex-theme</code></td>
              <td>Remembers whether you chose light, dark or system display.</td>
              <td>Until you clear it</td>
              <td>Clear site data</td>
            </tr>
            <tr>
              <td><code>collex-seen</code></td>
              <td>A marker in the tab&rsquo;s session storage that tells the first page you open in a tab from the rest, so we can count visits. It holds no identifier and never leaves your browser.</td>
              <td>Until you close the tab</td>
              <td>Close the tab</td>
            </tr>
            <tr>
              <td><code>collex:chamber</code></td>
              <td>A committee you run without sharing it, kept only in this browser. It holds what you enter, such as countries, speeches, and your marks and notes.</td>
              <td>Until you clear it</td>
              <td>Clear site data. Logging out does not remove it.</td>
            </tr>
            <tr>
              <td><code>collex:chamber:&lt;id&gt;</code></td>
              <td>A copy of a shared committee you chair, so it reopens without wifi. Only the five most recent are kept.</td>
              <td>Until you log out, delete or leave the committee, or open five newer ones</td>
              <td>Log out</td>
            </tr>
            <tr>
              <td><code>collex:chambers:kept</code></td>
              <td>The list of those copies.</td>
              <td>Until you log out</td>
              <td>Log out</td>
            </tr>
            <tr>
              <td><code>collex:chamber-sound</code></td>
              <td>Whether the committee console&rsquo;s sounds are on.</td>
              <td>Until you clear it</td>
              <td>Clear site data</td>
            </tr>
            <tr>
              <td><code>collex:practice</code></td>
              <td>How many speaking practices you finished this week.</td>
              <td>Until you clear it (the count starts again each week)</td>
              <td>Clear site data</td>
            </tr>
            <tr>
              <td><code>collex:prep:&lt;id&gt;</code></td>
              <td>Your ticks on the checklist for getting ready for an allocation.</td>
              <td>Until you clear it</td>
              <td>Clear site data</td>
            </tr>
            <tr>
              <td><code>collex-pages-&hellip;</code> and <code>collex-assets-&hellip;</code></td>
              <td>Copies of the site&rsquo;s own files (the home and committee pages, scripts, styles, fonts and flags) kept by its offline helper, so a committee still opens without wifi. Nothing from your account is kept here.</td>
              <td>Until the site is next updated</td>
              <td>Clear site data</td>
            </tr>
          </tbody>
        </table>
        <p>Deleting your account from the account page also removes every item starting with <code>collex:</code> from the browser you use to do it.</p>
      </section>

      <section>
        <h2>How we count visits</h2>
        <p>When you open a page, your browser tells our database the page&rsquo;s address (without anything after a &ldquo;?&rdquo;) and whether it is the first page in this tab. We add one to that page&rsquo;s count for the day. No IP address, account or device identifier is stored with the count, and no cookie is used. The database provider receives your IP address with the request, as it does for any request, but we don&rsquo;t keep it.</p>
      </section>

      <section>
        <h2>Why there is no cookie banner</h2>
        <p>Every item above is there for something you asked for: staying logged in, keeping your settings, or running a committee without wifi. The tab marker holds no identifier and is gone when you close the tab. There are no advertising or tracking cookies, nothing is sent to an analytics or advertising company, and Collex uses no tracking pixels or third-party embeds. The site&rsquo;s fonts are served from collex.au itself, so no font company learns about your visit. If that ever changes, we will ask for your consent first and update this page.</p>
      </section>

      <section>
        <h2>Removing them</h2>
        <p>Log out to remove the sign-in item and the copies of shared committees. To remove everything, clear the site data for collex.au in your browser&rsquo;s settings. That also removes a committee kept only in this browser, so share it first if you want to keep it. The site still works afterwards; you will just need to log in again.</p>
      </section>

      <section>
        <h2>More</h2>
        <p>Our <Link href="/privacy">privacy policy</Link> explains how we handle the rest of your information. Questions go to <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.</p>
      </section>
    </LegalPage>
  );
}
