import Link from "next/link";
import { Wordmark } from "@/lib/brand";
import styles from "./Footer.module.css";

export const CONTACT = "hello@collex.au";

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.inner}`}>
        <div className={styles.brand}>
          <Link href="/" className="wordmark" aria-label="Collex home"><Wordmark /></Link>
          <p className="muted">A calendar for the Sydney Model UN circuit. Independent, and not affiliated with the United Nations.</p>
        </div>
        <nav className={styles.cols} aria-label="Footer">
          <ul>
            <li className={styles.head}>Circuit</li>
            <li><Link href="/">Home</Link></li>
            <li><Link href="/calendar">Calendar</Link></li>
            <li><Link href="/conferences">Conferences</Link></li>
            <li><Link href="/roles">Get involved</Link></li>
            <li><Link href="/past">Past conferences</Link></li>
            <li><Link href="/about">About</Link></li>
          </ul>
          <ul>
            <li className={styles.head}>Secretariats</li>
            <li><Link href="/list">List a conference</Link></li>
            <li><Link href="/conferences/template">Demo page</Link></li>
            <li><a href={`mailto:${CONTACT}?subject=Correction%20to%20a%20listing`}>Correct a listing</a></li>
          </ul>
          <ul>
            <li className={styles.head}>Contact</li>
            <li><a href={`mailto:${CONTACT}`}>{CONTACT}</a></li>
            <li className="muted">Sydney, NSW, Australia</li>
          </ul>
          <ul>
            <li className={styles.head}>Legal</li>
            <li><Link href="/privacy">Privacy</Link></li>
            <li><Link href="/terms">Terms</Link></li>
            <li><Link href="/cookies">Cookies</Link></li>
          </ul>
        </nav>
      </div>
      <div className={`container ${styles.legal}`}>
        <span>© {new Date().getFullYear()} Collex</span>
        <span>
          Photo: <a href="https://commons.wikimedia.org/wiki/File:United_Nations_General_Assembly_Hall_(3).jpg" className="link">&ldquo;United Nations General Assembly Hall (3)&rdquo;</a> by Basil D Soufi,
          via Wikimedia Commons, <a href="https://creativecommons.org/licenses/by-sa/3.0/" className="link">CC BY-SA 3.0</a>, resized and cropped
        </span>
      </div>
    </footer>
  );
}
