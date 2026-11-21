import type { Metadata } from "next";
import Link from "next/link";
import LegalPage from "@/components/LegalPage";
import { CONTACT } from "@/components/Footer";

export const metadata: Metadata = { alternates: { canonical: "/terms" }, title: "Terms of use · Collex", description: "The rules for using Collex: accounts, listing and running a conference, applications, committees, uploads and emails." };

const mail = <a href={`mailto:${CONTACT}`}>{CONTACT}</a>;

export default function Terms() {
  return (
    <LegalPage path="/terms" title="Terms of use" lead="The rules for using Collex. By using the site or creating an account, you agree to them.">
      <section>
        <h2>What Collex is</h2>
        <p>Collex (collex.au) is a free calendar of Model United Nations conferences in Sydney, with tools for running them. It is run by Oscar Li, from Sydney, New South Wales, Australia. In these terms, &ldquo;we&rdquo; means Collex. Conference organisers list their conferences, and we review each listing before it is published.</p>
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
          <li>You can delete your account yourself at any time from your <Link href="/account">account page</Link>.</li>
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
          <li>If the name or an application link on a live listing changes, we review it again. Follower emails about applications opening wait until we have looked, or for up to 24 hours.</li>
        </ul>
      </section>

      <section>
        <h2>Conferences are run by their organisers</h2>
        <p>Collex does not run, host or check the conferences listed on it. Registration, fees, refunds, safety and everything at the event are the organisers&rsquo; responsibility. Confirm dates and details with the organisers before you rely on them.</p>
      </section>

      <section>
        <h2>Applying and registering</h2>
        <ul>
          <li>Some conferences take applications or delegation registrations on Collex. Only enter details that are true, and only register a delegation you are allowed to speak for.</li>
          <li>The conference&rsquo;s organisers decide who gets a place and where. Collex does not.</li>
          <li>You are emailed a decision once it has stood for 10 minutes, and your allocation when the organisers send it.</li>
          <li>You can withdraw an application or registration on the conference&rsquo;s page. A withdrawn application stays on record as withdrawn, and the organisers are told.</li>
        </ul>
      </section>

      <section>
        <h2>Running a conference on Collex</h2>
        <p>If you list a conference or help run one, you will see information about the students who apply or register. You agree to:</p>
        <ul>
          <li>use it only to run that conference: deciding places, allocating committees and countries, checking people in and contacting them about it;</li>
          <li>not copy it into other lists, share it with anyone outside the team who doesn&rsquo;t need it, or use it to advertise anything else;</li>
          <li>keep any spreadsheet you download safe, and delete it when the conference is over;</li>
          <li>only give edit access to people who need to see everything, and add other helpers as view-only.</li>
        </ul>
        <p>Emails to applicants, schools or followers go through Collex. A conference can send up to five a day, with a subject of up to 120 characters and a message of up to 3,000. Keep them about the conference. Anyone can unsubscribe from a conference&rsquo;s emails in one click, and we will not send to them again.</p>
      </section>

      <section>
        <h2>Committees and delegates&rsquo; devices</h2>
        <ul>
          <li>Chairs can run a committee on Collex and, if they choose, let delegates join from their own devices with a code.</li>
          <li>Chairs can read every note passed in their committee, including notes between delegates, and can see how each country voted. Delegates should write notes on that basis.</li>
          <li>A delegate&rsquo;s requests wait for a chair, and the chairs&rsquo; ruling is final. Only a chair can free a seat.</li>
          <li>Chairs can keep marks and short notes on each country. Delegates do not see them unless the chairs release them, and then each person sees only the mark for their own country. Marks are for feedback only: they are not an official result, and chairs should keep notes fair and kind.</li>
        </ul>
      </section>

      <section>
        <h2>Uploads</h2>
        <ul>
          <li>Only upload photos, guides and files you have the right to share, and photos of people only if they have agreed.</li>
          <li>Cover photos can be up to 5 MB, background guides (PDF) up to 10 MB, profile and secretariat photos up to 1 MB, and committee files up to 10 MB.</li>
          <li>Each person can upload up to 10 cover photos, 20 guides, 40 photos and 20 committee files a day, and 100 MB a day in all. A delegate can share up to 10 files in a committee, and a committee can hold 200.</li>
          <li>Photos, cover photos and guides can be opened by anyone with their address. Committee files can only be opened by people in that committee.</li>
        </ul>
      </section>

      <section>
        <h2>Your delegate record</h2>
        <p>Your record of the conferences that accepted you is private until you switch it on from your account page. Once it is on, anyone with the link can see your name, school and those conferences, with your role, committee and country. You can switch it off at any time.</p>
      </section>

      <section>
        <h2>Fair use of the site</h2>
        <p>Do not:</p>
        <ul>
          <li>post anything false, misleading, offensive or unlawful;</li>
          <li>pretend to be someone else, or to speak for a conference you do not;</li>
          <li>try to get into accounts or data that are not yours, or get around the site&rsquo;s rules;</li>
          <li>overload the site, or copy it in bulk with automated tools;</li>
          <li>use details from the site to send spam;</li>
          <li>bully, harass or embarrass anyone, including in committee notes, files or organiser emails;</li>
          <li>post another person&rsquo;s personal details, or photos where they can be recognised, without their agreement;</li>
          <li>invite people to a committee or a listing&rsquo;s team just to find out whether they have an account;</li>
          <li>upload anything harmful, such as malware, or anything you don&rsquo;t have the right to share.</li>
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
        <p>You can stop using Collex at any time. Delete your account yourself from your <Link href="/account">account page</Link>, or email {mail} and we will do it. Committees you own are deleted with it, and conferences you listed stay on the calendar unless you ask us to remove them. Our <Link href="/privacy">privacy policy</Link> explains what happens to your information.</p>
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
