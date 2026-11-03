import type { Metadata } from "next";
import Link from "next/link";
import LegalPage from "@/components/LegalPage";
import { CONTACT } from "@/components/Footer";

export const metadata: Metadata = { title: "Privacy policy · Collex", description: "What Collex collects, why, who can see it, and how to get it changed or deleted." };

const mail = <a href={`mailto:${CONTACT}`}>{CONTACT}</a>;

export default function Privacy() {
  return (
    <LegalPage path="/privacy" title="Privacy policy" lead="What Collex collects, why, who can see it, and how to get it changed or deleted. We follow the Australian Privacy Principles in the Privacy Act 1988 (Cth).">
      <section>
        <h2>Who we are</h2>
        <p>Collex (collex.au) is a calendar of Model United Nations conferences in Sydney, run from Sydney, New South Wales, Australia. You can reach us at {mail}.</p>
      </section>

      <section>
        <h2>What we collect</h2>
        <h3>When you create an account</h3>
        <ul>
          <li>Your full name and email address.</li>
          <li>Your password. It is stored scrambled (hashed) by our sign-in provider, and nobody at Collex can read it.</li>
          <li>Your school or university, only if you choose to add it.</li>
          <li>Your light or dark display setting.</li>
        </ul>
        <h3>When you list a conference</h3>
        <p>The details you enter: its name, host school, dates, venue, level, fee, contact email, registration links, overview and committees, and your role in it. We also record which account sent it.</p>
        <h3>When you follow a conference</h3>
        <p>Which conferences you follow. Following is your choice: you press Follow on a conference&rsquo;s page, and you can unfollow there or from the link in any email.</p>

        <h3>When you express interest in a conference</h3>
        <p>Which conferences you&rsquo;ve sent an expression of interest to. You choose to send it on the conference&rsquo;s page and can withdraw it there. The conference&rsquo;s organisers see only how many expressions of interest it has, not who sent them.</p>
        <h3>A record of changes</h3>
        <p>When a listing or profile changes, we log who made the change, what changed and when. Only Collex admins can see this log. It helps us review listings and fix mistakes.</p>
        <h3>When you visit</h3>
        <p>Like any website, the servers that deliver Collex receive your IP address, browser type and the page you asked for. Our providers use this to deliver pages, stop abuse and find faults, and keep it in short-lived logs.</p>
        <p>We do not use analytics, advertising, tracking pixels or social media embeds, and we do not build profiles of visitors.</p>
      </section>

      <section>
        <h2>Why we use it</h2>
        <ul>
          <li>To create and run your account and keep you signed in.</li>
          <li>To review listings and publish the ones we approve.</li>
          <li>To send emails your account needs: a confirmation code when you sign up and a link when you reset your password.</li>
          <li>If you follow a conference, to email you when its applications open or its background guides are released. Every one of these emails has an unsubscribe link that works straight away.</li>
          <li>To keep the site secure and fix problems.</li>
        </ul>
        <p>We do not sell your information, and we do not send marketing emails or newsletters.</p>
      </section>

      <section>
        <h2>Who can see it</h2>
        <ul>
          <li><strong>Everyone</strong> can see approved listings, including the contact email and any cover photo added to them. Your account details are never shown publicly.</li>
          <li><strong>Collex admins</strong> can see accounts and listings so they can review submissions and answer requests.</li>
          <li><strong>Our service providers</strong> handle data only to run their part of Collex: Supabase (database and sign-in), Vercel (website hosting) and Resend (sending account and follow emails).</li>
          <li><strong>Authorities</strong>, only where the law requires us to share it.</li>
        </ul>
      </section>

      <section>
        <h2>Where it is stored</h2>
        <p>Accounts and listings are stored in Supabase&rsquo;s Sydney data centre. Vercel and Resend are based in the United States and may handle your IP address or email address outside Australia, including in the United States and Japan, when they deliver pages or send emails. The small Supabase program that sends follow emails may also run outside Australia while it sends them.</p>
      </section>

      <section>
        <h2>Students and young people</h2>
        <p>Many people on Collex are high school students. If you are under 18, check with a parent or guardian before you create an account. We only ask for what an account needs, and the school field is optional.</p>
        <p>If you list a conference, do not include personal details of students, such as names, phone numbers or photos where they can be recognised, unless they have agreed.</p>
      </section>

      <section>
        <h2>How we protect it</h2>
        <p>Every connection to Collex is encrypted. Database rules let each account see only its own details, and only admins can see more. No system is perfectly secure. If a breach is likely to cause someone serious harm, we will tell the people affected.</p>
      </section>

      <section>
        <h2>How long we keep it</h2>
        <p>We keep your account until you ask us to delete it. Email {mail} from your account&rsquo;s address and we will delete your account and profile within 30 days.</p>
        <p>Conferences you listed stay on the calendar after your account is deleted, because they belong to the conference, not to you. Ask in the same email if you want them removed as well. Entries in the change log are kept as a record.</p>
      </section>

      <section>
        <h2>Seeing and correcting your information</h2>
        <p>You can change your name and school on your <Link href="/account">account page</Link>. To see everything we hold about you, or to correct anything else, email {mail}. We will reply within 30 days.</p>
      </section>

      <section>
        <h2>Complaints</h2>
        <p>If you think we have mishandled your information, email {mail} and we will reply within 30 days. If you are not satisfied with our answer, you can complain to the Office of the Australian Information Commissioner at <a href="https://www.oaic.gov.au">oaic.gov.au</a> or on 1300 363 992.</p>
      </section>

      <section>
        <h2>Changes to this policy</h2>
        <p>If we change this policy, we will post the new version here and update the date at the top.</p>
      </section>
    </LegalPage>
  );
}
