import type { Metadata } from "next";
import Link from "next/link";
import LegalPage from "@/components/LegalPage";
import { CONTACT } from "@/components/Footer";

export const metadata: Metadata = { alternates: { canonical: "/privacy" }, title: "Privacy policy · Collex", description: "What Collex collects, why, who can see it, the emails it sends, how long it keeps things, and how to change or delete them." };

const mail = <a href={`mailto:${CONTACT}`}>{CONTACT}</a>;

export default function Privacy() {
  return (
    <LegalPage path="/privacy" title="Privacy policy" lead="What Collex collects, why, who can see it, and how to change or delete it. We follow the Australian Privacy Principles in the Privacy Act 1988 (Cth).">
      <section>
        <h2>Who runs Collex</h2>
        <p>Collex (collex.au) is a free calendar of Model United Nations conferences in Sydney, with tools for running them. It is run by Oscar Li, from Sydney, New South Wales, Australia. In this policy, &ldquo;we&rdquo; means Collex.</p>
        <p>To ask anything about your information, email {mail}.</p>
      </section>

      <section>
        <h2>What we collect and why</h2>
        <p>Anyone can read the conference pages without an account. What we collect depends on what you do.</p>

        <h3>Having an account</h3>
        <ul>
          <li>Your name and email address, so you can log in and we can email you.</li>
          <li>Your password. Our sign-in provider stores it scrambled (hashed), and nobody at Collex can read it.</li>
          <li>Your school or university, only if you add it.</li>
          <li>If you sign in with Google, Google tells us your name and email address. Google&rsquo;s sign-in record can include other profile details, but we don&rsquo;t use your Google picture.</li>
          <li>A profile photo, only if you add one.</li>
          <li>Your settings: light, dark or system display, whether the weekly email is on, whether your delegate record is public, and which kinds of role you want alerts about.</li>
        </ul>

        <h3>Applying to or registering for a conference</h3>
        <p>Some conferences take applications or registrations on Collex.</p>
        <ul>
          <li><strong>An application</strong> (as a delegate, a chair or for a role) holds the name, school or university, year, committee and country choices, experience and note you enter. We add its status, the committee and country you are given, whether you have confirmed your place, and when you were checked in.</li>
          <li><strong>A delegation registration</strong> holds the school or university, a contact name and email, the number of delegates and any note.</li>
        </ul>
        <p>We use these so the conference&rsquo;s organisers can decide, allocate places and contact you. You can change an application while it is waiting for an answer. If you withdraw an application, it stays on record as withdrawn and the organisers are emailed that you withdrew. If you withdraw a registration, it is deleted.</p>
        <p>Your account&rsquo;s email address is not part of an application. Organisers write to you through Collex. If you reply to one of those emails, the organisers will see your email address.</p>

        <h3>Being checked in</h3>
        <p>Each accepted application has a check-in code, shown as a QR code on your account page. When one of the organisers scans it or ticks you off, we record the time and which organiser did it. Scanning shows them your name, school, committee and country.</p>

        <h3>Using a committee on your device</h3>
        <p>Chairs can let delegates join their committee from a phone or laptop with a code. If you join, we record which country&rsquo;s seat you took and what you send: requests (for the floor, points, motions, amendments and signatures), notes, votes and files.</p>
        <p>Chairs can give each country marks for speaking, diplomacy, knowledge and procedure, with a short private note. These are kept with the committee. If the committee is linked to a conference, the chairs can release them: an average mark out of 10 and the note then appear, privately, on the account page of whoever is matched to that country (through an accepted application with that committee and country, or an approved seat). If more than one person shares a country, each of them sees it. The chairs can take released marks back.</p>
        <p>If you run a committee, it is kept only in your browser until you share it. Once shared, it is stored with Collex so other chairs can use it.</p>

        <h3>Following a conference</h3>
        <p>Which conferences you follow, and which ones you have expressed interest in. You choose both on the conference&rsquo;s page, and can undo them there. We use them to send the emails described below and to show your conferences on your account page.</p>

        <h3>Listing or helping run a conference</h3>
        <ul>
          <li>The details you enter for a listing, including the names and photos of its secretariat, cover photos and background guides, and which account sent it.</li>
          <li>Who is on its team. When you invite someone, we record the email you typed for two days, to limit how many invites one person can send.</li>
          <li>If you ask to claim a listing we added, your role and how we can check it.</li>
          <li>Emails you send through Collex (subject, message, who they went to and how many), and announcements you post.</li>
          <li>A history of changes: who made each change, which details changed, and what they were before, so a change can be undone.</li>
        </ul>

        <h3>Reporting a problem</h3>
        <p>When you report a listing, we keep the reason, your note, a reply email if you give one, and your account if you are logged in. Only Collex admins see reports.</p>

        <h3>Just visiting</h3>
        <ul>
          <li>Like any website, the services that deliver Collex receive your IP address, browser details and the page you asked for. Our providers use this to deliver pages, stop abuse and find faults.</li>
          <li>We count page views without cookies. For each page and day we keep only a count of views and of first views in a browser tab. No IP address, account or device identifier is stored with the count.</li>
          <li>If a page breaks, we record the error message, a technical trace, the page&rsquo;s address (without anything after a &ldquo;?&rdquo;) and your browser&rsquo;s description of itself (its name, version and operating system), so we can fix it. This is not linked to an account.</li>
        </ul>
        <p>Nothing is sent to an analytics or advertising company. We use no advertising, tracking pixels or social media embeds, and we do not build profiles of visitors. Our <Link href="/cookies">cookies policy</Link> lists what is kept in your browser.</p>
      </section>

      <section>
        <h2>Who can see what</h2>
        <ul>
          <li><strong>You</strong> can see your account, your applications and registrations, your check-in codes, and marks released to you.</li>
          <li><strong>The organisers of a conference</strong> you apply or register to can see what you entered, its status and your allocation, and can download it as a spreadsheet. Helpers they add as view-only see less: names, schools, years, statuses, allocations and check-ins, but not experience, choices, notes or contact emails. Organisers see how many people follow a conference or expressed interest, never who. They can email followers through Collex without seeing who they are. They can also see their listing&rsquo;s change history, and who chairs each committee linked to it.</li>
          <li><strong>The chairs of a committee you sit in</strong> see your name next to your seat (or your email, if your account has no name), every request, every note passed in the committee, including notes between delegates, how each country voted, and the files shared in it. Other delegates see notes sent to everyone, notes to or from their own country, and the committee&rsquo;s files.</li>
          <li><strong>Collex admins</strong> can see accounts, listings, applications, registrations, reports and committees, so they can review listings, answer requests and fix problems.</li>
          <li><strong>The public</strong> can see published listings, including the contact, secretariat, cover photos and guides on them. Your delegate record is public only if you switch it on (it starts off). It shows your name, school, and the conferences that accepted you, with your role, committee and country. Profile photos, cover photos, secretariat photos and guides are stored so that anyone with their address can open them. Committee files can only be opened by people in that committee.</li>
          <li><strong>Our service providers</strong> handle information only to run their part of Collex (see below).</li>
          <li><strong>Authorities</strong>, only where the law requires it.</li>
        </ul>
        <p>We do not sell your information.</p>
      </section>

      <section>
        <h2>Emails we send</h2>
        <p>Emails about conferences and committees come from hello@collex.au. We do not send advertising or newsletters.</p>
        <h3>About your account, or something you did or are part of</h3>
        <ul>
          <li><strong>Account emails</strong>: a link to confirm your email when you sign up, and a link to reset your password when you ask for one.</li>
          <li><strong>Decisions</strong> on your application or registration (accepted, waitlisted or not successful). Each is sent once the decision has stood for 10 minutes, so organisers can fix a misclick. If they change it back within that time, nothing is sent.</li>
          <li><strong>Your allocation</strong>, when the organisers send allocations.</li>
          <li><strong>Listing reviews</strong>, when we approve, decline or take down a listing you sent, and the answer to a claim you made.</li>
          <li><strong>Withdrawals</strong>: if you can edit a conference, a note when someone withdraws their application (at most one a day for each application).</li>
          <li><strong>Committee invites</strong>: when a committee&rsquo;s owner adds your account as a chair. This email has no unsubscribe link. Ask the owner to remove you, or email {mail}.</li>
          <li><strong>Test emails</strong> that organisers send to themselves.</li>
        </ul>
        <p>Being added as a co-organiser of a listing does not send an email. The invite waits on your account page.</p>
        <h3>Emails you can stop in one click</h3>
        <p>Each of these has an unsubscribe link at the bottom that works straight away, with no need to log in. Your email app&rsquo;s own unsubscribe button works too.</p>
        <ul>
          <li><strong>Follow updates</strong>: when a conference you follow opens delegate registration or chair applications, or releases background guides.</li>
          <li><strong>Reminders</strong> to followers before a conference&rsquo;s key dates (3 days and 1 day before) and before it begins (7 days and 1 day before).</li>
          <li><strong>Emails from a conference&rsquo;s organisers</strong> to its applicants, accepted delegates or chairs, registered schools or followers. A conference can send at most five a day. Unsubscribing stops every email from that conference&rsquo;s organisers, including ones about your place, so keep an eye on its page.</li>
          <li><strong>Role alerts</strong> about new roles, if you set them up.</li>
          <li><strong>The weekly email</strong> about Sydney MUN. It is off unless you turn it on from your <Link href="/account">account page</Link>. It goes out on Monday mornings, only when there is something to say.</li>
        </ul>
        <p>Unsubscribing from follow updates or reminders unfollows that conference. If a conference lists a plain email address as its contact, replies to its decisions, allocations and organiser emails go to its organisers.</p>
      </section>

      <section>
        <h2>Where it is kept and who handles it</h2>
        <ul>
          <li><strong>Supabase</strong> runs our database, sign-in and file storage. Your information and files are kept in its Sydney data centre. The small Supabase programs that send our emails may run outside Australia while they work.</li>
          <li><strong>Vercel</strong>, a United States company, hosts the website. It may handle your IP address and the pages you ask for outside Australia.</li>
          <li><strong>Resend</strong>, a United States company, delivers our emails. Your email address and each email&rsquo;s content pass through it, outside Australia.</li>
          <li><strong>Google</strong>, only if you choose to sign in with Google.</li>
        </ul>
        <p>Our fonts are part of the site itself, so no font company learns about your visit.</p>
      </section>

      <section>
        <h2>How long we keep it</h2>
        <ul>
          <li><strong>Your account</strong>: until you delete it.</li>
          <li><strong>Applications and registrations</strong>: 12 months after a conference ends, we blank the school, year, experience, note and choices on its applications, and give them a new check-in code. The name, conference, status, committee, country and confirmation and check-in times stay, so your record still works. On registrations we blank the contact name, contact email and note; the school, number of delegates and status stay.</li>
          <li><strong>Committee notes, requests and votes</strong>: deleted within 60 days, often sooner.</li>
          <li><strong>Copies of emails we sent</strong>: 90 days.</li>
          <li><strong>The history of changes</strong>: 24 months.</li>
          <li><strong>Invite records</strong>: 2 days.</li>
          <li><strong>Page counts</strong>: 13 months. <strong>Error reports</strong>: 30 days after the error was last seen.</li>
          <li><strong>Kept until removed</strong>: listings; committees and what is in them (including chairs&rsquo; marks and notes, and files) until the chairs delete them; released marks until the chairs take them back or delete the committee; reports; claims; emails and announcements organisers sent; and follows and alerts until you stop them.</li>
        </ul>
        <p>Our providers keep their own short-term logs under their own rules. Deleted information can stay in backup copies for a while before those are replaced.</p>
      </section>

      <section>
        <h2>Your choices</h2>
        <ul>
          <li><strong>See and correct.</strong> Change your name, school, photo and password on your <Link href="/account">account page</Link>. Change an application while it is waiting, or withdraw it. To see or correct anything else, email {mail}.</li>
          <li><strong>Get a copy.</strong> Email {mail} from your account&rsquo;s address and we will send you the information we hold about you.</li>
          <li><strong>Switch things off.</strong> Turn your public delegate record and the weekly email on or off on your account page, unfollow conferences, and use the unsubscribe link in any email that has one.</li>
          <li><strong>Delete your account.</strong> You can do this yourself at the bottom of your <Link href="/account">account page</Link>. Or email {mail} from your account&rsquo;s address and we will do it.</li>
        </ul>
        <h3>What deleting your account removes</h3>
        <ul>
          <li>Your account: name, email, school, photo and settings.</li>
          <li>Your applications, registrations, follows, expressions of interest and alerts.</li>
          <li>Your place on any conference&rsquo;s team, and the claims you made.</li>
          <li>Committees you own, with everything in them, for their other chairs too. Your seats in other committees, and the notes, requests and votes you sent there.</li>
          <li>Every cover photo, photo and background guide you uploaded. They disappear from the listings they were on.</li>
        </ul>
        <h3>What stays</h3>
        <ul>
          <li>Conferences you listed stay on the calendar, because they belong to the conference. Email {mail} to have one removed.</li>
          <li>The history of changes, with your name and email taken out.</li>
          <li>Reports you sent, without your reply address, and emails and announcements you sent as an organiser.</li>
          <li>Marks chairs gave to a country, which belong to the committee.</li>
          <li>Files you shared in a committee are taken off its list, but the files themselves are not yet deleted by this step. Remove them in the committee first, or ask us to.</li>
        </ul>
      </section>

      <section>
        <h2>Students under 18</h2>
        <p>Most people on Collex are high school students. If you are under 18, check with a parent or guardian before you create an account; the sign-up form asks you to confirm that they said yes. We only ask for what an account needs, the school field is optional, and your delegate record stays private unless you switch it on.</p>
        <p>Don&rsquo;t put other students&rsquo; personal details, such as phone numbers or photos where they can be recognised, in a listing, a note or a file unless they have agreed.</p>
        <p>A parent, guardian or teacher can email {mail} to ask us to correct or delete a student&rsquo;s information or account. We may need to check who is asking first. Our page <Link href="/teachers">for teachers and parents</Link> explains more.</p>
      </section>

      <section>
        <h2>Security</h2>
        <p>Every connection to Collex is encrypted. Database rules decide what each account can read, so you see only your own details and what your role lets you see. Passwords are stored hashed, and committee files are private to the committee. No system is perfectly secure, and we cannot promise yours never will be exposed. If a breach is likely to cause someone serious harm, we will tell the people affected.</p>
      </section>

      <section>
        <h2>Changes to this policy</h2>
        <p>If we change this policy, we will post the new version here and update the date at the top.</p>
      </section>

      <section>
        <h2>Complaints</h2>
        <p>If you think we have mishandled your information, email {mail} first, and we will reply within 30 days. If you are not happy with our answer, you can complain to the Office of the Australian Information Commissioner at <a href="https://www.oaic.gov.au">oaic.gov.au</a> or on 1300 363 992.</p>
      </section>
    </LegalPage>
  );
}
