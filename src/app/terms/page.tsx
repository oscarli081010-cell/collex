import type { Metadata } from "next";
import Link from "next/link";
import LegalPage from "@/components/LegalPage";
import { CONTACT } from "@/components/Footer";

export const metadata: Metadata = { alternates: { canonical: "/terms" }, title: "Terms of use · Collex", description: "The rules for using Collex and listing a conference on it." };

const mail = <a href={`mailto:${CONTACT}`}>{CONTACT}</a>;

export default function Terms() {
  return (
    <LegalPage path="/terms" title="Terms of use" lead="The rules for using Collex. By using the site or creating an account, you agree to them.">
      <section>
        <h2>What Collex is</h2>
        <p>Collex (collex.au) is a free calendar of Model United Nations conferences in Sydney, run from Sydney, New South Wales, Australia. Conference organisers list their conferences, and the Collex team reviews each listing before it is published.</p>
      </section>

      <section>
        <h2>Not affiliated with the United Nations</h2>
        <p>Collex is independent. It is not affiliated with, endorsed by or connected to the United Nations, or to any school, university or conference listed on it. &ldquo;Model United Nations&rdquo; describes a type of student event.</p>
      </section>

      <section>
        <h2>Your account</h2>
        <ul>
          <li>Give your real name and an email address you can access.</li>
          <li>Keep your password to yourself. You are responsible for what happens on your account.</li>
          <li>One person per account.</li>
          <li>If you are under 18, get a parent or guardian&rsquo;s permission before you create an account.</li>
        </ul>
      </section>

      <section>
        <h2>Listing a conference</h2>
        <ul>
          <li>Only list a conference you help organise, or one its organisers have allowed you to list.</li>
          <li>Keep the details accurate and up to date. If something changes, tell us at {mail}.</li>
          <li>Only include another person&rsquo;s details if they have agreed.</li>
          <li>You let Collex publish, format and display the details you send, for free, for as long as the listing is on the site.</li>
          <li>We may edit a listing to fit the standard page, ask for changes, decline it or remove it.</li>
        </ul>
      </section>

      <section>
        <h2>Conferences are run by their organisers</h2>
        <p>Collex does not run, host or check the conferences listed on it. Registration, fees, refunds, safety and everything at the event are the organisers&rsquo; responsibility. Confirm dates and details with the organisers before you rely on them.</p>
      </section>

      <section>
        <h2>Fair use of the site</h2>
        <p>Do not:</p>
        <ul>
          <li>post anything false, misleading, offensive or unlawful;</li>
          <li>pretend to be someone else, or to speak for a conference you do not;</li>
          <li>try to get into accounts or data that are not yours, or get around the site&rsquo;s rules;</li>
          <li>overload the site, or copy it in bulk with automated tools;</li>
          <li>use details from the site to send spam.</li>
        </ul>
        <p>We may suspend or close an account that breaks these terms.</p>
      </section>

      <section>
        <h2>Content on Collex</h2>
        <p>The Collex name, design and text belong to Collex. Listings belong to the people who sent them. Photographs by others are used under their licences and credited at the foot of each page.</p>
      </section>

      <section>
        <h2>Availability</h2>
        <p>Collex is free. We work to keep it running and accurate, but we may change, pause or stop features at any time, and we cannot promise it will always be available or free of errors.</p>
      </section>

      <section>
        <h2>Your rights and our liability</h2>
        <p>Nothing in these terms takes away rights you have under the Australian Consumer Law or other laws that cannot be excluded.</p>
        <p>Apart from those rights, and as far as the law allows, Collex is not liable for any loss that comes from relying on a listing, from a conference itself, or from the site being unavailable. Where our liability cannot be excluded but can be limited, it is limited to supplying the service again.</p>
      </section>

      <section>
        <h2>Ending your account</h2>
        <p>You can stop using Collex at any time. To delete your account, email {mail}. Our <Link href="/privacy">privacy policy</Link> explains what happens to your information.</p>
      </section>

      <section>
        <h2>Law</h2>
        <p>These terms are governed by the laws of New South Wales, Australia, and its courts can hear any dispute about them.</p>
      </section>

      <section>
        <h2>Changes</h2>
        <p>If we change these terms, we will post the new version here and update the date at the top. Questions go to {mail}.</p>
      </section>
    </LegalPage>
  );
}
