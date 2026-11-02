import Link from "next/link";
import styles from "./Footer.module.css";

export const CONTACT = "hello@collex.au";

const CREDITS = [
  { title: "United Nations General Assembly Hall (3)", by: "Basil D Soufi", lic: "CC BY-SA 3.0", licUrl: "https://creativecommons.org/licenses/by-sa/3.0", url: "https://commons.wikimedia.org/wiki/File:United_Nations_General_Assembly_Hall_(3).jpg" },
  { title: "United Nations Headquarters, Security Council chamber, angled view", by: "Jdforrester", lic: "CC BY 4.0", licUrl: "https://creativecommons.org/licenses/by/4.0", url: "https://commons.wikimedia.org/wiki/File:United_Nations_Headquarters_-_Security_Council_chamber,_angled_view.jpg" },
  { title: "Sydney Harbour Bridge night", by: "Diliff", lic: "CC BY-SA 3.0", licUrl: "https://creativecommons.org/licenses/by-sa/3.0", url: "https://commons.wikimedia.org/wiki/File:Sydney_Harbour_Bridge_night.jpg" },
  { title: "Sydney Town Hall", by: "JustARandomEditor123", lic: "CC BY-SA 4.0", licUrl: "https://creativecommons.org/licenses/by-sa/4.0", url: "https://commons.wikimedia.org/wiki/File:Sydney_Town_Hall.jpg" },
];

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <h2 className={`display ${styles.name}`}>
        Collex
      </h2>
      <div className={`grid wrap ${styles.row}`}>
        <ul className={styles.places}>
          <li><a className="link" href={`mailto:${CONTACT}`}>{CONTACT}</a></li>
          <li><Link className="link" href="/list">List a conference</Link></li>
          <li className={styles.city}>Sydney, New South Wales</li>
        </ul>
        <div className={styles.cols}>
          <ul>
            <li className={styles.colhead}>The circuit</li>
            <li><Link className="link" href="/calendar">Calendar</Link></li>
            <li><Link className="link" href="/conferences">Conferences</Link></li>
            <li><Link className="link" href="/conferences/template">The standard page</Link></li>
          </ul>
          <ul>
            <li className={styles.colhead}>Secretariats</li>
            <li><Link className="link" href="/list">List your conference</Link></li>
            <li><a className="link" href={`mailto:${CONTACT}?subject=Correction%20to%20a%20listing`}>Correct a listing</a></li>
            <li className="muted">Chair applications, soon</li>
          </ul>
          <ul>
            <li className={styles.colhead}>Pictures</li>
            {CREDITS.map((c) => (
              <li key={c.url} className={styles.credit}>
                <a className="link" href={c.url}>{c.title}</a> by {c.by},{" "}
                <a className="link" href={c.licUrl}>{c.lic}</a>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className={`wrap ${styles.legal}`}>
        <span>© {new Date().getFullYear()} Collex. Independent of any one conference.</span>
        <a className="link" href="#top">Back to top</a>
      </div>
    </footer>
  );
}
