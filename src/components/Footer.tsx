import Link from "next/link";
import styles from "./Footer.module.css";

export const CONTACT = "hello@collex.au";

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.inner}`}>
        <div className={styles.brand}>
          <Link href="/" className="wordmark">Collex</Link>
          <p className="muted">The shared calendar for the Sydney Model UN circuit.</p>
        </div>
        <nav className={styles.cols} aria-label="Footer">
          <ul>
            <li className={styles.head}>Circuit</li>
            <li><Link href="/">Home</Link></li>
            <li><Link href="/calendar">Calendar</Link></li>
            <li><Link href="/conferences">Conferences</Link></li>
          </ul>
          <ul>
            <li className={styles.head}>Secretariats</li>
            <li><Link href="/list">List a conference</Link></li>
            <li><Link href="/conferences/template">The standard page</Link></li>
            <li><a href={`mailto:${CONTACT}?subject=Correction%20to%20a%20listing`}>Correct a listing</a></li>
          </ul>
          <ul>
            <li className={styles.head}>Contact</li>
            <li><a href={`mailto:${CONTACT}`}>{CONTACT}</a></li>
            <li className="muted">Sydney, NSW</li>
          </ul>
        </nav>
      </div>
      <div className={`container ${styles.legal}`}>
        <span>© {new Date().getFullYear()} Collex</span>
        <span>Photo: UN General Assembly hall, Basil D Soufi, <a href="https://creativecommons.org/licenses/by-sa/3.0" className="link">CC BY-SA 3.0</a></span>
      </div>
    </footer>
  );
}
